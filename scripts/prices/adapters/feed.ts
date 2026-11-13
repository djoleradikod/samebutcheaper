/**
 * Affiliate product feeds: price files a merchant publishes for its affiliates, which the network's publisher
 * agreement lets us use. This is how stores whose terms bar reading their pages are kept current, and how their
 * links start earning. The owner's guide is docs/feeds.md; the rules are in docs/prices.md.
 *
 * PRICE_FEED_URLS lists feeds, separated by new lines or commas, each as
 *
 *   [network:]<retailer>@<market>=<url or local path>
 *
 * e.g. `awin:zooplus@DE=https://productdata.awin.com/...`. network is awin (the default, as before), impact,
 * cj, rakuten, flexoffers, or generic (also csv, json) for any other network read through a column map. The
 * retailer and market say whose prices these are: a row only ever prices a record side at that retailer in
 * that market. Feed URLs carry keys: they're never printed. `user:password@` in a URL is sent as Basic auth.
 *
 * PRICE_FEED_COLUMNS (optional) maps a feed's columns where a network's defaults are wrong or for a generic
 * feed: one line per feed, `<retailer>@<market>: price=Sale Price; gtin=EAN|UPC; link=Tracking URL; ...`
 * (formats.ts, MAP_FIELDS).
 *
 * Each feed is streamed (feeds/stream.ts), mapped onto one row shape (feeds/formats.ts) and matched
 * conservatively (feeds/match.ts). NO REAL FEED HAS BEEN READ: every format is tested against synthetic files
 * written from the networks' documentation (scripts/prices/fixtures/feeds/).
 */
import { MARKETS, RETAILERS, type MarketCode } from "../../../src/lib/markets";
import { feedLinkNetwork } from "../../../src/lib/feed-links";
import { FORMATS, mapFor, missingFields, NETWORK_ALIASES, parseColumnMaps, rowFromMap, type ColumnMap, type FeedFormat, type RawRow } from "../feeds/formats";
import { FeedMatcher, gtin14, normalUrl, type FeedMatch } from "../feeds/match";
import { parsePack, type FeedRow } from "../feeds/row";
import { csvRecords, jsonItems, openFeed, textOf } from "../feeds/stream";
import type { PricedRecord } from "../records";
import { addDays, type AdapterContext, type AdapterResult, type Candidate, type PriceAdapter } from "./types";

export { gtin14, normalUrl };

/* ------------------------------------------------------------------ config */

export type FeedConfig = { network: string; retailer: string; market: MarketCode; location: string; label: string };

export function parseFeedConfig(value: string | undefined): { feeds: FeedConfig[]; problems: string[] } {
  const feeds: FeedConfig[] = [];
  const problems: string[] = [];
  const entries = (value ?? "")
    .split(/\n+|,(?=\s*(?:[a-z]+:)?[a-z0-9-]+@[A-Z]{2}=)/)
    .map((s) => s.trim())
    .filter(Boolean);
  entries.forEach((entry, i) => {
    const m = /^(?:([a-z]+):)?([a-z0-9-]+)@([A-Z]{2})=(.+)$/.exec(entry);
    const label = `feed ${i + 1}`;
    if (!m) {
      problems.push(`${label}: expected [network:]retailer@MARKET=url`);
      return;
    }
    const [, given = "awin", retailer, market, location] = m;
    const network = NETWORK_ALIASES[given] ?? given;
    if (!FORMATS[network]) problems.push(`${label}: unknown network ${given} (known: ${Object.keys(FORMATS).join(", ")})`);
    else if (!(RETAILERS as readonly string[]).includes(retailer) || retailer === "other") problems.push(`${label}: unknown retailer ${retailer}`);
    else if (!(market in MARKETS)) problems.push(`${label}: unknown market ${market}`);
    else feeds.push({ network, retailer, market: market as MarketCode, location, label: `${network}:${retailer}@${market}` });
  });
  return { feeds, problems };
}

/* --------------------------------------------------------------- reading */

/** Headers a network needs beyond what the URL carries. */
function headersFor(feed: FeedConfig, env: AdapterContext["env"]): Record<string, string> {
  if (feed.network === "impact") return { Accept: "application/json" };
  // Assumed from FlexOffers' publisher tools page (the key is created under Data Feeds > Web Services > API Keys).
  if (feed.network === "flexoffers" && env.FLEXOFFERS_API_KEY) return { apiKey: env.FLEXOFFERS_API_KEY, Accept: "application/json" };
  return {};
}

/** Impact's API lists items a page at a time: ask page after page until one comes back short. */
function pagesOf(location: string): ((page: number) => string) | null {
  try {
    const u = new URL(location);
    if (!/(^|\.)api\.impact\.com$/.test(u.hostname) || !/\/(Items|ItemSearch)(\.json)?$/i.test(u.pathname)) return null;
    return (page) => {
      const p = new URL(location);
      if (!p.searchParams.has("PageSize")) p.searchParams.set("PageSize", "1000");
      p.searchParams.set("Page", String(page));
      return p.toString();
    };
  } catch {
    return null;
  }
}

