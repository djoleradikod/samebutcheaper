import "server-only";
import { createHash } from "node:crypto";

/** Request facts we log, without storing IP addresses. */
export function visitorFrom(headers: Headers) {
  const ua = headers.get("user-agent") ?? "";
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const isBot = /bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(ua);
  // Daily-rotating, salted hash: counts unique visitors without keeping IPs.
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.CLICK_HASH_SALT ?? "sbc";
  const hash = createHash("sha256").update(`${salt}:${day}:${ip}:${ua}`).digest("hex");
  return { hash, isBot, ip };
}
