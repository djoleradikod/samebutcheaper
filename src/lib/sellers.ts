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

/** Chains writing can name that have no own-label names of ours to catch. Case-sensitive, because a penny isn't Penny. */
const ALSO_NAMED: [RegExp, string][] = [
  [/\bNetto\b/, "netto"],
  [/\bEdeka\b|\bEDEKA\b/, "edeka"],
  [/\bRewe\b|\bREWE\b/, "rewe"],
  [/\bKaufland\b/, "kaufland"],
  [/\bPenny\b/, "penny"],
  // North American chains and the own labels only they sell, so a US finding doesn't reach a Canadian with names they can't buy.
  [/\bCostco\b|\bKirkland\b/, "costco"],
  [/\bWalmart\b|\bGreat Value\b|\bEquate\b|\bParent's Choice\b/, "walmart"],
  [/\bTarget\b|\bup ?& ?up\b|\bGood & Gather\b|\bMarket Pantry\b/, "target"],
  [/\bSam's Club\b|\bMember's Mark\b/, "samsclub"],
  [/\bWhole Foods\b/, "wholefoods"],
  [/\bTrader Joe's\b/, "traderjoes"],
  [/\bKroger\b/, "kroger"],
  [/\bSafeway\b|\bSignature Select\b|\bLucerne\b/, "safeway"],
];

/** The chains a piece of writing names by name. */
export function namedSellers(text: string) {
  return [...OWN_LABEL, ...ALSO_NAMED].filter(([pattern]) => pattern.test(text)).map(([, seller]) => seller);
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
  // Storefront and locale subdomains (shop.x.com, us.ugreen.com, uk.x.com) name the store's country, not the store.
  return host.replace(/^(?:shop|store|us|uk|ca|de|ie|eu|en)\./, "").split(".")[0].replace(/-online$/, "");
}

const SOLD_IN: Record<string, Set<string>> = {};
for (const table of [footprint.sellers, footprint.manual] as Record<string, Record<string, string>>[]) {
  for (const [seller, countries] of Object.entries(table)) {
    SOLD_IN[seller] ??= new Set();
    for (const c of Object.keys(countries)) SOLD_IN[seller].add(c);
  }
}

/**
 * Whether we can show this seller operates in or ships to this country, with the same range. Amazon: a storefront that
 * delivers there, see COUNTRIES. A chain whose only site there is a separate national shop (`separate` in the file) doesn't
 * count: walmart.ca doesn't sell what walmart.com lists.
 */
export function sellsIn(seller: string, country: string) {
  if (seller === "amazon") return Boolean(COUNTRIES[country]?.amazon);
  return SOLD_IN[seller]?.has(country) ?? false;
}

const SHIPS = (footprint as { ships?: Record<string, Record<string, Record<string, string>>> }).ships ?? {};
const SEPARATE = (footprint as { separate?: Record<string, Record<string, string>> }).separate ?? {};

/** The chain's own site in this country when it's a separate shop with its own range and prices, or null. */
export function separateSite(seller: string, country: string): string | null {
  return SEPARATE[seller]?.[country] ?? null;
}

/** Whether this seller's site in `market` delivers to `country`, by its own delivery page (`ships` in the file). */
export function shipsFrom(seller: string, market: string, country: string) {
  return Boolean(SHIPS[seller]?.[market]?.[country]);
}

/**
 * Whether a listing at this seller in `market` can be bought and delivered in `country`, and so whether we link it there.
 * - Its own market: yes.
 * - Amazon from another market: "maybe", since each storefront ships some items abroad and not others.
 * - A store whose delivery page names the country: yes (a German pharmacy that delivers to Austria).
 * - Anything else: no. Selling in that country through a national site of its own isn't enough: the link goes to the other
 *   market's site, which is a different shop. The swap page says where to look instead.
 * `seller` is a seller name as sellerOf gives it; a named retailer is its own seller, and "other" can't be placed.
 */
export function deliversTo(seller: string, market: string, country: string): "yes" | "maybe" | "no" {
  if (country === market) return "yes";
  if (seller === "amazon") return "maybe";
  return shipsFrom(seller, market, country) ? "yes" : "no";
}
