import { MARKETS, type MarketCode } from "./markets";
import type { ProductSide } from "./types";

import { programFor, tagLink, type TaggedLink } from "./affiliate-links";

export { amazonTag } from "./affiliate-links";

/**
 * Outbound links for catalog products. The tagging itself (programs,
 * networks, sub-IDs, env config) lives in affiliate-links.ts and
 * affiliate-programs.ts.
 */

/** Adds affiliate parameters to any store URL we link to. */
export function tagUrl(url: string, clickId = ""): string {
  return tagLink(url, clickId).url;
}

/** The product's store URL before tagging: an Amazon ASIN becomes a /dp/ link in the right storefront. */
export function productUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">, market: MarketCode = "US"): string {
  if (p.retailer === "amazon" && p.asin) return `https://www.${MARKETS[market].amazon}/dp/${p.asin}`;
  return p.url;
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

/**
 * Whether this link can earn us money, so the page can say so honestly.
 * Pages are prerendered without secrets, so this is based on the program
 * list, not on which IDs are set: if a store is listed there we intend to be
 * in its program, and over-disclosing is the safe side.
 */
export function mayEarn(p: Pick<ProductSide, "retailer" | "url">): boolean {
  if (p.retailer === "amazon") return true;
  return Boolean(programFor(p.url)) || process.env.NEXT_PUBLIC_AFFILIATE_SUBNETWORK === "1";
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
  other: "retailer",
};
