/**
 * Every priced thing in the catalogue, read straight from data/pairs and data/bundles, with where each
 * price sits in its file so the refresh can rewrite it in place.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKETS, RETAILERS, type MarketCode } from "../../src/lib/markets";
import { normalizeUnit } from "../../src/lib/schema";
import type { JsonPath } from "./json-edit";
import { ROOT } from "./observations";

export const PAIR_DIR = join(ROOT, "data", "pairs");
export const BUNDLE_DIR = join(ROOT, "data", "bundles");

export type Currency = (typeof MARKETS)[MarketCode]["currency"];

export type PricedSide = {
  side: string;
  price: number;
  /** "price", or "price_usd" in older files. */
  priceKey: string;
  /** Path to the side's object in its file. */
  path: JsonPath;
  name: string;
  size: number;
  unit: string;
  retailer: string;
  url: string;
  gtin: string | null;
};

export type PricedRecord = {
  slug: string;
  kind: "swap" | "kit";
  market: MarketCode;
  currency: Currency;
  file: string;
  index: number;
  priceChecked: string;
  sides: PricedSide[];
  /** Kits only: the size of each bundle item, by index, which a piece's unit price is scaled to. */
  itemSizes?: number[];
};

type Raw = Record<string, unknown>;

function retailerOf(r: unknown) {
  const id = String(r ?? "").toLowerCase().trim();
  return (RETAILERS as readonly string[]).includes(id) ? id : "other";
}

/** "Nutella, 450 g" rather than "Nutella Nutella, 450 g". */
function nameOf(brand: unknown, product: unknown) {
  const b = String(brand ?? "");
  const p = String(product ?? "");
  return p.toLowerCase().startsWith(b.toLowerCase()) ? p : `${b} ${p}`;
}

function sideOf(raw: Raw, side: string, path: JsonPath, name: string): PricedSide | null {
  const priceKey = "price" in raw ? "price" : "price_usd" in raw ? "price_usd" : null;
  if (!priceKey || typeof raw[priceKey] !== "number") return null;
  return {
    side,
    price: raw[priceKey] as number,
    priceKey,
    path,
    name,
    size: Number(raw.size),
    unit: normalizeUnit(String(raw.unit ?? "")),
    retailer: retailerOf(raw.retailer),
    url: String(raw.url ?? ""),
    gtin: typeof raw.gtin === "string" && /^\d{8,14}$/.test(raw.gtin) ? raw.gtin : null,
  };
}

function marketOf(raw: Raw): MarketCode {
  const m = String(raw.market ?? "US") as MarketCode;
  return m in MARKETS ? m : "US";
}

export function recordsFromPairFile(file: string, text: string): PricedRecord[] {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p: Raw, index): PricedRecord[] => {
    const brand = p.brand as Raw;
    const alt = p.alternative as Raw;
    if (!brand || !alt || typeof p.slug !== "string") return [];
    const b = sideOf(brand, "brand", [index, "brand"], nameOf(brand.brand, brand.product));
    const a = sideOf(alt, "alternative", [index, "alternative"], nameOf(alt.brand, alt.product));
    if (!b || !a) return [];
    const market = marketOf(p);
    return [{ slug: p.slug, kind: "swap", market, currency: MARKETS[market].currency, file, index, priceChecked: String(p.price_checked ?? ""), sides: [b, a] }];
  });
}

export function recordsFromBundleFile(file: string, text: string): PricedRecord[] {
  const raw = JSON.parse(text);
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((k: Raw, index): PricedRecord[] => {
    const bundle = k.bundle as Raw;
    const components = k.components as Raw[];
    if (!bundle || !Array.isArray(components) || typeof k.slug !== "string") return [];
    const items = (bundle.items as Raw[]) ?? [];
    const kitSide = sideOf({ ...bundle, size: 1, unit: "kit" }, "kit", [index, "bundle"], nameOf(bundle.brand, bundle.name));
    const pieces = components.map((c, ci) => sideOf(c, `item-${c.replaces}`, [index, "components", ci], nameOf(c.brand, c.product)));
    if (!kitSide || pieces.some((p) => !p)) return [];
    const market = marketOf(k);
    return [
      {
        slug: k.slug,
        kind: "kit",
        market,
        currency: MARKETS[market].currency,
        file,
        index,
        priceChecked: String(k.price_checked ?? ""),
        sides: [kitSide, ...(pieces as PricedSide[])],
        itemSizes: items.map((it) => Number(it.size)),
      },
    ];
  });
}

export function loadRecords(pairDir = PAIR_DIR, bundleDir = BUNDLE_DIR): PricedRecord[] {
  const read = (dir: string, fn: (file: string, text: string) => PricedRecord[]) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .flatMap((f) => fn(join(dir, f), readFileSync(join(dir, f), "utf8")));
  return [...read(pairDir, recordsFromPairFile), ...read(bundleDir, recordsFromBundleFile)];
}

/**
 * Percent saved per unit at these prices, the same sum the catalogue build checks against its 5% floor.
 * A swap: the cheaper product's unit price against the brand's. A kit: the pieces, scaled to what the kit
 * holds, against the kit's price.
 */
export function savingPct(record: PricedRecord, prices: Map<string, number> = new Map()) {
  const price = (s: PricedSide) => prices.get(s.side) ?? s.price;
  if (record.kind === "swap") {
    const [brand, alt] = record.sides;
    const brandPpu = price(brand) / brand.size;
    const altPpu = price(alt) / alt.size;
    return (1 - altPpu / brandPpu) * 100;
  }
  const [kit, ...pieces] = record.sides;
  const equivalent = pieces.reduce((sum, p) => {
    const item = Number(p.side.slice("item-".length));
    return sum + (price(p) / p.size) * (record.itemSizes?.[item] ?? 0);
  }, 0);
  return ((price(kit) - equivalent) / price(kit)) * 100;
}
