import "server-only";
import { getFormDb } from "@/db";
import { log } from "@/lib/log";
import { logLookup as logLookupOnly, type LookupLog } from "@/lib/lookup/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";
import { normaliseQuery, recordWanted } from "@/lib/wanted";

/**
 * /check's lookup log, plus the "most wanted" count: a product /check could read (by barcode, or picked from the
 * label databases) that has no verified swap is a miss, counted by its brand and name. Call inside after().
 */
export async function logLookup(entry: LookupLog, headers: Headers, country: string | null) {
  await logLookupOnly(entry, headers, country);
  if (entry.verified || !entry.productName || (entry.kind !== "product" && entry.kind !== "barcode")) return;
  const query = normaliseQuery(entry.productName);
  const db = getFormDb();
  const visitor = visitorFrom(headers);
  if (!query || !db || visitor.isBot) return;
  if (!rateLimit("wanted", visitor.key, LIMITS.wanted).ok) return;
  if (!rateLimit("wanted-once", `${visitor.key}:${query}`, LIMITS.oncePerDay).ok) return;
  try {
    await recordWanted(db, { query, source: "check", country });
  } catch (err) {
    log.error("wanted.log_failed", { err });
  }
}
