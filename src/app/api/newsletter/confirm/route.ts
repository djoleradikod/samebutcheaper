import { getDb } from "@/db";
import { log } from "@/lib/log";
import { confirmSubscription } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

/**
 * GET /api/newsletter/confirm?token=…  The link in the confirmation email. Confirms the sign-up and sends the
 * reader to a page that says so. Confirming twice is harmless, so a mail scanner that opens the link first
 * doesn't break it for the person.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = (path: string) =>
    new Response(null, { status: 303, headers: { Location: path, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (!rateLimit("tokens", visitorFrom(request.headers).key, LIMITS.tokens).ok) {
    return new Response("Too many requests", { status: 429, headers: { "Retry-After": "600" } });
  }
  const db = getDb();
  if (!db) return to("/newsletter/invalid");
  try {
    const outcome = await confirmSubscription(db, url.searchParams.get("token") ?? "");
    return to(outcome === "invalid" ? "/newsletter/invalid" : "/newsletter/confirmed");
  } catch (err) {
    log.error("newsletter.confirm_failed", { err });
    return to("/newsletter/invalid");
  }
}
