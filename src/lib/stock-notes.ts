import { storeName } from "./affiliate";
import { stockNote } from "./freshness";
import type { Bundle, Pair } from "./types";

/**
 * "X was out of stock at Walmart when its product feed was read on 12 Nov 2026." for each side an affiliate feed
 * last listed as out of stock (docs/feeds.md). Empty for every record until a feed is configured.
 */
export function stockNotes(record: Pair | Bundle): string[] {
  if ("alternative" in record) {
    const p = record as Pair;
    return [
      stockNote(p.prices.alternative, p.alternative.brand, storeName(p.alternative.retailer, p.alternative.url)),
      stockNote(p.prices.brand, p.brand.brand, storeName(p.brand.retailer, p.brand.url)),
    ].filter((s): s is string => s !== null);
  }
  const b = record as Bundle;
  return [
    stockNote(b.prices.kit, b.bundle.name, storeName(b.bundle.retailer, b.bundle.url)),
    ...b.components.map((c) => stockNote(b.prices[`item-${c.replaces}`], c.product, storeName(c.retailer, c.url))),
  ].filter((s): s is string => s !== null);
}
