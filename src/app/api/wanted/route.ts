import { getFormDb } from "@/db";
import { log } from "@/lib/log";
import { isKnownCountry } from "@/lib/markets";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";
import { recordWanted, wantedRequest } from "@/lib/wanted";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * POST /api/wanted  {"q": "..."}  A search on /search that found nothing, sent once the shopper stops typing, or
 * {"q": "...", "source": "check"}: a "did you mean" on /check/list the shopper answered No to (see wantedRequest).
 * Counted once per visitor, query and day, without the visitor: see src/lib/wanted.ts. Always answers 204, so it
 * tells a script nothing.
 */
export async function POST(request: Request) {
  const done = () => new Response(null, { status: 204, headers: NO_STORE });
  const visitor = visitorFrom(request.headers);
  if (visitor.isBot) return done();
  if (!rateLimit("wanted", visitor.key, LIMITS.wanted).ok) return new Response(null, { status: 429, headers: { ...NO_STORE, "Retry-After": "600" } });
  let asked: ReturnType<typeof wantedRequest> = null;
  try {
    const text = await request.text();
    if (text.length > 1000) return done();
    asked = wantedRequest(JSON.parse(text));
  } catch {
    return done();
  }
  const db = getFormDb();
  if (!asked || !db) return done();
  const { query, source } = asked;
  if (!rateLimit("wanted-once", `${visitor.key}:${query}`, LIMITS.oncePerDay).ok) return done();
  const cookie = /(?:^|;\s*)sbc_country=([A-Z]{2})\b/.exec(request.headers.get("cookie") ?? "")?.[1];
  try {
    await recordWanted(db, { query, source, country: isKnownCountry(cookie) ? cookie : null });
  } catch (err) {
    log.error("wanted.log_failed", { err });
  }
  return done();
}
