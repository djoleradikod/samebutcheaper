import { storeName, storeSplit } from "@/lib/affiliate";
import "server-only";
import type { BasketSummary } from "@/components/BasketCard";
import type { BasketLineView } from "@/components/BasketLines";
import { getPair } from "./catalog";
import { monthYear } from "./format";
import { isCutOut } from "./photos";
import type { Preset } from "./types";
import { isPerAmountRecord, packSize } from "./unit-format";
import { MARKET_ADJECTIVE, type Local } from "@/lib/localize";

export { packSize };

const MEDICINE = "otc-medicine";

type BasketPhoto = BasketSummary["photos"][number] & { cutOut: boolean; medicine: boolean; brandSide: boolean };

/** Every photo a basket could show, best first: not medicine, cut-outs, then the cheaper item before its brand. */
function photoChoices(preset: Preset): BasketPhoto[] {
  const score = (p: BasketPhoto) => (p.medicine ? 4 : 0) + (p.cutOut ? 0 : 2) + (p.brandSide ? 1 : 0);
  return preset.lines
    .flatMap((l) => {
      const pair = getPair(l.pair);
      const medicine = pair?.category === MEDICINE;
      const found: BasketPhoto[] = [];
      if (l.altPhoto) {
        const cutOut = isCutOut(pair?.alternative.photo);
        found.push({ src: l.altPhoto, name: pair?.alternative.product ?? l.altName, cutOut, medicine, brandSide: false });
      }
      if (l.brandPhoto) {
        const cutOut = isCutOut(pair?.brand.photo);
        found.push({ src: l.brandPhoto, name: pair?.brand.product ?? l.brandName, cutOut, medicine, brandSide: true });
      }
      return found;
    })
    .sort((a, b) => score(a) - score(b));
}

const justPhoto = ({ src, name }: BasketPhoto) => ({ src, name });

/** Real photos for a basket: cut-outs first, the cheaper items before brand packs if asked, and medicine last. */
export function basketPhotos(preset: Preset, limit = 4, withBrands = false) {
  const seen = new Set<string>();
  return photoChoices(preset)
    .filter((p) => {
      if (seen.has(p.src) || (p.brandSide && !withBrands)) return false;
      seen.add(p.src);
      return true;
    })
    .slice(0, limit)
    .map(justPhoto);
}

/** How many cut-outs a home page collage could use, before other cards take theirs. */
export function cutOutCount(preset: Preset) {
  return new Set(photoChoices(preset).filter((p) => p.cutOut && !p.medicine).map((p) => p.src)).size;
}

/** How many photos of any kind a home page collage could use. */
export function photoCount(preset: Preset) {
  return new Set(photoChoices(preset).filter((p) => !p.medicine).map((p) => p.src)).size;
}

/**
 * Photos for a row of basket cards, with no picture on two cards. Cards take a cut-out in turns, the one
 * with the fewest left going first, so a big basket can't empty a small one. A card only falls back to
 * snapshots if it ends up with no cut-out at all. Medicine stays off the first screens, so its photos are
 * left out. A card with fewer photos than slots gets a collage laid out for that number.
 */
export function assignBasketPhotos(presets: Preset[], limit = 4) {
  const used = new Set<string>();
  const key = (p: BasketPhoto) => p.name.toLowerCase();
  const free = (p: BasketPhoto) => !used.has(p.src) && !used.has(key(p));
  const take = (p: BasketPhoto) => {
    used.add(p.src);
    used.add(key(p));
    return justPhoto(p);
  };

  const cards = presets.map((preset) => ({
    slug: preset.slug,
    choices: photoChoices(preset).filter((p) => !p.medicine),
    photos: [] as BasketSummary["photos"],
  }));
  const cutOutsLeft = (card: (typeof cards)[number]) => card.choices.filter((p) => p.cutOut && free(p)).length;

  for (let round = 0; round < limit; round++) {
    for (const card of [...cards].sort((a, b) => cutOutsLeft(a) - cutOutsLeft(b))) {
      const next = card.choices.find((p) => p.cutOut && free(p));
      if (next) card.photos.push(take(next));
    }
  }
  for (const card of cards) {
    if (card.photos.length) continue;
    for (const p of card.choices) {
      if (card.photos.length < limit && free(p)) card.photos.push(take(p));
    }
  }
  return new Map(cards.map((c) => [c.slug, c.photos]));
}

/** Names for the typographic tiles of a basket with no photos to show, medicine last. */
function tileNames(preset: Preset) {
  const lines = preset.lines.map((l) => ({ name: l.altName, medicine: getPair(l.pair)?.category === MEDICINE }));
  const names = [...lines.filter((l) => !l.medicine), ...lines.filter((l) => l.medicine)].map((l) => l.name);
  const unique = [...new Set(names)].slice(0, 4);
  return unique.length ? unique : [preset.title];
}

export function toBasketSummary(preset: Preset, photos = basketPhotos(preset, 4, true)): BasketSummary {
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
    storeCount: basketStores(preset).length,
    photos,
    tileNames: tileNames(preset),
  };
}

/** Where a line's cheaper side is sold. */
function altStore(slug: string, local?: Local) {
  const pair = getPair(slug);
  if (!pair) return "Other stores";
  const alt = pair.alternative;
  // We never name a store that doesn't sell where the shopper is.
  if (local && !local.sells(alt.retailer, pair.market)) return `${MARKET_ADJECTIVE[pair.market]} stores`;
  return storeName(alt.retailer, alt.url);
}

/** The stores the cheaper side comes from, biggest share of the cheaper total first. */
export function basketStores(preset: Preset) {
  return storeSplit(preset.lines.map((l) => ({ store: altStore(l.pair), cost: l.altCost })));
}

/** True when medicine makes up most of the basket, so it can sort last. */
export function isMedicineBasket(preset: Preset) {
  const medicine = preset.lines.filter((l) => getPair(l.pair)?.category === MEDICINE).length;
  return preset.icon === "pill" || medicine * 2 > preset.lines.length;
}

/** What the stepper needs, and the product names the alt text uses. */
export function basketLines(preset: Preset, local?: Local): BasketLineView[] {
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
      altStore: altStore(l.pair, local),
      brandCost: l.brandCost,
      altCost: l.altCost,
      savingsPct: l.savingsPct,
      unit: l.unit,
      brandPpu: l.brandPpu,
      altPpu: l.altPpu,
      pack: pair ? packSize(pair.brand.size, pair.brand.unit) : null,
      measure: pair && isPerAmountRecord(pair.brand.size, pair.brand.unit) ? { size: pair.brand.size, unit: pair.brand.unit } : null,
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