function stringify(o: Record<string, unknown>): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    out[k.trim().toLowerCase()] = typeof v === "object" ? (Array.isArray(v) && v.every((x) => typeof x !== "object") ? v.join(" ") : "") : String(v);
  }
  return out;
}

/** Raw rows of one file or response, streamed. */
async function* rawRows(chunks: AsyncIterable<string>, format: FeedFormat, onFileDate: (day: string | null) => void): AsyncGenerator<RawRow> {
  // Peek at the first characters to tell JSON from text when the format allows both.
  const it = chunks[Symbol.asyncIterator]();
  const first = await it.next();
  if (first.done) return;
  const rest = (async function* () {
    yield first.value;
    for (;;) {
      const r = await it.next();
      if (r.done) return;
      yield r.value;
    }
  })();
  const json = format.parse === "json" || (format.parse === "auto" && /^\s*[[{]/.test(first.value));
  if (json) {
    for await (const item of jsonItems(rest)) yield stringify(item);
    return;
  }
  let header: string[] | null = format.positional ?? null;
  for await (const rec of csvRecords(rest)) {
    if (format.skipFirstField?.test(rec[0]?.trim() ?? "")) {
      if (rec[0].trim() === "HDR") onFileDate(isoFromHdr(rec[3]));
      continue;
    }
    if (!header) {
      header = rec.map((h) => h.trim().toLowerCase());
      continue;
    }
    const row: RawRow = {};
    header.forEach((h, i) => (row[h] = (rec[i] ?? "").trim()));
    yield row;
  }
}

function isoFromHdr(s: string | undefined) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s?.trim() ?? "");
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

/** Every row of a feed in our shape, one at a time, never the whole feed. */
export async function* feedRows(feed: FeedConfig, ctx: AdapterContext, override?: ColumnMap): AsyncGenerator<FeedRow> {
  const format = FORMATS[feed.network];
  const map = mapFor(format, override);
  const headers = headersFor(feed, ctx.env);
  const page = pagesOf(feed.location);
  const fetcher: AdapterContext["fetch"] = (url, init) => ctx.fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...headers } });
  let fileDate: string | null = null;
  const setDate = (d: string | null) => (fileDate = d);
  if (!page) {
    for await (const raw of rawRows(textOf(await openFeed(feed.location, fetcher)), format, setDate)) yield rowFromMap(raw, map, feed, fileDate);
    return;
  }
  const size = Number(new URL(page(1)).searchParams.get("PageSize")) || 1000;
  for (let n = 1; n <= 1000; n++) {
    let count = 0;
    for await (const raw of rawRows(textOf(await openFeed(page(n), fetcher)), format, setDate)) {
      count++;
      yield rowFromMap(raw, map, feed, fileDate);
    }
    if (count < size) return;
    if (n > 1) await ctx.sleep(250);
  }
}

/* ---------------------------------------------------------------- matching */

/** Why a matched row can't be used at all, or null. An out-of-stock row is usable: it's logged as such. */
export function feedRejectReason(m: Pick<FeedMatch, "row" | "record">, today: string, maxAgeDays: number): string | null {
  const currency = m.row.currency ?? m.record.currency;
  if (m.row.price === null) return "no price";
  if (currency !== m.record.currency) return `in ${currency}, not ${m.record.currency}`;
  if (m.row.updated && m.row.updated < addDays(today, -maxAgeDays)) return `not updated in ${maxAgeDays} days`;
  return null;
}

const BY_WORDS = { gtin: "barcode", id: "store product number", name: "brand, name and pack" } as const;

export function feedCandidate(m: FeedMatch, feed: FeedConfig, today: string): Candidate {
  const link = m.row.deepLink && feedLinkNetwork(m.row.deepLink) ? m.row.deepLink : undefined;
  const page = m.row.productUrl ?? m.row.deepLink;
  return {
    record: m.record.slug,
    side: m.side.side,
    price: m.row.price!,
    currency: m.row.currency ?? m.record.currency,
    // The feed is the merchant's own price list, read today. Rows not updated within the limit were rejected above.
    seen: today,
    source: `feed:${feed.network}`,
    url: page && /^https?:/.test(page) ? page : m.side.url,
    method: "feed",
    note: `Matched by ${BY_WORDS[m.by]} in the ${feed.label} feed${m.row.merchant ? ` (merchant ${m.row.merchant})` : ""}`,
    pack: parsePack(m.row.packText) ?? parsePack(m.row.name),
    ...(link ? { link } : {}),
    ...(m.row.inStock === false ? { stock: "out" as const } : m.row.inStock === true ? { stock: "in" as const } : {}),
    ...(m.by === "name" ? { needsReview: `matched by brand, name and pack only ("${m.row.name.slice(0, 80)}"), so a person must confirm it is the same product` } : {}),
  };
}

