import { getDb } from "@/db";
import { log } from "@/lib/log";
import { isScope, isToken, unsubscribe } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };

/**
 * POST /api/newsletter/unsubscribe  Takes the address off the list, or with `only` (letter, watch-12, wish-3),
 * stops just the weekly letter, one watch or one wish. Two callers:
 *  - mail apps, for one-click unsubscribe (RFC 8058): POST to the List-Unsubscribe address, which carries `token`
 *    and `only` in its query, with the body "List-Unsubscribe=One-Click". They get a plain 200;
 *  - the button on /newsletter/unsubscribe, a normal form post with `token` and `only` as fields, which is sent
 *    on to the "done" page.
 * It only acts on POST, so a scanner that opens links in an email can't unsubscribe anyone. Doing it twice is
 * harmless: the second time there is nothing left to stop.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!rateLimit("tokens", visitorFrom(request.headers).key, LIMITS.tokens).ok) {
    return new Response("Too many requests", { status: 429, headers: { ...NO_STORE, "Retry-After": "600" } });
  }
  let form: FormData | null = null;
  try {
    form = await request.formData();
  } catch {
    // No body, or not a form: the query alone.
  }
  const field = (k: string) => url.searchParams.get(k) ?? (typeof form?.get(k) === "string" ? (form.get(k) as string) : null);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";
  const only = field("only") || null;
  const scope = only !== null && isScope(only) ? only : undefined;
  const token = field("token") ?? "";
  const db = getDb();
  let outcome: "done" | "already" | "invalid" = "invalid";
  if (db && isToken(token) && (only === null || scope)) {
    try {
      outcome = await unsubscribe(db, token, new Date(), scope);
    } catch (err) {
      log.error("newsletter.unsubscribe_failed", { err });
      return new Response("Try again later", { status: 503, headers: NO_STORE });
    }
  }
  if (oneClick) return new Response(outcome === "invalid" ? "Unknown link" : "Unsubscribed", { status: outcome === "invalid" ? 404 : 200, headers: NO_STORE });
  // The page the button was on says its language (`lang`), so the next page is in it too.
  const at = field("lang") === "de" ? "/de" : "";
  const done = `${at}${scope ? "/newsletter/stopped" : "/newsletter/unsubscribed"}`;
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: outcome === "invalid" ? `${at}/newsletter/invalid` : done } });
}

/** A GET is someone following the raw link: show them the page with the button. It never changes anything. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const only = params.get("only");
  const scoped = only && isScope(only) ? `&only=${only}` : "";
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `/newsletter/unsubscribe?token=${encodeURIComponent(token)}${scoped}` } });
}
