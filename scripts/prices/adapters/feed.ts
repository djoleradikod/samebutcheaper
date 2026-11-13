/**
 * Affiliate product feeds: price files a merchant publishes for its affiliates, which the affiliate
 * agreement lets us use. This is how stores that bar scraping can still be kept current.
 *
 * PRICE_FEED_URLS lists feeds, separated by new lines or commas, each as
 *
 *   [network:]<retailer>@<market>=<url or local path>
 *
 * e.g. `awin:boots@GB=https://productdata.awin.com/...`. The network defaults to awin. The retailer and
 * market say whose prices these are: a row only updates a record side priced at that retailer in that
 * market, so one store's price can never land on another's. Feed URLs carry API keys: they're never printed.
 *
 * Matching: by barcode first (GTIN, EAN or UPC, compared as GTIN-14), then by the merchant's own product URL.
 */
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { MARKETS, RETAILERS, type MarketCode } from "../../../src/lib/markets";
import type { PricedRecord, PricedSide } from "../records";
import { addDays, type AdapterContext, type AdapterResult, type Candidate, type PriceAdapter } from "./types";

/* ------------------------------------------------------------------ config */

export type FeedConfig = { network: string; retailer: string; market: MarketCode; location: string; label: string };

export function parseFeedConfig(value: string | undefined): { feeds: FeedConfig[]; problems: string[] } {
  const feeds: FeedConfig[] = [];
  const problems: string[] = [];
  const entries = (value ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  entries.forEach((entry, i) => {
    const m = /^(?:([a-z]+):)?([a-z0-9-]+)@([A-Z]{2})=(.+)$/.exec(entry);
    const label = `feed ${i + 1}`;
    if (!m) {
      problems.push(`${label}: expected [network:]retailer@MARKET=url`);
      return;
    }
    const [, network = "awin", retailer, market, location] = m;
    if (!FEED_FORMATS[network]) problems.push(`${label}: unknown network ${network} (known: ${Object.keys(FEED_FORMATS).join(", ")})`);
    else if (!(RETAILERS as readonly string[]).includes(retailer) || retailer === "other") problems.push(`${label}: unknown retailer ${retailer}`);
    else if (!(market in MARKETS)) problems.push(`${label}: unknown market ${market}`);
    else feeds.push({ network, retailer, market: market as MarketCode, location, label: `${network}:${retailer}@${market}` });
  });
  return { feeds, problems };
}

/* --------------------------------------------------------------------- CSV */

/** RFC 4180 CSV: quoted fields, doubled quotes, new lines inside quotes. The delimiter is guessed from the header. */
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

/* ----------------------------------------------------------------- formats */

/** One feed row in our terms. */
export type FeedRow = {
  gtins: string[];
  url: string | null;
  price: number | null;
  currency: string | null;
  inStock: boolean | null;
  merchant: string | null;
  updated: string | null;
  name: string;
};

/**
 * Awin's publisher feed (Create-a-Feed CSV). Column names from Awin's documentation:
 * search_price, merchant_deep_link, aw_product_id, merchant_product_id, currency, ean
 * (help.awin.com, "Telco Data Feeds - Mobile Phones Standard Fields"), and product_GTIN, upc, in_stock,
 * last_updated, merchant_id, product_name (the "PM Feed Column Descriptions" sheet). The advertiser-side
 * names `price` and `deep_link` are read too, for a merchant's own export.
 */
export function awinRow(r: Record<string, string>): FeedRow {
  const num = (s: string | undefined) => {
    if (!s) return null;
    const n = Number(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const stock = r.in_stock ?? "";
  return {
    gtins: [r.product_GTIN, r.ean, r.upc].filter((g): g is string => Boolean(g && /^\d{8,14}$/.test(g))),
    url: r.merchant_deep_link || r.deep_link || null,
    price: num(r.search_price) ?? num(r.price),
    currency: r.currency ? r.currency.toUpperCase() : null,
    inStock: stock === "" ? null : stock === "1" || stock.toLowerCase() === "true",
    merchant: r.merchant_id || r.merchant_name || null,
    updated: /^\d{4}-\d{2}-\d{2}/.test(r.last_updated ?? "") ? r.last_updated.slice(0, 10) : null,
    name: r.product_name ?? "",
  };
}

/** Add a network by writing its row reader here (Impact and CJ next). */
export const FEED_FORMATS: Record<string, (r: Record<string, string>) => FeedRow> = { awin: awinRow };

/* ---------------------------------------------------------------- matching */

/** GTIN-8, UPC-A (12), EAN-13 and GTIN-14 of one product are the same number padded to 14. */
export function gtin14(code: string) {
  return code.replace(/\D/g, "").padStart(14, "0");
}

/** A product URL without tracking: lower-case host without www, no query or fragment, no trailing slash. */
export function normalUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

export type FeedMatch = { record: PricedRecord; side: PricedSide; row: FeedRow; by: "gtin" | "url" };

/** Rows matched to the record sides this feed may price: same retailer, same market. */
export function matchFeed(rows: FeedRow[], records: PricedRecord[], feed: Pick<FeedConfig, "retailer" | "market">): FeedMatch[] {
  const byGtin = new Map<string, FeedRow>();
  const byUrl = new Map<string, FeedRow>();
  for (const row of rows) {
    for (const g of row.gtins) if (!byGtin.has(gtin14(g))) byGtin.set(gtin14(g), row);
    const u = row.url && normalUrl(row.url);
    if (u && !byUrl.has(u)) byUrl.set(u, row);
  }
  const out: FeedMatch[] = [];
  for (const record of records) {
    if (record.market !== feed.market) continue;
    for (const side of record.sides) {
      if (side.retailer !== feed.retailer) continue;
      const g = side.gtin ? byGtin.get(gtin14(side.gtin)) : undefined;
      if (g) {
        out.push({ record, side, row: g, by: "gtin" });
        continue;
      }
      const u = normalUrl(side.url);
      const r = u ? byUrl.get(u) : undefined;
      if (r) out.push({ record, side, row: r, by: "url" });
    }
  }
  return out;
}

/** Why a matched row can't price this side, or null. */
export function feedRejectReason(m: FeedMatch, today: string, maxAgeDays: number): string | null {
  const currency = m.row.currency ?? m.record.currency;
  if (m.row.price === null) return "no price";
  if (currency !== m.record.currency) return `in ${currency}, not ${m.record.currency}`;
  if (m.row.inStock === false) return "out of stock";
  if (m.row.updated && m.row.updated < addDays(today, -maxAgeDays)) return `not updated in ${maxAgeDays} days`;
  return null;
}

export function feedCandidate(m: FeedMatch, feed: FeedConfig, today: string): Candidate {
  return {
    record: m.record.slug,
    side: m.side.side,
    price: m.row.price!,
    currency: m.row.currency ?? m.record.currency,
    // The feed is the merchant's live price list, read today. Rows not updated within the limit were rejected above.
    seen: today,
    source: `${feed.network}:${m.row.merchant ?? feed.retailer}`,
    url: m.row.url && /^https?:/.test(m.row.url) ? m.row.url : m.side.url,
    method: "feed",
    note: `Matched by ${m.by === "gtin" ? "barcode" : "product URL"} in the ${feed.label} feed`,
  };
}

/* ------------------------------------------------------------------- fetch */

async function readFeed(feed: FeedConfig, ctx: AdapterContext): Promise<string> {
  let bytes: Buffer;
  if (/^https?:\/\//.test(feed.location)) {
    const res = await ctx.fetch(feed.location);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } else {
    if (!existsSync(feed.location)) throw new Error("file not found");
    bytes = readFileSync(feed.location);
  }
  // Awin offers gzip; zip isn't supported, choose gzip or none in Create-a-Feed.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) throw new Error("zip compression isn't supported, choose gzip or none");
  return bytes.toString("utf8");
}

export const feedAdapter: PriceAdapter = {
  id: "feed",
  licence: "Affiliate product feeds under each network's publisher agreement (Awin first)",
  async collect(records: PricedRecord[], ctx: AdapterContext): Promise<AdapterResult> {
    const { feeds, problems } = parseFeedConfig(ctx.env.PRICE_FEED_URLS);
    const notes = problems.map((p) => `feed: ${p}`);
    if (!feeds.length) return { candidates: [], notes: [...notes, "feed: no feeds configured (PRICE_FEED_URLS), skipped"] };
    const maxAge = Number(ctx.env.PRICE_FEED_MAX_AGE_DAYS) || 30;
    const candidates: Candidate[] = [];
    for (const feed of feeds) {
      let rows: FeedRow[];
      try {
        rows = parseCsv(await readFeed(feed, ctx)).map(FEED_FORMATS[feed.network]);
      } catch (err) {
        notes.push(`feed: ${feed.label} could not be read (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      const matches = matchFeed(rows, records, feed);
      let used = 0;
      for (const m of matches) {
        if (feedRejectReason(m, ctx.today, maxAge) !== null) continue;
        candidates.push(feedCandidate(m, feed, ctx.today));
        used++;
      }
      notes.push(`feed: ${feed.label}: ${rows.length} rows, ${matches.length} matched a record, ${used} usable`);
    }
    return { candidates, notes };
  },
};
