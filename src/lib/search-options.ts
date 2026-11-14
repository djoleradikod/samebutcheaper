import type { IFuseOptions } from "fuse.js";
import type { PairSummary } from "./types";

/**
 * The loose first pass when answering "tell me when you add it" (src/lib/wanted-match.ts), which then insists that every
 * word of the request names the product. The search box ranks with src/lib/search-rank.ts instead.
 */
export const PAIR_SEARCH: IFuseOptions<PairSummary> = {
  keys: [
    { name: "brandName", weight: 3 },
    { name: "brandProduct", weight: 2 },
    { name: "title", weight: 2 },
    { name: "altName", weight: 1.5 },
    { name: "altProduct", weight: 1 },
    { name: "subcategory", weight: 1 },
    // The shelf in German, from the search index, so /de/search finds "Erkältung" as well as "cold".
    { name: "de.subcategory", weight: 1 },
    { name: "keywords", weight: 1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};
