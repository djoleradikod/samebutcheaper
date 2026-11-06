import "server-only";
import catalogJson from "@/generated/catalog.json";
import type { Bundle, Catalog, CategorySlug, Claim, Pair, PairSummary, Preset } from "./types";
import { CATEGORIES } from "./categories";
import { APPROX_USD, type MarketCode } from "./markets";
import { dupeActives, dupeSlugFor } from "./dupes";

const catalog = catalogJson as unknown as Catalog;

/** All pairs, ordered by ranking score (biggest savings first). */
export function getAllPairs(): Pair[] {
  return catalog.pairs;
}

export function getPair(slug: string): Pair | undefined {
  return catalog.pairs.find((p) => p.slug === slug);
}

export function getPairsByCategory(category: CategorySlug): Pair[] {
  return catalog.pairs.filter((p) => p.category === category);
}

export function getFeaturedPairs(limit = 12, market?: MarketCode): Pair[] {
  // Medicine never leads. Swaps with real photos come first, one per subcategory for variety, then fill.
  const inMarket = market ? catalog.pairs.filter((p) => p.market === market) : catalog.pairs;
  const notMedicine = inMarket.filter((p) => p.category !== "otc-medicine");
  const photoFirst = (p: Pair) => (p.alternative.photo ? 0 : 1) + (p.brand.photo ? 0 : 1);
  const pool = [...notMedicine].sort((a, b) => photoFirst(a) - photoFirst(b) || b.score - a.score);
  const picked: Pair[] = [];
  const seenSub = new Set<string>();
  const seenCat = new Map<string, number>();
  for (const p of pool) {
    const key = `${p.category}:${p.subcategory.toLowerCase()}`;
    if (p.confidence !== "high" || seenSub.has(key) || (seenCat.get(p.category) ?? 0) >= 3) continue;
    seenSub.add(key);
    seenCat.set(p.category, (seenCat.get(p.category) ?? 0) + 1);
    picked.push(p);
    if (picked.length >= limit) return picked;
  }
  for (const p of pool) {
    if (!picked.includes(p)) picked.push(p);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function getBiggestDollarSavings(limit = 6): Pair[] {
  const usd = (p: Pair) => p.savingsPerPack * APPROX_USD[p.currency];
  return [...catalog.pairs].sort((a, b) => usd(b) - usd(a)).slice(0, limit);
}

export function getRelatedPairs(pair: Pair, limit = 4): Pair[] {
  // Same country's prices first, then the closest product type.
  const rank = (p: Pair) => (p.market === pair.market ? 0 : 2) + (p.subcategory === pair.subcategory ? 0 : 1);
  return catalog.pairs
    .filter((p) => p.slug !== pair.slug && p.category === pair.category)
    .map((p, i) => ({ p, r: rank(p), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Markets with verified prices, with how many swaps each has. */
export function getMarketCounts(): Partial<Record<MarketCode, number>> {
  const counts: Partial<Record<MarketCode, number>> = {};
  for (const p of catalog.pairs) counts[p.market] = (counts[p.market] ?? 0) + 1;
  return counts;
}

export function getCategoryStats() {
  return CATEGORIES.map((c) => {
    const pairs = getPairsByCategory(c.slug);
    const avg = pairs.length ? pairs.reduce((s, p) => s + p.savingsPct, 0) / pairs.length : 0;
    const max = pairs.reduce((m, p) => Math.max(m, p.savingsPct), 0);
    return { ...c, count: pairs.length, avgSavings: avg, maxSavings: max };
  });
}

export function getSiteStats() {
  const pairs = catalog.pairs;
  const avg = pairs.length ? pairs.reduce((s, p) => s + p.savingsPct, 0) / pairs.length : 0;
  const sources = pairs.reduce((s, p) => s + p.sources.length, 0);
  return {
    pairs: pairs.length,
    avgSavings: avg,
    sources,
    categories: CATEGORIES.filter((c) => pairs.some((p) => p.category === c.slug)).length,
    generatedAt: catalog.generatedAt,
  };
}

export function toSummary(p: Pair): PairSummary {
  return {
    slug: p.slug,
    title: p.title,
    market: p.market,
    currency: p.currency,
    category: p.category,
    subcategory: p.subcategory,
    brandName: p.brand.brand,
    brandProduct: p.brand.product,
    altName: p.alternative.brand,
    altProduct: p.alternative.product,
    brandImage: p.brand.photo?.src ?? null,
    altImage: p.alternative.photo?.src ?? null,
    unit: p.brand.unit,
    brandPpu: p.brand.ppu,
    altPpu: p.alternative.ppu,
    savingsPct: p.savingsPct,
    savingsPerPack: p.savingsPerPack,
    matchType: p.match_type,
    confidence: p.confidence,
    score: p.score,
    keywords: [
      p.brand.key_ingredients.map((i) => i.name).join(" "),
      p.subcategory,
    ].join(" "),
  };
}

/* ---------------------------------------------------------------- bundles */

export function getAllBundles(): Bundle[] {
  return catalog.bundles ?? [];
}

export function getBundle(slug: string): Bundle | undefined {
  return getAllBundles().find((b) => b.slug === slug);
}

/* ---------------------------------------------------------------- presets */

export function getAllPresets(): Preset[] {
  return catalog.presets ?? [];
}

export function getPreset(slug: string): Preset | undefined {
  return getAllPresets().find((p) => p.slug === slug);
}

/** One card per family, in the shopper's market when it exists there, else the biggest saving. */
export function getPresetsFor(market: MarketCode): Preset[] {
  const byFamily = new Map<string, Preset[]>();
  for (const p of getAllPresets()) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
  return [...byFamily.values()]
    .map((list) => list.find((p) => p.market === market) ?? [...list].sort((a, b) => b.score - a.score)[0])
    .sort((a, b) => Number(b.market === market) - Number(a.market === market) || b.score - a.score);
}

/* --------------------------------------------------------------- evidence */

export function getClaims(): Claim[] {
  return catalog.claims ?? [];
}

export function getShelfLife() {
  return catalog.shelfLife ?? [];
}

export function getCredits() {
  return catalog.credits ?? [];
}

export function getCoverage() {
  return catalog.coverage;
}

/* ---------------------------------------------------- ingredients & brands */

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ingredient matches only count for chemistry-based matches, not specs. */
const INGREDIENT_MATCHES = new Set(["identical_active", "identical_formula", "same_manufacturer"]);

const INGREDIENT_STOP = new Set(["chemistry", "formula", "ingredients", "sodium", "potassium", "chloride", "dextrose", "maltodextrin"]);

/** Canonical ingredient key: drops salt forms and grade labels so "Cetirizine HCl" and "cetirizine" group. */
export function ingredientKey(name: string) {
  const base = slugify(name)
    .replace(/-(usp|nf|hcl|hydrochloride|dihydrochloride|monohydrate)\b/g, "")
    .replace(/^white-(petrolatum)$/, "$1")
    .replace(/-+$/g, "")
    .replace(/\b(paracetamol|aciclovir|beclometasone|salbutamol)\b/g, (w) => SAME_AS_US[w]);
  return INGREDIENT_STOP.has(base) ? "" : base;
}

/** International names that group with their US names, so UK and US swaps share one page. */
const SAME_AS_US: Record<string, string> = {
  paracetamol: "acetaminophen",
  aciclovir: "acyclovir",
  beclometasone: "beclomethasone",
  salbutamol: "albuterol",
};

/** Page titles that show both names. */
const DUAL_NAME: Record<string, string> = {
  acetaminophen: "Acetaminophen (paracetamol)",
  acyclovir: "Acyclovir (aciclovir)",
  "beclomethasone-dipropionate": "Beclomethasone (beclometasone) dipropionate",
};

function ingredientLabel(name: string) {
  return name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\b(USP|NF|HCl|hydrochloride|dihydrochloride)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type IngredientEntry = { slug: string; name: string; pairs: Pair[] };

const ingredientIndex: Map<string, IngredientEntry> = (() => {
  const map = new Map<string, IngredientEntry>();
  for (const p of catalog.pairs) {
    if (!INGREDIENT_MATCHES.has(p.match_type)) continue;
    for (const ing of p.alternative.key_ingredients) {
      const slug = ingredientKey(ing.name);
      if (!slug || slug.length < 3) continue;
      const entry = map.get(slug) ?? { slug, name: DUAL_NAME[slug] ?? ingredientLabel(ing.name), pairs: [] };
      if (!entry.pairs.includes(p)) entry.pairs.push(p);
      map.set(slug, entry);
    }
  }
  return map;
})();

export function getIngredients(): IngredientEntry[] {
  return [...ingredientIndex.values()].sort((a, b) => b.pairs.length - a.pairs.length || a.name.localeCompare(b.name));
}

export function getIngredient(slug: string) {
  return ingredientIndex.get(slug);
}

export function ingredientSlugFor(name: string): string | undefined {
  const slug = ingredientKey(name);
  return ingredientIndex.has(slug) ? slug : undefined;
}

export type BrandEntry = { slug: string; name: string; pairs: Pair[]; bundles: Bundle[] };

const brandIndex: Map<string, BrandEntry> = (() => {
  const map = new Map<string, BrandEntry>();
  const get = (name: string) => {
    const slug = slugify(name);
    const entry = map.get(slug) ?? { slug, name, pairs: [], bundles: [] };
    map.set(slug, entry);
    return entry;
  };
  for (const p of catalog.pairs) get(p.brand.brand).pairs.push(p);
  for (const b of catalog.bundles ?? []) get(b.bundle.brand).bundles.push(b);
  return map;
})();

export function getBrands(): BrandEntry[] {
  return [...brandIndex.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getBrand(slug: string) {
  return brandIndex.get(slug);
}

export function brandSlugFor(name: string): string {
  return slugify(name);
}

/* ------------------------------------------------------------------ dupes */

export type DupeEntry = {
  slug: string;
  brand: string;
  /** Active ingredients, or null when the match is on specs. */
  actives: string[] | null;
  subcategory: string;
  /** Biggest saving first. */
  pairs: Pair[];
};

const dupeIndex: Map<string, DupeEntry> = (() => {
  const map = new Map<string, DupeEntry>();
  for (const p of catalog.pairs) {
    const slug = dupeSlugFor(p);
    const entry = map.get(slug) ?? {
      slug,
      brand: p.brand.brand,
      actives: dupeActives(p),
      subcategory: p.subcategory,
      pairs: [],
    };
    entry.pairs.push(p);
    map.set(slug, entry);
  }
  for (const e of map.values()) e.pairs.sort((a, b) => b.savingsPct - a.savingsPct);
  return map;
})();

export function getDupes(): DupeEntry[] {
  return [...dupeIndex.values()];
}

export function getDupe(slug: string) {
  return dupeIndex.get(slug);
}

/** Other brands' pages for the same actives. */
export function getRelatedDupes(entry: DupeEntry, limit = 6): DupeEntry[] {
  if (!entry.actives) return [];
  const key = entry.actives.join("|").toLowerCase();
  return getDupes()
    .filter((d) => d.slug !== entry.slug && d.actives?.join("|").toLowerCase() === key)
    .slice(0, limit);
}
