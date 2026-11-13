import { getDb } from "@/db";
import { log } from "@/lib/log";
import { confirmByToken, isToken } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const to = (path: string) => new Response(null, { status: 303, headers: { ...NO_STORE, Location: path } });

const DONE = { letter: "/newsletter/confirmed", watch: "/newsletter/confirmed/watch", wish: "/newsletter/confirmed/wish" } as const;

/**
 * POST /api/newsletter/confirm, form field `t`: the button on /newsletter/confirm. Switches on what the emailed
 * secret was for, once (the secret is cleared as it is used), and sends the reader to a page that says so.
 * The secret travels in the body, not the address, so it stays out of access logs.
 */
export async function POST(request: Request) {
  if (!rateLimit("tokens", visitorFrom(request.headers).key, LIMITS.tokens).ok) {
    return new Response("Too many requests", { status: 429, headers: { ...NO_STORE, "Retry-After": "600" } });
  }
  let secret = "";
  try {
    secret = String((await request.formData()).get("t") ?? "");
  } catch {
    // No body, or not a form.
  }
  const db = getDb();
  if (!db || !isToken(secret)) return to("/newsletter/invalid");
  try {
    const result = await confirmByToken(db, secret, new Date());
    return to(result.outcome === "done" ? DONE[result.kind] : "/newsletter/invalid");
  } catch (err) {
    log.error("newsletter.confirm_failed", { err });
    return new Response("Try again later", { status: 503, headers: NO_STORE });
  }
}

/**
 * A GET never confirms anything: mail scanners (Microsoft Safe Links and others) open every link in an email. An
 * old-style link, or anyone opening this address, is sent to the page with the button.
 */
export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t");
  return to(t && isToken(t) ? `/newsletter/confirm?t=${encodeURIComponent(t)}` : "/newsletter/invalid");
}
