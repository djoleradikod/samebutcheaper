import "server-only";
import type { BasketSummary } from "@/components/BasketCard";
import type { BasketLineView } from "@/components/BasketLines";
import { getPair } from "./catalog";
import { monthYear } from "./format";
import type { Preset } from "./types";

const MEDICINE = "otc-medicine";

/** Measures and counts that don't take a plural: "415 g", "6 fl oz", "30.8 oz powder", "300 count". */
const NO_PLURAL = /^(fl oz|oz|g|mg|kg|ml|cl|l|lb|mah|count)\b/i;

function plural(word: string) {
  // The catalogue strips a trailing "s", which leaves "stylu".
  if (word === "stylu") return "styluses";
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return /(s|x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
}

/** "415 g", "30 servings", "4 batteries", "1 stylus", from the catalogue's size and unit. */
export function packSize(size: number, unit: string) {
  const clean = unit.replace(/\s*\(.*\)\s*$/, "").trim();
  const n = Number.isInteger(size) ? String(size) : size.toFixed(1);
  if (NO_PLURAL.test(clean)) return `${n} ${clean}`;
  if (size === 1) return `${n} ${clean === "stylu" ? "stylus" : clean}`;
  return `${n} ${plural(clean)}`;
}

/** Real photos for a basket: the cheaper items first, then brand packs if asked, and medicine last. */
export function basketPhotos(preset: Preset, limit = 4, withBrands = false) {
  const cheaper: BasketSummary["photos"] = [];
  const brands: BasketSummary["photos"] = [];
  const medicine: BasketSummary["photos"] = [];
  for (const l of preset.lines) {
    const pair = getPair(l.pair);
    const isMedicine = pair?.category === MEDICINE;
    if (l.altPhoto) (isMedicine ? medicine : cheaper).push({ src: l.altPhoto, name: pair?.alternative.product ?? l.altName });
    if (withBrands && l.brandPhoto) (isMedicine ? medicine : brands).push({ src: l.brandPhoto, name: pair?.brand.product ?? l.brandName });
  }
  const seen = new Set<string>();
  return [...cheaper, ...brands, ...medicine]
    .filter((p) => {
      if (seen.has(p.src)) return false;
      seen.add(p.src);
      return true;
    })
    .slice(0, limit);
}

export function toBasketSummary(preset: Preset): BasketSummary {
  return {
    slug: preset.slug,
    market: preset.market,
    title: preset.title,
    audience: preset.audience,
    brandTotal: preset.brandTotal,
    altTotal: preset.altTotal,
    savings: preset.savings,
    savingsPct: preset.savingsPct,
    currency: preset.currency,
    itemCount: preset.lines.length,
    photos: basketPhotos(preset),
  };
}

/** True when medicine makes up most of the basket, so it can sort last. */
export function isMedicineBasket(preset: Preset) {
  const medicine = preset.lines.filter((l) => getPair(l.pair)?.category === MEDICINE).length;
  return preset.icon === "pill" || medicine * 2 > preset.lines.length;
}

/** What the stepper needs, and the product names the alt text uses. */
export function basketLines(preset: Preset): BasketLineView[] {
  return preset.lines.map((l) => {
    const pair = getPair(l.pair);
    return {
      slug: l.pair,
      qty: l.qty,
      note: l.note,
      subcategory: l.subcategory,
      category: pair?.category,
      brandName: l.brandName,
      brandProduct: pair?.brand.product ?? l.brandName,
      altName: l.altName,
      altProduct: pair?.alternative.product ?? l.altName,
      brandPhoto: l.brandPhoto,
      altPhoto: l.altPhoto,
      brandCost: l.brandCost,
      altCost: l.altCost,
      savingsPct: l.savingsPct,
      unit: l.unit,
      brandPpu: l.brandPpu,
      altPpu: l.altPpu,
      pack: pair ? packSize(pair.brand.size, pair.brand.unit) : null,
    };
  });
}

/** "November 2026", or "July to November 2026" when a basket's prices span months. */
export function priceDates(preset: Preset) {
  const dates = preset.lines
    .map((l) => getPair(l.pair)?.price_checked)
    .filter((d): d is string => !!d)
    .sort();
  if (!dates.length) return null;
  const first = monthYear(dates[0]);
  const last = monthYear(dates[dates.length - 1]);
  return first === last ? last : `${first} to ${last}`;
}
