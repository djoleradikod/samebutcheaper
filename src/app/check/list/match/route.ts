import { after } from "next/server";
import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { countMisses } from "@/lib/receipt/misses";
import { matchReceipt } from "@/lib/receipt/match";
import { MAX_TEXT, parseReceipt } from "@/lib/receipt/parse";
import type { CheckResult, ResultLine } from "@/lib/receipt/types";
import { indexFor, swapViews } from "@/lib/receipt/view";
import { getCountry, getLocal } from "@/lib/server-country";
import { isPrefixedCountry } from "@/lib/country-url";
import { getT, isLang } from "@/lib/i18n";
import { localFor } from "@/lib/localize";
import { visitorFrom } from "@/lib/visitor";
import { normaliseQuery } from "@/lib/wanted";

/**
 * POST /check/list/match?lang=de&country=DE  {"text": "..."}  A pasted shopping list or receipt, matched against the swaps the shopper's
 * country lists. The text is read for this request only: it is not stored, and the log line carries counts only.
 * Lines with nothing on file are counted in the most-wanted log by their cleaned product name alone.
 * A prefixed page (/de/check/list) names its language and fixed country in the query, so the answer is in its words
 * and for the country it shows; without them it's English, for the shopper's own country.
 */
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const query = new URL(request.url).searchParams;
  const asked = query.get("lang");
  const lang = isLang(asked) ? asked : "en";
  const t = getT(lang);
  const visitor = visitorFrom(request.headers);
  if (visitor.isBot) return fail(403, t("listErrors.browser"));
  if (!rateLimit("receipts", visitor.key, LIMITS.receipts).ok) {
    return fail(429, t("listErrors.tooMany"));
  }
  // Refuse an oversized paste from its declared length, before reading any of it.
  if (Number(request.headers.get("content-length")) > MAX_TEXT * 4 + 1024) {
    return fail(413, t("listErrors.tooLong", MAX_TEXT));
  }
  let text: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_TEXT * 4 + 1024) return fail(413, t("listErrors.tooLong", MAX_TEXT));
    text = (JSON.parse(body) as { text?: unknown }).text;
  } catch {
    return fail(400, t("listErrors.sendText"));
  }
  if (typeof text !== "string" || !text.trim()) return fail(400, t("listErrors.empty"));

  // A prefixed page's country beats the cookie, as it does for the page itself (a prefixed URL never shows other countries' swaps).
  const fixed = query.get("country");
  const [local, country] = isPrefixedCountry(fixed)
    ? [localFor(fixed, false, lang), fixed]
    : await Promise.all([getLocal(), getCountry()]);
  const parsed = parseReceipt(text);
  const { lines, noise } = matchReceipt(parsed, indexFor(local));

  const result: CheckResult = {
    lines: lines.map(
      // A "maybe" or a "which one" carries it too: if the shopper answers No or None of these, the page counts it (POST /api/wanted).
      ({ query, ...line }): ResultLine =>
        line.status === "none" || line.status === "maybe" || line.status === "choose" ? { ...line, counted: normaliseQuery(query) } : line,
    ),
    noise,
    swaps: swapViews(lines.flatMap((l) => (l.status === "swap" || l.status === "maybe" ? [l.slug] : l.status === "choose" ? l.slugs : [])), lang),
  };

  const tally = (s: ResultLine["status"]) => lines.filter((l) => l.status === s).length;
  log.info("receipt.checked", {
    country,
    truncated: text.length > MAX_TEXT,
    lines: parsed.length,
    noise,
    swaps: tally("swap"),
    maybe: tally("maybe"),
    choose: tally("choose"),
    none: tally("none"),
    own: tally("own"),
  });
  const misses = lines.filter((l) => l.status === "none").map((l) => l.query);
  const headers = new Headers(request.headers);
  if (misses.length) after(() => countMisses(misses, headers, country));

  return Response.json({ ok: true, ...result }, { headers: NO_STORE });
}
