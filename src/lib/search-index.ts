/**
 * What the site search reads about each swap and kit, and in which tier (src/lib/search-rank.ts). Shared by the browser
 * search (src/components/SearchClient.tsx) and the relevance test (scripts/tests/search-relevance.test.ts), so both
 * rank the same way.
 */
import { fold, makeSearch, type Field } from "./search-rank";
import type { BundleSummary } from "./browse";
import type { CategorySlug, Pair, PairSummary } from "./types";

/** The swap fields the search reads. `ing`: the active ingredient names, English and German, one per line. */
export type PairSearchFields = Pick<PairSummary, "slug" | "title" | "category" | "subcategory" | "brandName" | "brandProduct" | "altName" | "altProduct"> & {
  ing: string;
  de?: { subcategory: string };
};

/** The ingredient names of a swap, in English and, where the record has German text, in German, without repeats. */
export function ingredientNames(p: Pick<Pair, "brand" | "alternative"> & { de?: { ingredients?: { brand?: { name: string }[]; alternative?: { name: string }[] } } }) {
  const names = [
    ...p.brand.key_ingredients.map((i) => i.name),
    ...(p.alternative.key_ingredients ?? []).map((i) => i.name),
    ...(p.de?.ingredients?.brand ?? []).map((i) => i.name),
    ...(p.de?.ingredients?.alternative ?? []).map((i) => i.name),
  ];
  // One spelling each: "Ibuprofen" on both sides and in German is one name.
  const seen = new Map<string, string>();
  for (const n of names) if (!seen.has(fold(n))) seen.set(fold(n), n);
  return [...seen.values()].join("\n");
}

/** Aisle names to search by, English and German, keyed by aisle. Small, so it travels once in the index. */
export type AisleNames = Partial<Record<CategorySlug, string>>;

export function pairFields(p: PairSearchFields, aisles: AisleNames): Field[] {
  return [
    [0, p.brandName],
    [1, p.brandProduct],
    [1, p.altName],
    [1, p.altProduct],
    [1, p.title],
    [2, p.ing],
    [3, p.subcategory],
    [3, p.de?.subcategory ?? ""],
    [3, aisles[p.category] ?? ""],
  ];
}

export type BundleSearchFields = Pick<BundleSummary, "title" | "bundle" | "components" | "de">;

export function bundleFields(b: BundleSearchFields): Field[] {
  return [
    [0, b.bundle.brand],
    [1, b.bundle.name],
    [1, b.title],
    [1, b.de?.name ?? ""],
    ...b.bundle.items.map((i) => [1, i.name] as const),
    ...b.components.map((c) => [1, `${c.brand} ${c.product}`] as const),
  ];
}

export const searchPairs = <T extends PairSearchFields>(pairs: readonly T[], aisles: AisleNames) => makeSearch(pairs, (p) => pairFields(p, aisles));
export const searchBundles = <T extends BundleSearchFields>(bundles: readonly T[]) => makeSearch(bundles, bundleFields);
