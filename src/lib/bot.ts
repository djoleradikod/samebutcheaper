/** Pure, so the browser can use it too (src/lib/client/shopper-country.ts). src/lib/visitor.ts re-exports it. */
const BOT =
  /bot\b|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python-requests|python-urllib|go-http-client|okhttp|axios\/|node-fetch|undici|libwww|httpclient|scrapy|ahrefs|semrush|dataforseo|bytespider|gptbot|claudebot|perplexity|ccbot/i;

/** True for crawlers, link checkers and scripts, going by the user agent. An empty one counts too. */
export function isBotAgent(ua: string) {
  return !ua.trim() || BOT.test(ua);
}
