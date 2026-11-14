import "server-only";
import { getFormDb, schema } from "@/db";
import { log } from "@/lib/log";
import { visitorFrom } from "@/lib/visitor";

export type LookupLog = {
  kind: "text" | "barcode" | "photo" | "product";
  query?: string | null;
  source?: string | null;
  sourceId?: string | null;
  productName?: string | null;
  verified?: boolean;
};

/** Records a lookup. Call inside after() so it never slows the response. */
export async function logLookup(entry: LookupLog, headers: Headers, country: string | null) {
  const db = getFormDb();
  const visitor = visitorFrom(headers);
  if (!db || visitor.isBot) return;
  try {
    await db.insert(schema.lookups).values({
      kind: entry.kind,
      query: entry.query?.slice(0, 200) ?? null,
      source: entry.source?.slice(0, 16) ?? null,
      sourceId: entry.sourceId?.slice(0, 80) ?? null,
      productName: entry.productName?.slice(0, 200) ?? null,
      verified: entry.verified ?? false,
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      visitorHash: visitor.hash,
    });
  } catch (err) {
    log.error("lookup.log_failed", { err });
  }
}
