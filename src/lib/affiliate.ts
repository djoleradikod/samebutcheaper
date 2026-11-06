import { MARKETS, type MarketCode } from "./markets";
import type { ProductSide } from "./types";

/**
 * Builds outbound (affiliate) URLs. Configure with env:
 *   AMAZON_ASSOCIATE_TAG=yourtag-20                 (amazon.com)
 *   AMAZON_TAGS=amazon.co.uk:tag-21,amazon.de:tag-21,amazon.ca:tag-20
 *   WALMART_AFFILIATE_TEMPLATE=https://goto.walmart.com/c/XXXX/YYYY/ZZZZ?u={url}
 *   TARGET_AFFILIATE_TEMPLATE=https://goto.target.com/c/XXXX/YYYY/ZZZZ?u={url}
 * Without a tag or template the plain URL is used, so links always work.
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
  // Impact templates are per program, so only wrap the US sites they belong to.
  const template =
    host === "walmart.com"
      ? process.env.WALMART_AFFILIATE_TEMPLATE
      : host === "target.com"
        ? process.env.TARGET_AFFILIATE_TEMPLATE
        : undefined;
  if (template?.includes("{url}")) return template.replace("{url}", encodeURIComponent(url));
  return url;
}

export function affiliateUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): string {
  if (p.retailer === "amazon" && p.asin) return tagUrl(`https://www.${MARKETS[market].amazon}/dp/${p.asin}`);
  return tagUrl(p.url);
}

/** Whether we're in an affiliate program for this link at all, so the page can say so honestly. */
export function mayEarn(p: Pick<ProductSide, "retailer" | "url">): boolean {
  if (p.retailer === "amazon") return true;
  try {
    const host = new URL(p.url).hostname.replace(/^www\./, "");
    return host === "walmart.com" || host === "target.com";
  } catch {
    return false;
  }
}

/** "on Amazon", "at Tesco". */
export function atStore(retailer: string) {
  return retailer === "amazon" ? "on Amazon" : `at ${RETAILER_LABEL[retailer] ?? "the store"}`;
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
  other: "retailer",
};
