import Fuse, { type IFuseOptions } from "fuse.js";
import { PAIR_SEARCH } from "./search-options";
import type { Pair, PairSummary } from "./types";

/**
 * Whether a swap answers a "tell me when you add it" request. Conservative on purpose, since a wrong match sends
 * someone an email about a product they didn't ask for:
 *  1. the site's own search (the same Fuse settings as the search box) must find the swap for the words; and
 *  2. every word of the request must be a whole word of the brand-name product (brand and product name) or of the
 *     cheaper product (brand and product name). Ingredients, aisles and keywords never count on their own.
 * So "advil" matches an Advil swap, "advil liqui-gels" only one whose product name says Liqui-Gels, and
 * "ibuprofen" matches nothing unless a product is called that.
 */

/** The words of a query or a name: lower case, accents off, split on anything that isn't a letter or digit. */
export function words(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 || /\d/.test(w));
}

/** Every word of the query is a word of the name. */
export function coveredBy(query: string, name: string) {
  const want = words(query);
  if (!want.length) return false;
  const have = new Set(words(name));
  return want.every((w) => have.has(w));
}

/** Step 2 above: the request names this swap's brand-name product or its cheaper product. */
export function namesMatch(query: string, p: Pick<PairSummary, "brandName" | "brandProduct" | "altName" | "altProduct">) {
  return coveredBy(query, `${p.brandName} ${p.brandProduct}`) || coveredBy(query, `${p.altName} ${p.altProduct}`);
}

/** The fields the site search reads, as src/lib/catalog.ts toSummary fills them (that file is server-only). */
export type SearchFields = Pick<PairSummary, "slug" | "title" | "subcategory" | "brandName" | "brandProduct" | "altName" | "altProduct" | "keywords">;
export function searchFields(p: Pair): SearchFields {
  return {
    slug: p.slug,
    title: p.title,
    subcategory: p.subcategory,
    brandName: p.brand.brand,
    brandProduct: p.brand.product,
    altName: p.alternative.brand,
    altProduct: p.alternative.product,
    keywords: [p.brand.key_ingredients.map((i) => i.name).join(" "), p.subcategory].join(" "),
  };
}

/** A matcher over a set of swaps, built once and asked many times. */
export function wishMatcher<T extends SearchFields>(pairs: readonly T[]) {
  const fuse = new Fuse(pairs, PAIR_SEARCH as unknown as IFuseOptions<T>);
  const memo = new Map<string, T[]>();
  return (query: string): T[] => {
    let found = memo.get(query);
    if (!found) {
      found = fuse
        .search(query)
        .map((r) => r.item)
        .filter((p) => namesMatch(query, p));
      memo.set(query, found);
    }
    return found;
  };
}

/**
 * How many waiting requests a swap named `query` would answer: those whose every word is in it. Adding a swap for
 * "advil liqui-gels" answers requests for "advil" and for "advil liqui-gels", not for "advil pm". For the admin's
 * "what to add first" list; the real match, at send time, is wishMatcher's.
 */
export function wouldRelease(query: string, wishes: readonly { query: string; n: number }[]) {
  return wishes.reduce((sum, w) => sum + (coveredBy(w.query, query) ? w.n : 0), 0);
}
