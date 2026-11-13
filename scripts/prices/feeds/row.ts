/**
 * The one shape every affiliate feed is read into, whatever its network (docs/feeds.md). Each network's columns
 * are mapped onto this in formats.ts; matching (match.ts) and the refresh only ever see a FeedRow.
 */

export type FeedRow = {
  /** Our retailer id and market, from the feed's PRICE_FEED_URLS entry, never from the row. */
  retailer: string;
  market: string;
  name: string;
  brand: string | null;
  /** GTIN, EAN or UPC as given (8 to 14 digits). Compared as GTIN-14. */
  gtins: string[];
  /** The merchant's own product number(s): SKU, product id, catalogue item id. */
  skus: string[];
  price: number | null;
  currency: string | null;
  /** Pack or size text when the feed has a column for it ("450 g", "Pack of 4"); else null. */
  packText: string | null;
  /** null when the feed doesn't say. */
  inStock: boolean | null;
  /** The network's tracked link (the affiliate deep link). */
  deepLink: string | null;
  /** The merchant's own product page, untracked, when the feed gives it. */
  productUrl: string | null;
  imageUrl: string | null;
  /** ISO day the merchant last updated the row, when the feed says. */
  updated: string | null;
  /** Merchant or programme id on the network, for notes. */
  merchant: string | null;
};

/** "12.99", "12,99", "12.99 USD", "$1,299.00", "1.299,00 EUR" -> a number; null for blank, zero or nonsense. */
export function parsePrice(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // 1.299,00 or 12,99: the comma is the decimal mark.
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** "15.00 USD" (Google-style price text, as CJ uses) -> "USD". */
export function currencyIn(raw: string | null | undefined): string | null {
  const m = /\b([A-Z]{3})\b/.exec(String(raw ?? "").toUpperCase());
  return m ? m[1] : null;
}

/** Barcodes from any number of fields, digits only, 8 to 14 long, deduplicated. */
export function gtinsOf(...values: (string | null | undefined)[]) {
  const out: string[] = [];
  for (const v of values) {
    for (const part of String(v ?? "").split(/[\s,;|]+/)) {
      const d = part.replace(/\D/g, "");
      if (d.length >= 8 && d.length <= 14 && /[1-9]/.test(d) && !out.includes(d)) out.push(d);
    }
  }
  return out;
}

export const nonEmpty = (...values: (string | null | undefined)[]) => [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** ISO "2026-11-12[T ...]", US "11/12/2026 04:10:00" (Rakuten), "12 Nov 2026", or epoch seconds -> "2026-11-12". */
export function isoDayOf(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  // German and most of Europe: 12.11.2026
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/.exec(s);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000).toISOString().slice(0, 10);
  return null;
}

/**
 * Stock words from any network: 1/0, true/false, yes/no, in stock / out of stock, InStock / OutOfStock,
 * in-stock / out-of-stock, available / not available. Blank or anything else is unknown (null): a feed that
 * doesn't say never takes a record out of the lead.
 */
export function stockOf(raw: string | null | undefined): boolean | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!s) return null;
  if (["1", "true", "yes", "y", "instock", "available", "limitedavailability", "lowstock", "ja", "lieferbar", "auflager", "verfügbar", "verfuegbar"].includes(s)) return true;
  if (["0", "false", "no", "n", "outofstock", "notavailable", "unavailable", "soldout", "discontinued", "nein", "ausverkauft", "nichtlieferbar", "nichtverfügbar", "nichtverfuegbar"].includes(s)) return false;
  return null;
}

/** An absolute http(s) URL, or null. */
export function urlOrNull(raw: string | null | undefined) {
  const s = String(raw ?? "").trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

/* ------------------------------------------------------------------ packs */

export type Pack = { size: number; unit: string };

const PACK_UNITS: [RegExp, string][] = [
  [/^(?:kg|kilo(?:gram)?s?)$/, "kg"],
  [/^(?:g|gr|gram(?:me)?s?)$/, "g"],
  [/^(?:mg)$/, "mg"],
  [/^(?:l|ltr|litre?s?|liter?s?)$/, "l"],
  [/^(?:ml|millilitre?s?|milliliter?s?)$/, "ml"],
  [/^(?:cl)$/, "cl"],
  [/^(?:fl\.? ?oz|fluid ounces?)$/, "fl oz"],
  [/^(?:oz|ounces?)$/, "oz"],
  [/^(?:lbs?|pounds?)$/, "lb"],
  [/^(?:ct|count|pcs?|pieces?|pack|st(?:ü|ue)ck|stk|tablets?|tabs?|capsules?|caps|softgels?|wipes?|sheets?|rolls?|bags?|pods?|sachets?|cells?|batteries|battery|lozenges?|gummies|caplets?|tabletten|kapseln)$/, "count"],
];

function unitOf(word: string) {
  const w = word.toLowerCase().replace(/\.$/, "");
  for (const [re, unit] of PACK_UNITS) if (re.test(w)) return unit;
  return null;
}

/**
 * The pack a feed names, from a pack column or the product name: "450 g", "1,5 l", "Pack of 4", "4 x 100 g"
 * (as 400 g), "90 Count", "20 Stück". Null when it names none or more than one different pack.
 */
export function parsePack(text: string | null | undefined): Pack | null {
  const s = String(text ?? "").replace(/(\d),(\d)/g, "$1.$2");
  const found: Pack[] = [];
  const multi = /(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\.? ?oz|[a-zA-Zäöüß]+)\b/g;
  let m: RegExpExecArray | null;
  let rest = s;
  while ((m = multi.exec(s))) {
    const unit = unitOf(m[3]);
    if (unit && unit !== "count") found.push({ size: Number(m[1]) * Number(m[2]), unit });
    rest = rest.replace(m[0], " ");
  }
  const single = /(\d+(?:\.\d+)?)\s*-?\s*(fl\.? ?oz|[a-zA-Zäöüß]+)\b/g;
  while ((m = single.exec(rest))) {
    const unit = unitOf(m[2]);
    if (unit) found.push({ size: Number(m[1]), unit });
  }
  const packOf = /\b(?:pack|box|case|set) of (\d+)\b/i.exec(rest);
  if (packOf) found.push({ size: Number(packOf[1]), unit: "count" });
  // "500 mg" is a strength, not a pack, whenever anything else is named.
  const packs = found.filter((p) => p.unit !== "mg" || found.length === 1);
  const distinct = [...new Map(packs.map((p) => [`${p.size}|${p.unit}`, p])).values()];
  // A weight or volume beats a count ("6 x 1 l" names both) only when there is exactly one of it.
  const measured = distinct.filter((p) => p.unit !== "count");
  if (measured.length === 1) return measured[0];
  if (measured.length > 1) return null;
  return distinct.length === 1 ? distinct[0] : null;
}
