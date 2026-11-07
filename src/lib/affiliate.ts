import { hostname } from "./format";
import { MARKETS, type MarketCode } from "./markets";
import type { ProductSide } from "./types";

/**
 * Builds outbound (affiliate) URLs. Configure with env:
 *   AMAZON_ASSOCIATE_TAG=yourtag-20                 (amazon.com)
 *   AMAZON_TAGS=amazon.co.uk:tag-21,amazon.de:tag-21,amazon.ca:tag-20
 *   WALMART_AFFILIATE_TEMPLATE=https://goto.walmart.com/c/XXXX/YYYY/ZZZZ?u={url}
 *   TARGET_AFFILIATE_TEMPLATE=https://goto.target.com/c/XXXX/YYYY/ZZZZ?u={url}
 * Without a tag or template the plain URL is used, so links always work.
 *
 * next.config.ts fixes these values at build time, because most pages are rendered then. A tag that
 * only exists at run time does nothing, so a page's words about earning can't disagree with its links.
 */

/** The Associates tag for an Amazon storefront, e.g. "amazon.de". */
export function amazonTag(domain: string): string | undefined {
  const d = domain.replace(/^www\./, "").toLowerCase();
  for (const entry of (process.env.AMAZON_TAGS ?? "").split(",")) {
    const [host, tag] = entry.split(":").map((s) => s?.trim());
    if (host && tag && host.toLowerCase() === d) return tag;
  }
  return d === "amazon.com" ? process.env.AMAZON_ASSOCIATE_TAG || undefined : undefined;
}

/** Adds affiliate parameters to any store URL we link to. */
export function tagUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host.startsWith("amazon.")) {
    const tag = amazonTag(host);
    if (tag) u.searchParams.set("tag", tag);
    return u.toString();
  }
  const template = templateFor(host);
  return template ? template.replace("{url}", encodeURIComponent(url)) : url;
}

/** Impact templates are per program, so only the US sites they belong to have one. */
function templateFor(host: string) {
  const template =
    host === "walmart.com"
      ? process.env.WALMART_AFFILIATE_TEMPLATE
      : host === "target.com"
        ? process.env.TARGET_AFFILIATE_TEMPLATE
        : undefined;
  return template?.includes("{url}") ? template : undefined;
}

/** Where a product's link goes before any tag: an Amazon product goes to the storefront of its market. */
function storeUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode) {
  return p.retailer === "amazon" && p.asin ? `https://www.${MARKETS[market].amazon}/dp/${p.asin}` : p.url;
}

export function affiliateUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): string {
  return tagUrl(storeUrl(p, market));
}

/** Whether this link really carries a tag, so the page next to it can say so honestly. */
export function mayEarn(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): boolean {
  // tagUrl tags any Amazon link, whichever retailer the record names.
  const host = hostname(storeUrl(p, market));
  return host.startsWith("amazon.") ? !!amazonTag(host) : !!templateFor(host);
}

/** Whether any Amazon link on the site carries a tag. Amazon's required wording only appears then. */
export function amazonEarns() {
  return !!process.env.AMAZON_ASSOCIATE_TAG || (process.env.AMAZON_TAGS ?? "").split(",").some((e) => !!e.split(":")[1]?.trim());
}

/** Whether any link on the site can earn us anything. */
export function linksEarn() {
  return amazonEarns() || !!templateFor("walmart.com") || !!templateFor("target.com");
}

/** A store's name: ours when we have one, or else its web address, so two unnamed shops stay two shops. */
export function storeName(retailer: string, url: string) {
  return RETAILER_LABEL[retailer] ?? hostname(url);
}

/** Whose site a link really opens: any Amazon URL is Amazon, whichever retailer the record names. */
export function linkStoreName(p: Pick<ProductSide, "retailer" | "url">) {
  return hostname(p.url).startsWith("amazon.") ? "Amazon" : storeName(p.retailer, p.url);
}

/** "on Amazon", "at Tesco", "at uline.com". Without a URL an unnamed store is "the store". */
export function atStore(retailer: string, url?: string) {
  if (retailer === "amazon") return "on Amazon";
  return `at ${url ? storeName(retailer, url) : (RETAILER_LABEL[retailer] ?? "the store")}`;
}

/** What each store comes to, biggest first. A line that costs nothing, such as one set to zero, leaves its store out. */
export function storeSplit(lines: { store: string; cost: number }[]) {
  const totals = new Map<string, number>();
  for (const { store, cost } of lines) {
    if (cost > 0) totals.set(store, (totals.get(store) ?? 0) + cost);
  }
  return [...totals.entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export const RETAILER_LABEL: Record<string, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
  target: "Target",
  costco: "Costco",
  bestbuy: "Best Buy",
  apple: "Apple",
  cvs: "CVS",
  walgreens: "Walgreens",
  boots: "Boots",
  superdrug: "Superdrug",
  tesco: "Tesco",
  asda: "Asda",
  sainsburys: "Sainsbury's",
  shoppers: "Shoppers Drug Mart",
  canadiantire: "Canadian Tire",
  loblaws: "Loblaws",
  dm: "dm",
  rossmann: "Rossmann",
  mueller: "Müller",
  shopapotheke: "Shop Apotheke",
  docmorris: "DocMorris",
  aponeo: "Aponeo",
  "medikamente-per-klick": "medikamente-per-klick",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  staples: "Staples",
  officedepot: "Office Depot",
  autozone: "AutoZone",
  kroger: "Kroger",
  aldi: "Aldi",
  lidl: "Lidl",
  morrisons: "Morrisons",
  waitrose: "Waitrose",
  ocado: "Ocado",
  wilko: "Wilko",
  argos: "Argos",
  screwfix: "Screwfix",
  toolstation: "Toolstation",
  bandq: "B&Q",
  halfords: "Halfords",
  ryman: "Ryman",
  rewe: "REWE",
  edeka: "EDEKA",
  kaufland: "Kaufland",
  hornbach: "Hornbach",
  obi: "OBI",
  bauhaus: "Bauhaus",
  atu: "A.T.U",
  ikea: "IKEA",
  chewy: "Chewy",
  petsathome: "Pets at Home",
  fressnapf: "Fressnapf",
  safeway: "Safeway",
  wholefoods: "Whole Foods Market",
  sprouts: "Sprouts",
  winco: "WinCo Foods",
  batteryjunction: "Battery Junction",
  netto: "Netto",
  penny: "Penny",
  tegut: "tegut",
  zooplus: "zooplus",
  pollin: "Pollin",
  alternate: "Alternate",
  sevendayshop: "7dayshop",
  viking: "Viking",
  crocus: "Crocus",
  coop: "Co-op",
  marksandspencer: "Marks & Spencer",
  iceland: "Iceland",
};
