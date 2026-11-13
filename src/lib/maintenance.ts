import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { catalogueData, type CatalogueView } from "./catalog-data";
import { runWeeklyLetter, type LetterRun } from "./letter";
import { log } from "./log";
import { sendPendingConfirmations } from "./newsletter";
import { SITE } from "./site";
import { runWishAnswers, type WishRun } from "./wanted-answer";
import { runWatches, type WatchRun } from "./watches";

/**
 * Daily upkeep, so the database keeps to what the privacy page promises without anyone remembering to run it:
 *  - sign-ups that never confirmed are deleted 30 days after their last confirmation email, and requests (price
 *    watches, "tell me when you add it") that were never confirmed 30 days after theirs;
 *  - stopped or ended watches and wishes (answered ones too) are deleted 30 days after they stopped, and wishes
 *    still waiting after RETENTION_WISH_DAYS (365);
 *  - a confirmed address with nothing switched on (the letter off, no watch or wish waiting or active) is deleted
 *    30 days after the last thing it had ended, with everything about it;
 *  - the page a click came from and the visitor hash are dropped from clicks after RETENTION_CLICK_DETAIL_DAYS
 *    (180); the click itself stays, because sales are matched to it;
 *  - the raw report a network sent with a sale is dropped after the same time;
 *  - product checks are deleted after RETENTION_LOOKUP_DAYS (365);
 *  - "Something wrong?" reports lose their visitor hash after 30 days and are deleted after RETENTION_REPORT_DAYS
 *    (180); "most wanted" counts are deleted after RETENTION_WANTED_DAYS (400);
 *  - the log of emails sent is deleted after RETENTION_SEND_DAYS (400);
 *  - requests still waiting for a confirmation email (stored before email was set up) get it;
 *  - price watches whose swap changed get their email (src/lib/watches.ts), "tell me when you add it" requests a
 *    new swap answers get theirs (src/lib/wanted-answer.ts), and the weekly letter goes out when it is due
 *    (src/lib/letter.ts).
 *
 * It runs inside the web server (src/instrumentation.ts) and can be run by hand with `npm run db:maintain`.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;

export type MaintenanceReport = {
  ranAt: string;
  pendingSubscribersDeleted: number;
  /** Confirmed addresses with nothing switched on for 30 days. */
  idleSubscribersDeleted: number;
  clicksStripped: number;
  conversionsStripped: number;
  lookupsDeleted: number;
  reportsDeleted: number;
  wantedDeleted: number;
  watchesDeleted: number;
  wishesDeleted: number;
  sendsDeleted: number;
  confirmationsSent: number;
  /** Price-watch emails sent, and changes found that couldn't be sent (email not set up). */
  watchMailsSent: number;
  watchChangesUnsent: number;
  /** "Tell me when you add it" answers sent, and matches found that couldn't be sent (email not set up). */
  wishMailsSent: number;
  wishMatchesUnsent: number;
  /** What the weekly letter did: "off", "not-today", "sent 120" and so on. */
  letter: string;
};

const STATE_KEY = "maintenance";
/** Any number, as long as nothing else in this database uses it. */
const LOCK_ID = 7262001;
const DAY = 24 * 3600_000;
/** Unconfirmed requests, stopped watches and addresses with nothing left switched on go after this many days. */
export const UNCONFIRMED_DAYS = 30;
/** Reports keep the visitor hash this long: past the 14 days the "three reports" rule looks at. */
const REPORT_HASH_DAYS = 30;

