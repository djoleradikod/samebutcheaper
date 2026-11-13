import { storeName } from "./affiliate";
import { checkedDate, type PriceSeen } from "./freshness";
import { getT, type Lang } from "./i18n";
import type { Bundle, Pair } from "./types";

/** One side's note in the page's language, or null when its feed doesn't list it as out of stock. */
function noteFor(seen: PriceSeen | undefined, name: string, store: string, lang: Lang) {
  if (seen?.feed?.stock !== "out") return null;
  return getT(lang)("prices.outOfStock", name, store, checkedDate(seen.feed.seen, "day", lang));
}

/**
 * "X was out of stock at Walmart when its product feed was read on 12 Nov 2026." for each side an affiliate feed
 * last listed as out of stock (docs/feeds.md). Empty for every record until a feed is configured.
 */
export function stockNotes(record: Pair | Bundle, lang: Lang = "en"): string[] {
  if ("alternative" in record) {
    const p = record as Pair;
    return [
      noteFor(p.prices.alternative, p.alternative.brand, storeName(p.alternative.retailer, p.alternative.url), lang),
      noteFor(p.prices.brand, p.brand.brand, storeName(p.brand.retailer, p.brand.url), lang),
    ].filter((s): s is string => s !== null);
  }
  const b = record as Bundle;
  return [
    noteFor(b.prices.kit, b.bundle.name, storeName(b.bundle.retailer, b.bundle.url), lang),
    ...b.components.map((c) => noteFor(b.prices[`item-${c.replaces}`], c.product, storeName(c.retailer, c.url), lang)),
  ].filter((s): s is string => s !== null);
}
