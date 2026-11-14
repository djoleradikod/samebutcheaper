import "server-only";
import { getFormDb } from "@/db";
import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";
import { normaliseQuery, recordWanted } from "@/lib/wanted";

/** Most misses one checked list adds to the most-wanted counts. */
export const MISSES_PER_LIST = 15;

/**
 * Counts the lines we had nothing for in the "most wanted" log, the same way /check counts a product it read but
 * has no swap for: only the cleaned product name (normaliseQuery drops anything that looks personal), never the line,
 * a price or the rest of the receipt, once per visitor, name and day, within the visitor's wanted limit. Call inside after().
 */
export async function countMisses(queries: readonly string[], headers: Headers, country: string | null) {
  const db = getFormDb();
  const visitor = visitorFrom(headers);
  if (!db || visitor.isBot) return;
  const names = [...new Set(queries.map((q) => normaliseQuery(q)).filter((q): q is string => Boolean(q)))].slice(0, MISSES_PER_LIST);
  let counted = 0;
  for (const query of names) {
    if (!rateLimit("wanted", visitor.key, LIMITS.wanted).ok) break;
    if (!rateLimit("wanted-once", `${visitor.key}:${query}`, LIMITS.oncePerDay).ok) continue;
    try {
      await recordWanted(db, { query, source: "check", country });
      counted++;
    } catch (err) {
      log.error("wanted.log_failed", { err });
      return;
    }
  }
  if (counted) log.info("receipt.misses_counted", { count: counted });
}