export function days(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** The retention periods in force, in days, from the environment or their defaults. */
export function retention(env: Env) {
  return {
    clickDetail: days(env.RETENTION_CLICK_DETAIL_DAYS, 180),
    lookups: days(env.RETENTION_LOOKUP_DAYS, 365),
    reports: days(env.RETENTION_REPORT_DAYS, 180),
    /** Fixed, not settings: unconfirmed requests, stopped watches and wishes, idle addresses, report hashes. */
    unconfirmed: UNCONFIRMED_DAYS,
    reportHash: REPORT_HASH_DAYS,
    wanted: days(env.RETENTION_WANTED_DAYS, 400),
    wishes: days(env.RETENTION_WISH_DAYS, 365),
    sends: days(env.RETENTION_SEND_DAYS, 400),
  };
}

export async function lastMaintenance(db: DB): Promise<MaintenanceReport | null> {
  const [row] = await db.select().from(schema.appState).where(eq(schema.appState.key, STATE_KEY)).limit(1);
  return (row?.value as MaintenanceReport | undefined) ?? null;
}

function letterText(run: LetterRun | null) {
  if (!run) return "failed";
  if (run.status === "ran")
    return `${run.issue}: sent ${run.sent}${run.empty ? `, ${run.empty} had nothing new` : ""}${run.failed ? `, ${run.failed} failed` : ""}${run.held ? `, ${run.held} in DE/AT held back (no legal notice)` : ""}`;
  if (run.status === "no-mail") return `email not set up (${run.waiting} waiting)`;
  return run.status;
}

/**
 * Runs upkeep now. Returns null when another run holds the lock. `minHoursSinceLast` skips the run (returning the
 * last report) when one finished recently, so a server that restarts often doesn't repeat it each time.
 */
export async function runMaintenance(
  db: DB,
  opts: { siteUrl: string; contactEmail?: string; env?: Env; now?: Date; minHoursSinceLast?: number; catalogue?: CatalogueView; pauseMs?: number },
): Promise<MaintenanceReport | null> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  if (opts.minHoursSinceLast) {
    const last = await lastMaintenance(db);
    if (last && now.getTime() - Date.parse(last.ranAt) < opts.minHoursSinceLast * 3600_000) return last;
  }
  const keep = retention(env);
  const before = (n: number) => new Date(now.getTime() - n * DAY);
  const clickCutoff = before(keep.clickDetail);
  const unconfirmed = before(UNCONFIRMED_DAYS);
  const { subscribers, clicks, conversions, lookups, reports, wanted, watches, wishes, sends, appState } = schema;

  const counts = await db.transaction(async (tx) => {
    const [lock] = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_xact_lock(${LOCK_ID}) as locked`);
    if (!lock?.locked) return null;
    // A pending address goes 30 days after the last confirmation email of any kind it was sent.
    const lastConfirm = sql`greatest(${subscribers.confirmSentAt},
      (select max(w.confirm_sent_at) from ${watches} w where w.subscriber_id = ${subscribers.id}),
      (select max(x.confirm_sent_at) from ${wishes} x where x.subscriber_id = ${subscribers.id}))`;
    const pending = await tx
      .delete(subscribers)
      .where(and(eq(subscribers.status, "pending"), sql`${lastConfirm} < ${unconfirmed.toISOString()}::timestamptz`))
      .returning({ id: subscribers.id });
    // A confirmed address with nothing on: letter off (or asked again and never confirmed), no watch or wish
    // waiting or active. It goes 30 days after the last thing it had ended, taking its stopped watches, wishes and
    // send log with it.
    const live = (t: typeof watches | typeof wishes) =>
      sql`exists (select 1 from ${t} i where i.subscriber_id = ${subscribers.id} and i.status in ('pending', 'active'))`;
    const lastActive = sql`greatest(${subscribers.confirmedAt}, ${subscribers.letterConfirmedAt}, ${subscribers.letterStoppedAt}, ${subscribers.confirmSentAt},
      (select max(coalesce(w.stopped_at, w.created_at)) from ${watches} w where w.subscriber_id = ${subscribers.id}),
      (select max(coalesce(x.stopped_at, x.created_at)) from ${wishes} x where x.subscriber_id = ${subscribers.id}))`;
    const idle = await tx
      .delete(subscribers)
      .where(
        and(
          eq(subscribers.status, "confirmed"),
          or(eq(subscribers.newsletter, "no"), and(eq(subscribers.newsletter, "pending"), lt(subscribers.confirmSentAt, unconfirmed))),
          sql`not ${live(watches)}`,
          sql`not ${live(wishes)}`,
          sql`${lastActive} < ${unconfirmed.toISOString()}::timestamptz`,
        ),
      )
      .returning({ id: subscribers.id });
    let watchesDeleted = 0;
    let wishesDeleted = 0;
    for (const table of [watches, wishes] as const) {
      const gone = await tx
        .delete(table)
        .where(
          or(
            and(eq(table.status, "pending"), lt(table.confirmSentAt, unconfirmed)),
            and(inArray(table.status, ["stopped", "ended", "answered"]), lt(table.stoppedAt, unconfirmed)),
            table === wishes ? and(eq(wishes.status, "active"), lt(wishes.createdAt, before(keep.wishes))) : sql`false`,
          ),
        )
        .returning({ id: table.id });
      if (table === watches) watchesDeleted = gone.length;
      else wishesDeleted = gone.length;
    }
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
    const old = await tx.delete(lookups).where(lt(lookups.createdAt, before(keep.lookups))).returning({ id: lookups.id });
    await tx
      .update(reports)
      .set({ visitorHash: null })
      .where(and(lt(reports.createdAt, before(REPORT_HASH_DAYS)), isNotNull(reports.visitorHash)));
    const oldReports = await tx.delete(reports).where(lt(reports.createdAt, before(keep.reports))).returning({ id: reports.id });
    const oldWanted = await tx
      .delete(wanted)
      .where(lt(wanted.day, before(keep.wanted).toISOString().slice(0, 10)))
      .returning({ id: wanted.id });
    const oldSends = await tx.delete(sends).where(lt(sends.createdAt, before(keep.sends))).returning({ id: sends.id });
    return {
      pendingSubscribersDeleted: pending.length,
      idleSubscribersDeleted: idle.length,
      clicksStripped: stripped.length,
      conversionsStripped: raw.length,
      lookupsDeleted: old.length,
      reportsDeleted: oldReports.length,
      wantedDeleted: oldWanted.length,
      watchesDeleted,
      wishesDeleted,
      sendsDeleted: oldSends.length,
    };
  });
  if (!counts) return null;

  const catalogue = opts.catalogue ?? catalogueData();
  const titles = new Map(catalogue.pairs.map((p) => [p.slug, p.title]));
  const contactEmail = opts.contactEmail ?? SITE.contactEmail;
  const confirmationsSent = await sendPendingConfirmations(db, { siteUrl: opts.siteUrl, env, now, titleFor: (slug) => titles.get(slug) ?? slug });
  let watchRun: WatchRun | null = null;
  try {
    watchRun = await runWatches(db, {
      siteUrl: opts.siteUrl,
      contactEmail,
      postalAddress: env.MAIL_POSTAL_ADDRESS?.trim() || null,
      env,
      now,
      catalogue,
      limit: days(env.WATCH_MAX_PER_RUN, 200),
      pauseMs: opts.pauseMs ?? 500,
    });
  } catch (err) {
    log.error("watches.failed", { err });
  }
  let wishRun: WishRun | null = null;
  try {
    wishRun = await runWishAnswers(db, {
      siteUrl: opts.siteUrl,
      contactEmail,
      postalAddress: env.MAIL_POSTAL_ADDRESS?.trim() || null,
      env,
      now,
      catalogue,
      limit: days(env.WISH_MAX_PER_RUN, 100),
      pauseMs: opts.pauseMs ?? 500,
    });
  } catch (err) {
    log.error("wishes.failed", { err });
  }
  let letterRun: LetterRun | null = null;
  try {
    letterRun = await runWeeklyLetter(db, { siteUrl: opts.siteUrl, contactEmail, env, now, catalogue, pauseMs: opts.pauseMs ?? 500 });
  } catch (err) {
    log.error("letter.failed", { err });
  }
  const report: MaintenanceReport = {
    ranAt: now.toISOString(),
    ...counts,
    confirmationsSent,
    watchMailsSent: watchRun?.sent ?? 0,
    watchChangesUnsent: watchRun?.notSent ?? 0,
    wishMailsSent: wishRun?.sent ?? 0,
    wishMatchesUnsent: wishRun?.notSent ?? 0,
    letter: letterText(letterRun),
  };
  await db
    .insert(appState)
    .values({ key: STATE_KEY, value: report, updatedAt: now })
    .onConflictDoUpdate({ target: appState.key, set: { value: report, updatedAt: now } });
  return report;
}
