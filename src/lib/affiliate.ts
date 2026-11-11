import { hostname } from "./format";
import { MARKETS, type MarketCode } from "./markets";
import type { ProductSide } from "./types";

import { affiliateEnv, livePrograms, liveSubNetwork, tagLink, type TaggedLink } from "./affiliate-links";

export { amazonTag } from "./affiliate-links";

/**
 * Outbound links for catalog products. Which program tags a link, the networks' link formats, click IDs and the
 * env settings live in affiliate-links.ts and affiliate-programs.ts (see docs/affiliate-playbook.md).
 *
 * next.config.ts fixes those settings at build time, because most pages are rendered then. A setting that only
 * exists at run time does nothing, so links can't start earning under pages built saying they don't.
 */

/** Adds affiliate parameters to any store URL we link to. */
export function tagUrl(url: string, clickId = ""): string {
  return tagLink(url, clickId).url;
}

/** Where a product's link goes before any tag: an Amazon product goes to the storefront of its market. */
export function productUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US") {
  return p.retailer === "amazon" && p.asin ? `https://www.${MARKETS[market].amazon}/dp/${p.asin}` : p.url;
}

export function affiliateLink(
  p: Pick<ProductSide, "retailer" | "asin" | "url">,
  market: MarketCode = "US",
  clickId = "",
): TaggedLink {
  return tagLink(productUrl(p, market), clickId);
}

export function affiliateUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): string {
  return affiliateLink(p, market).url;
}

/** Whether this link really carries a tag, so the page next to it can say so honestly. */
export function mayEarn(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): boolean {
  return affiliateLink(p, market).program !== null;
}

/** Whether any Amazon link on the site carries a tag. Amazon's required wording only appears then. */
export function amazonEarns() {
  return livePrograms().some((p) => p.network === "amazon");
}

/** Whether any link on the site can earn us anything. */
export function linksEarn() {
  return livePrograms().length > 0 || liveSubNetwork() !== null;
}

/** Whether a sub-network is on, so any store link may earn. */
export function subNetworkEarns() {
  return liveSubNetwork(affiliateEnv()) !== null;
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
  // Brand and beauty stores that rows mark "other" but sellers.ts names from the link, for store-by-store checkouts.
  ulta: "Ulta Beauty",
  anker: "Anker",
  logitech: "Logitech",
  ugreen: "UGREEN",
  chipolo: "Chipolo",
  belkin: "Belkin",
  theordinary: "The Ordinary",
  lookfantastic: "LOOKFANTASTIC",
  maybelline: "Maybelline",
  dermstore: "Dermstore",
  thorne: "Thorne",
  livemomentous: "Momentous",
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
