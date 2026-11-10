import "server-only";
import { after } from "next/server";
import { getDb, schema } from "@/db";
import { newClickId, tagLink } from "./affiliate-links";
import { log } from "./log";
import { isKnownCountry } from "./markets";
import { LIMITS, rateLimit } from "./rate-limit";
import { isPrefetch, visitorFrom } from "./visitor";

/**
 * Sends a shopper to a store: tags the URL with the best affiliate program,
 * logs the click with its click ID (after the response is sent), and 302s.
 * Used by /go (catalog products) and /out (store searches).
 */
export function redirectOut(
  request: Request,
  target: { url: string; slug: string; side: string; retailer: string },
): Response {
  const visitor = visitorFrom(request.headers);
  const clickId = newClickId();
  const link = tagLink(target.url, clickId);
  const referrer = request.headers.get("referer");
  const cookieCountry = /(?:^|;\s*)sbc_country=([A-Z]{2})/.exec(request.headers.get("cookie") ?? "")?.[1];
  const country = isKnownCountry(cookieCountry) ? cookieCountry : null;
  const source = /(?:^|;\s*)sbc_src=([a-z0-9._-]{1,40})(?:;|$)/.exec(request.headers.get("cookie") ?? "")?.[1] ?? null;
  let host: string | null = null;
  try {
    host = new URL(target.url).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {}

  // A click is a person following the link: not a crawler, a link checker's HEAD, a browser fetching ahead, or
  // the 61st from one address in a minute. Everyone is still redirected.
  const counts =
    !visitor.isBot &&
    request.method === "GET" &&
    !isPrefetch(request.headers) &&
    rateLimit("clicks", visitor.key, LIMITS.clicks).ok;

  after(async () => {
    const db = getDb();
    if (!db || !counts) return;
    try {
      await db.insert(schema.clicks).values({
        pairSlug: target.slug.slice(0, 160),
        side: target.side.slice(0, 16),
        retailer: target.retailer.slice(0, 32),
        referrer: referrer?.slice(0, 500) ?? null,
        visitorHash: visitor.hash,
        clickId,
        program: link.program,
        country,
        host,
        source,
      });
    } catch (err) {
      log.error("click.log_failed", { err, slug: target.slug });
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: link.url,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      // Stores and networks see that the click came from us (some programs require it).
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  });
}
