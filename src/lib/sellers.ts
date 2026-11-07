/**
 * Who actually sells a product, and whether that seller is in a country. Pure, for the catalogue build, server and client.
 *
 * The seller isn't always `retailer`: own-label names only sell at their chain whatever store a row was priced through, and a
 * row marked "other" names its seller only in its link. Where a chain sells comes from data/sellers/footprint.json, see
 * scripts/qa/seller_footprint.py. No entry means we couldn't show it sells there, not that it doesn't.
 */
import footprint from "../../data/sellers/footprint.json";
import { COUNTRIES } from "./markets";

/** Names that only one chain sells, wherever the row says it was priced. */
const OWN_LABEL: [RegExp, string][] = [
  [/\bsainsbury'?s\b/i, "sainsburys"],
  [/\btesco\b/i, "tesco"],
  [/\basda\b/i, "asda"],
  [/\bmorrisons\b/i, "morrisons"],
  [/\bwaitrose\b/i, "waitrose"],
  [/\bm&s\b|\bmarks (?:&|and) spencer\b/i, "marksandspencer"],
  [/\bco-op\b/i, "coop"],
  [/\baldi\b/i, "aldi"],
  [/\blidl\b/i, "lidl"],
  [/\brossmann\b/i, "rossmann"],
];

type Sold = { brand: string; product: string; retailer: string; url?: string | null };

/** The chains a piece of writing names by name. */
export function namedSellers(text: string) {
  return OWN_LABEL.filter(([pattern]) => pattern.test(text)).map(([, seller]) => seller);
}

function hostOf(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The one seller to judge a product by. An "other" row with no store in its link is "unknown", which sells nowhere we can name. */
export function sellerOf(side: Sold): string {
  const name = `${side.brand} ${side.product}`;
  for (const [pattern, seller] of OWN_LABEL) if (pattern.test(name)) return seller;
  if (side.retailer !== "other") return side.retailer;
  const host = hostOf(side.url);
  if (!host || host === "which.co.uk") return "unknown";
  if (host.startsWith("amazon.")) return "amazon";
  return host.replace(/^shop\./, "").split(".")[0].replace(/-online$/, "");
}

const SOLD_IN: Record<string, Set<string>> = {};
for (const table of [footprint.sellers, footprint.manual] as Record<string, Record<string, string>>[]) {
  for (const [seller, countries] of Object.entries(table)) {
    SOLD_IN[seller] ??= new Set();
    for (const c of Object.keys(countries)) SOLD_IN[seller].add(c);
  }
}

/** Whether we can show this seller operates in or ships to this country. Amazon: a storefront that delivers there, see COUNTRIES. */
export function sellsIn(seller: string, country: string) {
  if (seller === "amazon") return Boolean(COUNTRIES[country]?.amazon);
  return SOLD_IN[seller]?.has(country) ?? false;
}
