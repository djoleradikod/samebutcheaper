import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { sendPendingConfirmations } from "./newsletter";

/**
 * Daily upkeep, so the database keeps to what the privacy page promises without anyone remembering to run it:
 *  - sign-ups that never confirmed are deleted 30 days after their confirmation email;
 *  - the page a click came from and the visitor hash are dropped from clicks after RETENTION_CLICK_DETAIL_DAYS
 *    (180); the click itself stays, because sales are matched to it;
 *  - the raw report a network sent with a sale is dropped after the same time;
 *  - product checks are deleted after RETENTION_LOOKUP_DAYS (365);
 *  - sign-ups still waiting for a confirmation email (stored before email was set up) get it.
 *
 * It runs inside the web server (src/instrumentation.ts) and can be run by hand with `npm run db:maintain`.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;

export type MaintenanceReport = {
  ranAt: string;
  pendingSubscribersDeleted: number;
  clicksStripped: number;
  conversionsStripped: number;
  lookupsDeleted: number;
  confirmationsSent: number;
};

const STATE_KEY = "maintenance";
/** Any number, as long as nothing else in this database uses it. */
const LOCK_ID = 7262001;
const DAY = 24 * 3600_000;

function days(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export async function lastMaintenance(db: DB): Promise<MaintenanceReport | null> {
  const [row] = await db.select().from(schema.appState).where(eq(schema.appState.key, STATE_KEY)).limit(1);
  return (row?.value as MaintenanceReport | undefined) ?? null;
}

/**
 * Runs upkeep now. Returns null when another run holds the lock. `minHoursSinceLast` skips the run (returning the
 * last report) when one finished recently, so a server that restarts often doesn't repeat it each time.
 */
export async function runMaintenance(
  db: DB,
  opts: { siteUrl: string; env?: Env; now?: Date; minHoursSinceLast?: number },
): Promise<MaintenanceReport | null> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  if (opts.minHoursSinceLast) {
    const last = await lastMaintenance(db);
    if (last && now.getTime() - Date.parse(last.ranAt) < opts.minHoursSinceLast * 3600_000) return last;
  }
  const before = (n: number) => new Date(now.getTime() - n * DAY);
  const clickCutoff = before(days(env.RETENTION_CLICK_DETAIL_DAYS, 180));
  const lookupCutoff = before(days(env.RETENTION_LOOKUP_DAYS, 365));
  const { subscribers, clicks, conversions, lookups, appState } = schema;

  const counts = await db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${LOCK_ID}) as locked`);
    if (!lock?.locked) return null;
    const pending = await tx
      .delete(subscribers)
      .where(and(eq(subscribers.status, "pending"), lt(subscribers.confirmSentAt, before(30))))
      .returning({ id: subscribers.id });
    const stripped = await tx
      .update(clicks)
      .set({ referrer: null, visitorHash: null })
      .where(and(lt(clicks.createdAt, clickCutoff), or(isNotNull(clicks.referrer), isNotNull(clicks.visitorHash))))
      .returning({ id: clicks.id });
    const raw = await tx
      .update(conversions)
      .set({ raw: null })
      .where(and(lt(conversions.updatedAt, clickCutoff), isNotNull(conversions.raw)))
      .returning({ id: conversions.id });
    const old = await tx.delete(lookups).where(lt(lookups.createdAt, lookupCutoff)).returning({ id: lookups.id });
    return {
      pendingSubscribersDeleted: pending.length,
      clicksStripped: stripped.length,
      conversionsStripped: raw.length,
      lookupsDeleted: old.length,
    };
  });
  if (!counts) return null;

  const confirmationsSent = await sendPendingConfirmations(db, { siteUrl: opts.siteUrl, env });
  const report: MaintenanceReport = { ranAt: now.toISOString(), ...counts, confirmationsSent };
  await db
    .insert(appState)
    .values({ key: STATE_KEY, value: report, updatedAt: now })
    .onConflictDoUpdate({ target: appState.key, set: { value: report, updatedAt: now } });
  return report;
}
