import { MARKETS, type MarketCode } from "./markets";
import type { ProductSide } from "./types";

import { affiliateEnv, livePrograms, liveSubNetwork, tagLink, type Env, type TaggedLink } from "./affiliate-links";
import { feedLinkOr, type FeedInfo } from "./feed-links";
import feedLinks from "../generated/feed-links.json";
import { RETAILER_LABEL, storeName } from "./store-name";

export { amazonTag } from "./affiliate-links";
export { RETAILER_LABEL, linkStoreName, storeName } from "./store-name";

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

/**
 * Whether the link /go sends this product's shopper to really carries a tag, so the page next to it can say so
 * honestly: a programme's env setting tags the store link, or an affiliate feed's tracked link replaces it (pass the
 * side's price record, `pair.prices.alternative`, as `seen`). The same choice the /go route makes.
 */
export function mayEarn(
  p: Pick<ProductSide, "retailer" | "asin" | "url">,
  market: MarketCode = "US",
  seen?: { feed?: FeedInfo },
  env: Env = affiliateEnv(),
): boolean {
  return tagLink(feedLinkOr(seen, productUrl(p, market)), "", env).program !== null;
}

/** Whether any Amazon link on the site carries a tag. Amazon's required wording only appears then. */
export function amazonEarns() {
  return livePrograms().some((p) => p.network === "amazon");
}

/** Whether any link on the site can earn us anything: a programme switched on, a sub-network, or a feed's tracked link. */
export function linksEarn(env: Env = affiliateEnv(), feedSides: number = feedLinks.sides) {
  return livePrograms(env).length > 0 || liveSubNetwork(env) !== null || feedSides > 0;
}

/** Whether a sub-network is on, so any store link may earn. */
export function subNetworkEarns() {
  return liveSubNetwork(affiliateEnv()) !== null;
}

/** "on Amazon", "at Tesco", "at uline.com". Without a URL an unnamed store is "the store". German: "bei Amazon", "beim Händler". */
export function atStore(retailer: string, url?: string, lang: "en" | "de" = "en") {
  if (lang === "de") {
    if (retailer === "amazon") return "bei Amazon";
    const name = url ? storeName(retailer, url) : RETAILER_LABEL[retailer];
    return name ? `bei ${name}` : "beim Händler";
  }
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