/** What one feed did this run, for the report, /admin and the readiness check. No URL ever goes in here. */
export type FeedStats = {
  label: string;
  network: string;
  retailer: string;
  market: string;
  /** Record sides at this retailer in this market. */
  sides: number;
  rows: number;
  matched: { gtin: number; id: number; name: number };
  /** Matches that became candidates (price, currency and age fine). */
  usable: number;
  outOfStock: number;
  error: string | null;
};

export async function collectFeed(feed: FeedConfig, records: PricedRecord[], ctx: AdapterContext, override?: ColumnMap) {
  const maxAge = Number(ctx.env.PRICE_FEED_MAX_AGE_DAYS) || 30;
  const matcher = new FeedMatcher(records, feed);
  const stats: FeedStats = { label: feed.label, network: feed.network, retailer: feed.retailer, market: feed.market, sides: matcher.sideCount, rows: 0, matched: { gtin: 0, id: 0, name: 0 }, usable: 0, outOfStock: 0, error: null };
  const notes: string[] = [];
  const candidates: Candidate[] = [];
  const missing = missingFields(mapFor(FORMATS[feed.network], override));
  if (missing.length) {
    stats.error = `no column named for ${missing.join(", ")}: set them in PRICE_FEED_COLUMNS`;
    return { candidates, notes: [`feed: ${feed.label}: ${stats.error}`], stats };
  }
  try {
    for await (const row of feedRows(feed, ctx, override)) matcher.add(row);
  } catch (err) {
    stats.error = `could not be read (${err instanceof Error ? err.message : String(err)})`;
    return { candidates, notes: [`feed: ${feed.label} ${stats.error}`], stats };
  }
  stats.rows = matcher.rows;
  const { matches, ambiguous } = matcher.result();
  const rejected = new Map<string, number>();
  for (const m of matches) {
    stats.matched[m.by]++;
    const why = feedRejectReason(m, ctx.today, maxAge);
    if (why) {
      rejected.set(why.replace(/ in .*|, not .*/, ""), (rejected.get(why.replace(/ in .*|, not .*/, "")) ?? 0) + 1);
      continue;
    }
    const c = feedCandidate(m, feed, ctx.today);
    if (c.stock === "out") stats.outOfStock++;
    candidates.push(c);
    stats.usable++;
  }
  notes.push(
    `feed: ${feed.label}: ${stats.rows} rows, ${matches.length} of ${stats.sides} record sides matched (${stats.matched.gtin} by barcode, ${stats.matched.id} by store number, ${stats.matched.name} by name for review), ${stats.usable} usable${stats.outOfStock ? `, ${stats.outOfStock} out of stock` : ""}`,
  );
  for (const [why, n] of rejected) notes.push(`feed: ${feed.label}: ${n} matched row(s) skipped: ${why}`);
  for (const a of [...ambiguous, ...matcher.conflicts].slice(0, 10)) notes.push(`feed: ${feed.label}: ${a}`);
  return { candidates, notes, stats };
}

export const feedAdapter: PriceAdapter & { lastStats?: FeedStats[] } = {
  id: "feed",
  licence: "Affiliate product feeds under each network's publisher agreement (Awin, Impact, CJ, Rakuten, FlexOffers, others by column map)",
  async collect(records: PricedRecord[], ctx: AdapterContext): Promise<AdapterResult> {
    const { feeds, problems } = parseFeedConfig(ctx.env.PRICE_FEED_URLS);
    const { maps, problems: mapProblems } = parseColumnMaps(ctx.env.PRICE_FEED_COLUMNS);
    const notes = [...problems, ...mapProblems].map((p) => `feed: ${p}`);
    const stats: FeedStats[] = [];
    if (!feeds.length) return { candidates: [], notes: [...notes, "feed: no feeds configured (PRICE_FEED_URLS), skipped"], feedStats: stats };
    const candidates: Candidate[] = [];
    for (const feed of feeds) {
      const out = await collectFeed(feed, records, ctx, maps.get(`${feed.retailer}@${feed.market}`));
      candidates.push(...out.candidates);
      notes.push(...out.notes);
      stats.push(out.stats);
    }
    return { candidates, notes, feedStats: stats };
  },
};

/* -------------------------------------------- kept for older callers/tests */

/** RFC 4180 CSV of a whole string, for small files (manual checks). Feeds use the streaming csvRecords. */
export function parseCsv(text: string): Record<string, string>[] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.slice(0, body.indexOf("\n") === -1 ? body.length : body.indexOf("\n"));
  const delimiter = [",", "|", "\t", ";"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...data] = rows.filter((r) => r.some((f) => f.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return data.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])));
}
