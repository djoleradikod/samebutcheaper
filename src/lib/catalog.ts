import "server-only";
import catalogJson from "@/generated/catalog.json";
import type { Catalog, CategorySlug, Pair, PairSummary } from "./types";
import { CATEGORIES } from "./categories";

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

export function getFeaturedPairs(limit = 12): Pair[] {
  // One-per-subcategory first so the homepage shows variety, then fill.
  const picked: Pair[] = [];
  const seenSub = new Set<string>();
  for (const p of catalog.pairs) {
    const key = `${p.category}:${p.subcategory.toLowerCase()}`;
    if (p.confidence !== "high" || seenSub.has(key)) continue;
    seenSub.add(key);
    picked.push(p);
    if (picked.length >= limit) return picked;
  }
  for (const p of catalog.pairs) {
    if (!picked.includes(p)) picked.push(p);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function getBiggestDollarSavings(limit = 6): Pair[] {
  return [...catalog.pairs].sort((a, b) => b.savingsPerPack - a.savingsPerPack).slice(0, limit);
}

export function getRelatedPairs(pair: Pair, limit = 4): Pair[] {
  const sameSub = catalog.pairs.filter(
    (p) => p.slug !== pair.slug && p.category === pair.category && p.subcategory === pair.subcategory,
  );
  const sameCat = catalog.pairs.filter(
    (p) => p.slug !== pair.slug && p.category === pair.category && !sameSub.includes(p),
  );
  return [...sameSub, ...sameCat].slice(0, limit);
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
    category: p.category,
    subcategory: p.subcategory,
    brandName: p.brand.brand,
    brandProduct: p.brand.product,
    altName: p.alternative.brand,
    altProduct: p.alternative.product,
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
