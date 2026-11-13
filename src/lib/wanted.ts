import { and, desc, gte, inArray, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { wouldRelease } from "./wanted-match";

/**
 * What shoppers wanted and we didn't have: zero-result searches and products /check read but has no swap for.
 * Stored as a count per normalised query, source, country and day, nothing about who asked. The admin sees the
 * most wanted over 7 and 30 days, with how many people asked to be told when we add each one (wishes).
 */
type DB = PostgresJsDatabase<typeof schema>;
const { wanted, wishes } = schema;

export const QUERY_MAX = 80;
export type WantedSource = "search" | "check";

/**
 * A query as we count it: lower case, single spaces, quotes and stray punctuation gone, at most QUERY_MAX
 * characters (cut at a word). Null for anything that could be personal or isn't a product: an email address, a
 * web address, a long run of digits (a phone or card number), or fewer than two letters.
 */
export function normaliseQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let q = raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/["“”„«»‘’`´]/g, "")
    .replace(/[^\p{L}\p{N}\s&%+.,'/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return null;
  if (/@|https?:|www\.|\.(com|de|co\.uk|net|org)\b/.test(q)) return null;
  if (/\d[\d\s./-]{5,}\d/.test(q) && q.replace(/\D/g, "").length >= 7) return null;
  if ((q.match(/\p{L}/gu) ?? []).length < 2) return null;
  if (q.length > QUERY_MAX) q = q.slice(0, QUERY_MAX).replace(/\s+\S*$/, "") || q.slice(0, QUERY_MAX);
  return q.replace(/[\s.,/-]+$/, "");
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const cleanCountry = (c: string | null | undefined) => (c && /^[A-Z]{2}$/.test(c) ? c : "");

/** Counts one miss. The query must already be normalised. */
export async function recordWanted(db: DB, input: { query: string; source: WantedSource; country?: string | null; now?: Date }) {
  await db
    .insert(wanted)
    .values({ query: input.query, source: input.source, country: cleanCountry(input.country), day: day(input.now ?? new Date()), count: 1 })
    .onConflictDoUpdate({ target: [wanted.query, wanted.source, wanted.country, wanted.day], set: { count: sql`${wanted.count} + 1` } });
}

export type WantedRow = {
  query: string;
  country: string;
  sources: string;
  last7: number;
  last30: number;
  /** People whose "tell me when you add it" is confirmed. */
  waiting: number;
  /** And those who haven't followed the confirm link yet. */
  waitingPending: number;
  /**
   * Confirmed requests a swap named exactly this would answer: this query's and any whose words it contains
   * ("advil" is answered by a swap for "advil liqui-gels"). In this row's country, or every country overall.
   */
  wouldRelease: number;
};

/** The most wanted queries per country over 30 days, with their 7-day counts. `country` null: all countries together. */
export async function mostWanted(db: DB, opts: { now?: Date; days?: number; limit?: number; byCountry?: boolean } = {}): Promise<WantedRow[]> {
  const now = opts.now ?? new Date();
  const days = opts.days ?? 30;
  const since = day(new Date(now.getTime() - (days - 1) * 86400000));
  const week = day(new Date(now.getTime() - 6 * 86400000));
  const byCountry = opts.byCountry ?? true;
  const country = byCountry ? wanted.country : sql<string>`''`;
  const rows = await db
    .select({
      query: wanted.query,
      country: sql<string>`${country}`,
      sources: sql<string>`string_agg(distinct ${wanted.source}, ', ')`,
      last7: sql<number>`coalesce(sum(${wanted.count}) filter (where ${wanted.day} >= ${week}), 0)`.mapWith(Number),
      last30: sql<number>`sum(${wanted.count})`.mapWith(Number),
    })
    .from(wanted)
    .where(gte(wanted.day, since))
    .groupBy(wanted.query, ...(byCountry ? [wanted.country] : []))
    .orderBy(desc(sql`sum(${wanted.count})`), wanted.query)
    .limit(opts.limit ?? 200);
  const waits = await waitingFor(db, rows.map((r) => r.query));
  const active = await activeWishes(db);
  return rows.map((r) => {
    const w = waits.get(r.query);
    const pool = byCountry ? active.filter((a) => a.country === r.country) : active;
    return { ...r, waiting: w?.active ?? 0, waitingPending: w?.pending ?? 0, wouldRelease: wouldRelease(r.query, pool) };
  });
}

/** Confirmed requests still waiting, counted per query and country ("" when unknown). */
async function activeWishes(db: DB) {
  return db
    .select({ query: wishes.query, country: sql<string>`coalesce(${wishes.country}, '')`, n: sql<number>`count(*)`.mapWith(Number) })
    .from(wishes)
    .where(inArray(wishes.status, ["active"]))
    .groupBy(wishes.query, sql`coalesce(${wishes.country}, '')`)
    .limit(5000);
}

/** How many people wait for each query: confirmed, and not yet confirmed. */
export async function waitingFor(db: DB, queries: string[]) {
  const out = new Map<string, { active: number; pending: number }>();
  if (!queries.length) return out;
  const rows = await db
    .select({
      query: wishes.query,
      active: sql<number>`count(*) filter (where ${wishes.status} = 'active')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${wishes.status} = 'pending')`.mapWith(Number),
    })
    .from(wishes)
    .where(and(inArray(wishes.query, [...new Set(queries)]), inArray(wishes.status, ["active", "pending"])))
    .groupBy(wishes.query);
  for (const r of rows) out.set(r.query, { active: r.active, pending: r.pending });
  return out;
}

/** Wishes for queries that no longer show up in the counts (for example because the search now finds something). */
export async function waitingList(db: DB, limit = 100) {
  return db
    .select({
      query: wishes.query,
      active: sql<number>`count(*) filter (where ${wishes.status} = 'active')`.mapWith(Number),
      pending: sql<number>`count(*) filter (where ${wishes.status} = 'pending')`.mapWith(Number),
    })
    .from(wishes)
    .where(inArray(wishes.status, ["active", "pending"]))
    .groupBy(wishes.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}
