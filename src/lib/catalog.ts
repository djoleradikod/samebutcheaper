import "server-only";
import catalogJson from "@/generated/catalog.json";
import type { Bundle, Catalog, CategorySlug, Claim, Pair, PairSummary, Preset } from "./types";
import { CATEGORIES } from "./categories";
import { APPROX_USD, type MarketCode } from "./markets";
import { dupeActives, dupeSlugFor } from "./dupes";
import { INGREDIENT_MATCHES, ingredientKey, ingredientPageKey, slugify } from "./ingredient-key";
import { isCutOut } from "./photos";

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

/** The worst standing: no photo on either side. */
export const NO_PHOTO_STANDING = 5;

/**
 * How a swap looks on the home page. A raw snapshot is the last thing we want beside a clean pack,
 * so one cut-out and a typographic tile beats one cut-out and a snapshot.
 * 0: two cut-outs. 1: one cut-out, one tile. 2: one cut-out, one snapshot. 3: two snapshots.
 * 4: one snapshot, one tile. 5: no photos.
 */
export function photoStanding(p: Pair): number {
  const sides = [p.brand.photo, p.alternative.photo];
  const photos = sides.filter(Boolean).length;
  const cutOuts = sides.filter(isCutOut).length;
  if (cutOuts === 2) return 0;
  if (cutOuts === 1) return photos === 1 ? 1 : 2;
  if (photos === 2) return 3;
  return photos === 1 ? 4 : NO_PHOTO_STANDING;
}

/** No raw snapshot on this card: at most a cut-out and a typographic tile. */
export function showsOnlyCutOuts(p: Pair) {
  return photoStanding(p) <= 1;
}

/**
 * The best photo among these swaps, in their order: a cut-out of a cheaper product, a cut-out of
 * a brand, then a snapshot of either. Null when none of them has a photo.
 */
export function bestPhoto(pairs: Pair[]) {
  for (const cutOut of [true, false]) {
    for (const side of ["alternative", "brand"] as const) {
      for (const pair of pairs) {
        const { photo, product } = pair[side];
        if (photo && isCutOut(photo) === cutOut) return { pair, photo, name: product };
      }
    }
  }
  return null;
}

/**
 * Fills a grid from the best photo standing down, leaving out swaps with an old price. Caps add
 * variety only among swaps of equal standing: capped-out swaps still go ahead of a lower standing.
 */
export function pickByPhotos(
  pool: Pair[],
  limit: number,
  capsFor: (p: Pair) => { key: string; max: number }[],
): Pair[] {
  const picked: Pair[] = [];
  for (let standing = 0; standing <= NO_PHOTO_STANDING; standing++) {
    const tier = pool.filter((p) => !p.priceOld && photoStanding(p) === standing);
    const counts = new Map<string, number>();
    for (const p of tier) {
      if (picked.length >= limit) return picked;
      const caps = capsFor(p);
      if (caps.some((c) => (counts.get(c.key) ?? 0) >= c.max)) continue;
      for (const c of caps) counts.set(c.key, (counts.get(c.key) ?? 0) + 1);
      picked.push(p);
    }
    for (const p of tier) {
      if (picked.length >= limit) return picked;
      if (!picked.includes(p)) picked.push(p);
    }
  }
  return picked;
}

export function getFeaturedPairs(limit = 12, market?: MarketCode, pick: (pairs: Pair[]) => Pair[] = (pairs) => pairs): Pair[] {
  // Medicine never leads. Within a photo standing: high confidence, one per subcategory and three per aisle, then fill.
  const inMarket = market ? catalog.pairs.filter((p) => p.market === market) : catalog.pairs;
  const pool = pick(inMarket).filter((p) => p.category !== "otc-medicine").sort((a, b) => b.score - a.score);
  return pickByPhotos(pool, limit, (p) => [
    { key: "confidence", max: p.confidence === "high" ? Infinity : 0 },
    { key: `${p.category}:${p.subcategory.toLowerCase()}`, max: 1 },
    { key: p.category, max: 3 },
  ]);
}

export function getBiggestDollarSavings(limit = 6): Pair[] {
  const usd = (p: Pair) => p.savingsPerPack * APPROX_USD[p.currency];
  return [...catalog.pairs].sort((a, b) => usd(b) - usd(a)).slice(0, limit);
}

export function getRelatedPairs(pair: Pair, limit = 4): Pair[] {
  // Same country's prices first, then the closest product type.
  const rank = (p: Pair) => (p.market === pair.market ? 0 : 2) + (p.subcategory === pair.subcategory ? 0 : 1);
  const others = catalog.pairs.filter((p) => p.slug !== pair.slug && p.category === pair.category);
  // These are image cards, so swaps with a photo go first and text-only cards show only in an aisle with no photos at all.
  const withPhoto = others.filter((p) => p.brand.photo || p.alternative.photo);
  return (withPhoto.length ? withPhoto : others)
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

/** `pick` narrows each aisle first, for a shopper who only sees some markets. */
export function getCategoryStats(pick: (pairs: Pair[]) => Pair[] = (pairs) => pairs) {
  return CATEGORIES.map((c) => {
    const pairs = pick(getPairsByCategory(c.slug));
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
    sellers: p.sellers,
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
export function getPresetsFor(market: MarketCode, pool: Preset[] = getAllPresets()): Preset[] {
  const byFamily = new Map<string, Preset[]>();
  for (const p of pool) byFamily.set(p.family, [...(byFamily.get(p.family) ?? []), p]);
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

export { ingredientKey, slugify };

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
      const slug = ingredientPageKey(ing.name);
      if (!slug) continue;
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
