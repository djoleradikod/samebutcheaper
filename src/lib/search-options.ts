import type { IFuseOptions } from "fuse.js";
import type { BundleSummary } from "./browse";
import type { PairSummary } from "./types";

/**
 * How the site search weighs a swap's fields. One definition, so the search box (src/components/SearchClient.tsx)
 * and answering "tell me when you add it" (src/lib/wanted-answer.ts) find the same swaps for the same words.
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

export const BUNDLE_SEARCH: IFuseOptions<BundleSummary> = {
  keys: [
    { name: "bundle.brand", weight: 3 },
    { name: "bundle.name", weight: 2 },
    { name: "title", weight: 2 },
    { name: "bundle.items.name", weight: 1 },
    { name: "components.product", weight: 1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};
