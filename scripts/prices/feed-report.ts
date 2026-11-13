/**
 * Match rates per store against the synthetic feeds built from real catalogue records
 * (fixtures/make-feed-fixtures.ts). Says how many of each store's record sides a feed could price by barcode or
 * store number (applied automatically), how many only by name (sent to review), how many not at all, and whether
 * anything matched the wrong side (must be none). These are rates on SYNTHETIC feeds: a real feed may name
 * products differently, leave barcodes out, or number them differently from the store's URLs.
 *
 *   npx tsx scripts/prices/feed-report.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { feedRows, parseFeedConfig } from "./adapters/feed";
import type { AdapterContext } from "./adapters/types";
import { CATALOGUE_FIXTURES, FIXTURE_STORES } from "./fixtures/make-feed-fixtures";
import { FeedMatcher, gtin14, normalUrl } from "./feeds/match";
import { parseCsv } from "./adapters/feed";
import { isMain } from "./observations";
import { loadRecords, type PricedRecord } from "./records";

export type StoreRate = { store: string; network: string; sides: number; withGtin: number; withNumber: number; gtin: number; id: number; name: number; none: number; wrong: string[] };

const ctx: AdapterContext = { today: "2026-11-13", env: {}, sleep: async () => {}, fetch: async () => { throw new Error("no network in the report"); } };

function truths(path: string): Map<string, string> {
  const text = readFileSync(path, "utf8");
  const rows: Record<string, unknown>[] = path.endsWith(".csv") ? parseCsv(text) : ((j) => (Array.isArray(j) ? j : j.Items))(JSON.parse(text));
  const out = new Map<string, string>();
  for (const r of rows) {
    const name = String(r.product_name ?? r.Name ?? r.name ?? "");
    const sku = String(r.merchant_product_id ?? r.CatalogItemId ?? r.sku ?? "");
    out.set(`${name}|${sku}`, String(r.x_fixture_truth));
  }
  return out;
}

export async function matchRates(records: PricedRecord[] = loadRecords()): Promise<StoreRate[]> {
  const out: StoreRate[] = [];
  for (const s of FIXTURE_STORES) {
    const path = join(CATALOGUE_FIXTURES, s.file);
    const feed = parseFeedConfig(`${s.network}:${s.retailer}@${s.market}=${path}`).feeds[0];
    const truth = truths(path);
    const matcher = new FeedMatcher(records, feed);
    const rowTruth = new Map<object, string>();
    for await (const row of feedRows(feed, ctx)) {
      rowTruth.set(row, truth.get(`${row.name}|${row.skus[0] ?? ""}`) ?? "?");
      matcher.add(row);
    }
    const { matches } = matcher.result();
    const sides = records.filter((r) => r.market === s.market).flatMap((r) => r.sides.filter((x) => x.retailer === s.retailer).map((x) => ({ r, x })));
    const rate: StoreRate = {
      store: `${s.retailer}@${s.market}`,
      network: s.network,
      sides: sides.length,
      withGtin: sides.filter(({ x }) => x.gtin).length,
      withNumber: 0,
      gtin: 0,
      id: 0,
      name: 0,
      none: 0,
      wrong: [],
    };
    // Several records can use one product (a swap and a kit piece, two swaps against one brand): a row made from
    // any of them is right for all of them. Same barcode, or the same product page, is the same product.
    const sideOf = new Map<string, PricedRecord["sides"][number]>(records.flatMap((r) => r.sides.map((x) => [`${r.slug}|${x.side}`, x] as const)));
    const same = (a: string | undefined, b: PricedRecord["sides"][number]) => {
      const t = a ? sideOf.get(a) : undefined;
      if (!t) return false;
      return (t.gtin && b.gtin && gtin14(t.gtin) === gtin14(b.gtin)) || normalUrl(t.url) === normalUrl(b.url) && t.url.split("?activeVariant=")[1] === b.url.split("?activeVariant=")[1];
    };
    for (const m of matches) {
      rate[m.by]++;
      const t = rowTruth.get(m.row);
      if (t !== `${m.record.slug}|${m.side.side}` && !same(t, m.side)) rate.wrong.push(`${m.record.slug} ${m.side.side} <- ${t} (${m.by})`);
    }
    rate.none = rate.sides - matches.length;
    const { storeIdOf } = await import("./feeds/ids");
    rate.withNumber = sides.filter(({ x }) => storeIdOf(x.url)).length;
    out.push(rate);
  }
  return out;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");

export function rateTable(rates: StoreRate[]) {
  const lines = [
    "| Store | Network | Sides | Barcode in record | Number in URL | Auto: barcode | Auto: store number | Review: name | No match | Wrong |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const r of rates)
    lines.push(`| ${r.store} | ${r.network} | ${r.sides} | ${r.withGtin} | ${r.withNumber} | ${r.gtin} | ${r.id} | ${r.name} | ${r.none} (${pct(r.none, r.sides)}) | ${r.wrong.length} |`);
  const t = rates.reduce((a, r) => ({ sides: a.sides + r.sides, auto: a.auto + r.gtin + r.id, name: a.name + r.name, wrong: a.wrong + r.wrong.length }), { sides: 0, auto: 0, name: 0, wrong: 0 });
  lines.push("", `All: ${t.sides} sides, ${t.auto} (${pct(t.auto, t.sides)}) applied automatically, ${t.name} (${pct(t.name, t.sides)}) to review by name, ${t.wrong} wrong.`);
  return lines.join("\n");
}

if (isMain(import.meta.url)) void matchRates().then((r) => console.log(rateTable(r)));
