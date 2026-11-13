import { after } from "next/server";
import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { countMisses } from "@/lib/receipt/misses";
import { matchReceipt } from "@/lib/receipt/match";
import { MAX_TEXT, parseReceipt } from "@/lib/receipt/parse";
import type { CheckResult, ResultLine } from "@/lib/receipt/types";
import { indexFor, swapViews } from "@/lib/receipt/view";
import { getCountry, getLocal } from "@/lib/server-country";
import { visitorFrom } from "@/lib/visitor";
import { normaliseQuery } from "@/lib/wanted";

/**
 * POST /check/list/match  {"text": "..."}  A pasted shopping list or receipt, matched against the swaps the shopper's
 * country lists. The text is read for this request only: it is not stored, and the log line carries counts only.
 * Lines with nothing on file are counted in the most-wanted log by their cleaned product name alone.
 */
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const visitor = visitorFrom(request.headers);
  if (visitor.isBot) return fail(403, "This works in a browser.");
  if (!rateLimit("receipts", visitor.key, LIMITS.receipts).ok) {
    return fail(429, "That's a lot of lists in a short time. Give it a few minutes, then try again.");
  }
  // Refuse an oversized paste from its declared length, before reading any of it.
  if (Number(request.headers.get("content-length")) > MAX_TEXT * 4 + 1024) {
    return fail(413, `That's longer than we read in one go. Paste up to ${MAX_TEXT.toLocaleString("en-GB")} characters.`);
  }
  let text: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_TEXT * 4 + 1024) return fail(413, `That's longer than we read in one go. Paste up to ${MAX_TEXT.toLocaleString("en-GB")} characters.`);
    text = (JSON.parse(body) as { text?: unknown }).text;
  } catch {
    return fail(400, "Send the list as text.");
  }
  if (typeof text !== "string" || !text.trim()) return fail(400, "Paste a list or a receipt first.");

  const [local, country] = await Promise.all([getLocal(), getCountry()]);
  const parsed = parseReceipt(text);
  const { lines, noise } = matchReceipt(parsed, indexFor(local));

  const result: CheckResult = {
    lines: lines.map(
      ({ query, ...line }): ResultLine => (line.status === "none" ? { ...line, counted: normaliseQuery(query) } : line),
    ),
    noise,
    swaps: swapViews(lines.flatMap((l) => (l.status === "swap" || l.status === "maybe" ? [l.slug] : []))),
  };

  const tally = (s: ResultLine["status"]) => lines.filter((l) => l.status === s).length;
  log.info("receipt.checked", {
    country,
    truncated: text.length > MAX_TEXT,
    lines: parsed.length,
    noise,
    swaps: tally("swap"),
    maybe: tally("maybe"),
    none: tally("none"),
    own: tally("own"),
  });
  const misses = lines.filter((l) => l.status === "none").map((l) => l.query);
  const headers = new Headers(request.headers);
  if (misses.length) after(() => countMisses(misses, headers, country));

  return Response.json({ ok: true, ...result }, { headers: NO_STORE });
}
