import { getDb } from "@/db";
import { log } from "@/lib/log";
import { isScope, unsubscribe } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * POST /api/newsletter/unsubscribe?token=…[&only=letter|watch-12|wish-3]  Takes the address off the list, or with
 * `only`, stops just the weekly letter, one watch or one wish. Two callers:
 *  - mail apps, for one-click unsubscribe (RFC 8058: body "List-Unsubscribe=One-Click"), which get a plain 200;
 *  - the button on /newsletter/unsubscribe, a normal form post, which is sent on to the "done" page.
 * It only acts on POST, so a scanner that opens links in an email can't unsubscribe anyone.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!rateLimit("tokens", visitorFrom(request.headers).key, LIMITS.tokens).ok) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "600" } });
  }
  let oneClick = false;
  try {
    oneClick = (await request.formData()).get("List-Unsubscribe") === "One-Click";
  } catch {
    // No body, or not a form: treat it as the button.
  }
  const only = url.searchParams.get("only");
  const scope = only !== null && isScope(only) ? only : undefined;
  const db = getDb();
  let outcome: "done" | "already" | "invalid" = "invalid";
  if (db && (only === null || scope)) {
    try {
      outcome = await unsubscribe(db, url.searchParams.get("token") ?? "", new Date(), scope);
    } catch (err) {
      log.error("newsletter.unsubscribe_failed", { err });
      return new Response("Try again later", { status: 503, headers: NO_STORE });
    }
  }
  if (oneClick) return new Response(outcome === "invalid" ? "Unknown link" : "Unsubscribed", { status: outcome === "invalid" ? 404 : 200, headers: NO_STORE });
  const done = scope ? "/newsletter/stopped" : "/newsletter/unsubscribed";
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: outcome === "invalid" ? "/newsletter/invalid" : done } });
}

/** A GET is someone following the raw link: show them the page with the button. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const only = params.get("only");
  const scoped = only && isScope(only) ? `&only=${only}` : "";
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `/newsletter/unsubscribe?token=${encodeURIComponent(token)}${scoped}` } });
}
