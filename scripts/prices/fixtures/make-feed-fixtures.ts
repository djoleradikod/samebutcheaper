/**
 * Writes the SYNTHETIC store feeds in scripts/prices/fixtures/feeds/catalogue/, built from real catalogue records,
 * so the matcher can be measured store by store (scripts/prices/feed-report.ts, scripts/tests/feeds-match.test.ts).
 * No store page and no real feed was read. Each file uses its network's documented columns (formats.ts) and holds:
 *
 * - one row per record side at that store, with what a feed would plausibly carry and nothing we don't know:
 *   the record's barcode only when the record has one; the record's product URL when it is a product page, and
 *   for a record linked to a search page an invented product URL whose number matches nothing; the merchant
 *   SKU set to the number in the record's product URL (an ASSUMPTION: real merchants may number differently);
 *   the record's own name with its pack, and its own price;
 * - a decoy per side: same brand and words, twice the pack, another barcode and number. A decoy must never match;
 * - unrelated filler rows.
 *
 * The column x_fixture_truth says which side a row was made from ("decoy" or "filler" otherwise). Feeds don't
 * have it; the readers ignore unknown columns.
 *
 *   npx tsx scripts/prices/fixtures/make-feed-fixtures.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isSearchUrl, storeIdOf } from "../feeds/ids";
import { isMain } from "../observations";
import { loadRecords, type PricedRecord, type PricedSide } from "../records";

export const CATALOGUE_FIXTURES = join(import.meta.dirname, "feeds", "catalogue");

/** The stores R7-resourcing.md names, with the network that would carry each. */
export const FIXTURE_STORES: { network: "impact" | "awin" | "flexoffers"; retailer: string; market: string; file: string }[] = [
  { network: "impact", retailer: "walmart", market: "US", file: "impact-walmart-US.json" },
  { network: "impact", retailer: "chewy", market: "US", file: "impact-chewy-US.json" },
  { network: "impact", retailer: "target", market: "US", file: "impact-target-US.json" },
  { network: "awin", retailer: "zooplus", market: "DE", file: "awin-zooplus-DE.csv" },
  { network: "awin", retailer: "zooplus", market: "IE", file: "awin-zooplus-IE.csv" },
  { network: "awin", retailer: "shopapotheke", market: "DE", file: "awin-shopapotheke-DE.csv" },
  { network: "awin", retailer: "pollin", market: "DE", file: "awin-pollin-DE.csv" },
  { network: "awin", retailer: "crocus", market: "GB", file: "awin-crocus-GB.csv" },
  { network: "flexoffers", retailer: "tesco", market: "GB", file: "flexoffers-tesco-GB.json" },
];

const hash = (s: string, n: number) => BigInt(`0x${createHash("sha1").update(s).digest("hex").slice(0, 15)}`).toString().padStart(n, "7").slice(0, n);

