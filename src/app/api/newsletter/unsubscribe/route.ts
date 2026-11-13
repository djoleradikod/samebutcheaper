import { getDb } from "@/db";
import { log } from "@/lib/log";
import { unsubscribe } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * POST /api/newsletter/unsubscribe?token=…  Takes the address off the list. Two callers:
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
  const db = getDb();
  let outcome: "done" | "already" | "invalid" = "invalid";
  if (db) {
    try {
      outcome = await unsubscribe(db, url.searchParams.get("token") ?? "");
    } catch (err) {
      log.error("newsletter.unsubscribe_failed", { err });
      return new Response("Try again later", { status: 503, headers: NO_STORE });
    }
  }
  if (oneClick) return new Response(outcome === "invalid" ? "Unknown link" : "Unsubscribed", { status: outcome === "invalid" ? 404 : 200, headers: NO_STORE });
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: outcome === "invalid" ? "/newsletter/invalid" : "/newsletter/unsubscribed" } });
}

/** A GET is someone following the raw link: show them the page with the button. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `/newsletter/unsubscribe?token=${encodeURIComponent(token)}` } });
}
