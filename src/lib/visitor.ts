import { createHash } from "node:crypto";

/**
 * The visitor's address. Behind Caddy alone that is X-Forwarded-For, which Caddy overwrites with the address it
 * saw. Behind a CDN, Caddy sees the CDN, so name the CDN's own header in CLIENT_IP_HEADER (Cloudflare:
 * "cf-connecting-ip"). Only set it when the server can't be reached around the CDN, since a visitor could
 * otherwise send the header themselves.
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  const named = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const fromNamed = named ? headers.get(named)?.split(",")[0].trim() : "";
  const ip = fromNamed || (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-f:.]{3,45}$/i.test(ip) ? ip : "";
}

const BOT =
  /bot\b|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|axios\/|node-fetch|undici|libwww|httpclient|scrapy|ahrefs|semrush|dataforseo|bytespider|gptbot|claudebot|perplexity|ccbot/i;

/** True for crawlers, link checkers and scripts, going by the user agent. An empty one counts too. */
export function isBotAgent(ua: string) {
  return !ua.trim() || BOT.test(ua);
}

/** True when a browser is fetching ahead of a click (prefetch or prerender), not following a link. */
export function isPrefetch(headers: Headers) {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-moz") ?? ""}`;
  return /prefetch|prerender/i.test(purpose) || headers.has("next-router-prefetch");
}

/** Request facts we log, without storing IP addresses. */
export function visitorFrom(headers: Headers) {
  const ua = headers.get("user-agent") ?? "";
  const ip = clientIp(headers);
  // Daily-rotating, salted hash: counts unique visitors without keeping IPs.
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.CLICK_HASH_SALT ?? "sbc";
  const hash = createHash("sha256").update(`${salt}:${day}:${ip}:${ua}`).digest("hex");
  return { hash, isBot: isBotAgent(ua), ip, /** What to rate-limit on: the address, else the daily hash. */ key: ip || hash };
}