/** A plausible EAN-13 with a valid check digit, from a seed; starts 20-29 (in-store numbers), so never a real product's. */
function fakeGtin(seed: string) {
  const body = `2${hash(seed, 11)}`;
  const sum = [...body].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

function withPack(side: PricedSide, size = side.size) {
  const has = new RegExp(`\\b${side.size}\\s*${side.unit}`, "i").test(side.name);
  const base = has ? side.name.replace(new RegExp(`\\b${side.size}(\\s*)${side.unit}`, "i"), `${size}$1${side.unit}`) : `${side.name}, ${size} ${side.unit}`;
  return base;
}

type Plain = { truth: string; name: string; brand: string; gtin: string; sku: string; price: number; url: string; inStock: boolean };

function rowsFor(records: PricedRecord[], retailer: string, market: string): Plain[] {
  const out: Plain[] = [];
  for (const r of records) {
    if (r.market !== market) continue;
    for (const s of r.sides) {
      if (s.retailer !== retailer) continue;
      const sid = storeIdOf(s.url);
      const product = !isSearchUrl(s.url) && sid;
      const url = product ? s.url : `${new URL(s.url).origin}/p/synthetic-${hash(`${r.slug}${s.side}`, 9)}`;
      out.push({ truth: `${r.slug}|${s.side}`, name: withPack(s), brand: s.brand, gtin: s.gtin ?? "", sku: sid ? (sid.variant ?? sid.id) : `S${hash(r.slug + s.side, 8)}`, price: s.price, url, inStock: true });
      out.push({
        truth: "decoy",
        name: withPack(s, s.size * 2),
        brand: s.brand,
        gtin: fakeGtin(`decoy${r.slug}${s.side}`),
        sku: `D${hash(`decoy${r.slug}${s.side}`, 8)}`,
        price: Math.round(s.price * 180) / 100,
        url: `${new URL(s.url).origin}/p/decoy-${hash(`${r.slug}${s.side}`, 9)}`,
        inStock: true,
      });
    }
  }
  for (let i = 0; i < 25; i++) {
    out.push({ truth: "filler", name: `Synthetic filler product ${i}, ${100 + i} g`, brand: "Fillerbrand", gtin: fakeGtin(`filler${retailer}${i}`), sku: `F${i}`, price: 1 + i, url: `https://filler.example/p/${i}`, inStock: i % 5 !== 0 });
  }
  return out;
}

const CURRENCY: Record<string, string> = { US: "USD", GB: "GBP", DE: "EUR", IE: "EUR", CA: "CAD" };

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeFixtures(records = loadRecords()) {
  mkdirSync(CATALOGUE_FIXTURES, { recursive: true });
  const counts: Record<string, number> = {};
  for (const store of FIXTURE_STORES) {
    const rows = rowsFor(records, store.retailer, store.market);
    const currency = CURRENCY[store.market];
    let text: string;
    if (store.network === "impact") {
      const items = rows.map((p, i) => ({
        Id: `5001-${p.sku}`,
        CatalogId: "5001",
        CampaignId: "9383",
        CampaignName: `Synthetic ${store.retailer}`,
        CatalogItemId: p.sku,
        Name: p.name,
        Manufacturer: p.brand,
        Url: `https://goto.${store.retailer}.example.sjv.io/c/1234567/565706/9383?prodsku=${encodeURIComponent(p.sku)}&u=${encodeURIComponent(p.url)}`,
        ImageUrl: `https://img.example/${i}.jpg`,
        CurrentPrice: p.price.toFixed(2),
        OriginalPrice: p.price.toFixed(2),
        Currency: currency,
        StockAvailability: p.inStock ? "InStock" : "OutOfStock",
        Gtin: p.gtin,
        GtinType: p.gtin ? "UPC" : "",
        x_fixture_truth: p.truth,
      }));
      text = JSON.stringify({ "@page": "1", "@numpages": "1", "@pagesize": String(items.length), Items: items }, null, 1);
    } else if (store.network === "awin") {
      const header = "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,merchant_deep_link,brand_name,search_price,currency,ean,product_GTIN,in_stock,last_updated,merchant_id,merchant_name,x_fixture_truth";
      const lines = rows.map((p, i) =>
        [
          `https://www.awin1.com/pclick.php?p=${30000000 + i}&a=1000000&m=12345`,
          p.name,
          30000000 + i,
          p.sku,
          `https://img.example/${i}.jpg`,
          p.url,
          p.brand,
          p.price.toFixed(2),
          currency,
          p.gtin,
          "",
          p.inStock ? 1 : 0,
          "2026-11-12 04:10:00",
          "12345",
          `Synthetic ${store.retailer}`,
          p.truth,
        ]
          .map(csvCell)
          .join(","),
      );
      text = [header, ...lines].join("\n") + "\n";
    } else {
      const items = rows.map((p, i) => ({
        pid: `${90000 + i}`,
        name: p.name,
        brand: p.brand,
        sku: p.sku,
        gtin: p.gtin,
        price: p.price,
        currency,
        stockAvailability: p.inStock ? "in stock" : "out of stock",
        deepLinkURL: `https://track.flexlinkspro.com/g.ashx?foid=156074.A1000&trid=1&foc=16&fot=9999&fos=6&url=${encodeURIComponent(p.url)}`,
        imageUrl: `https://img.example/${i}.jpg`,
        lastUpdated: "2026-11-12T03:00:00Z",
        x_fixture_truth: p.truth,
      }));
      text = JSON.stringify(items, null, 1);
    }
    writeFileSync(join(CATALOGUE_FIXTURES, store.file), text);
    counts[store.file] = rows.length;
  }
  return counts;
}

if (isMain(import.meta.url)) console.log(writeFixtures());
