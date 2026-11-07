import { ppu, type Currency } from "./format";

/** How a unit reads on a shelf ticket, and what to multiply the per-unit price by to match. */
export type UnitDisplay = { label: string; factor: number };

/** The catalogue strips a trailing "s" from units, which breaks a few words. These put them back. */
const SINGULAR: Record<string, string> = {
  stylu: "stylus",
  glas: "glass",
  gummie: "gummy",
  nappie: "nappy",
  boxe: "box",
  pouche: "pouch",
  brushe: "brush",
};

/** Things you buy one at a time, where "per pot" reads worse than "each". */
const EACH = new Set([
  "adapter",
  "cable",
  "charger",
  "count",
  "each",
  "item",
  "keyboard",
  "kit",
  "mouse",
  "pan",
  "piece",
  "pot",
  "ratchet",
  "stylus",
  "tracker",
  "unit",
]);

const SAME_AS: Record<string, UnitDisplay> = {
  g: { label: "per 100 g", factor: 100 },
  gram: { label: "per 100 g", factor: 100 },
  gramme: { label: "per 100 g", factor: 100 },
  mg: { label: "per 100 mg", factor: 100 },
  kg: { label: "per kg", factor: 1 },
  kilo: { label: "per kg", factor: 1 },
  kilogram: { label: "per kg", factor: 1 },
  ml: { label: "per 100 ml", factor: 100 },
  cl: { label: "per 100 ml", factor: 10 },
  l: { label: "per litre", factor: 1 },
  litre: { label: "per litre", factor: 1 },
  liter: { label: "per litre", factor: 1 },
  lb: { label: "per lb", factor: 1 },
  load: { label: "per wash", factor: 1 },
  wash: { label: "per wash", factor: 1 },
  washe: { label: "per wash", factor: 1 },
  // One dishwasher pac is one wash.
  pac: { label: "per wash", factor: 1 },
  battery: { label: "per cell", factor: 1 },
  batterie: { label: "per cell", factor: 1 },
  cell: { label: "per cell", factor: 1 },
};

/** "g" reads as "per 100 g", "load" as "per wash", "pot" as "each". */
export function unitDisplay(unit: string): UnitDisplay {
  const raw = unit.trim().toLowerCase();
  const known = SAME_AS[raw];
  if (known) return known;
  if (/^fl ?oz\b/.test(raw)) return { label: "per fl oz", factor: 1 };
  if (/^oz\b/.test(raw)) return { label: "per oz", factor: 1 };
  // "serving (5 g)" is just a serving on a ticket; the detail is on the swap page.
  if (/^serving\b/.test(raw)) return { label: "per serving", factor: 1 };
  const word = SINGULAR[raw] ?? raw;
  if (EACH.has(word)) return { label: "each", factor: 1 };
  return { label: `per ${word}`, factor: 1 };
}

/** A per-unit price at the unit it reads best in: 37¢, 3.7¢, $13.83. */
export function unitPrice(pricePerUnit: number, unit: string, currency: Currency) {
  const n = pricePerUnit * unitDisplay(unit).factor;
  // From 10 cents up, a tenth of a cent is noise.
  const rounded = Math.round(n * 100) / 100;
  if (rounded < 0.1) return ppu(n, currency);
  return rounded < 1 ? ppu(rounded, currency).replace(/\.\d/, "") : ppu(rounded, currency);
}

/** For two close prices, such as a pack and its bigger pack: a tenth of a cent can be the whole difference, so it stays. */
export function unitPriceFine(pricePerUnit: number, unit: string, currency: Currency) {
  return ppu(pricePerUnit * unitDisplay(unit).factor, currency);
}

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

/**
 * Test results price a product per wash or per 100 ml, not per pack. A basket line on such a record
 * counts that amount, so it says "16 washes in all" and not "16 packs of 1 wash".
 */
export function isPerAmountRecord(size: number, unit: string) {
  const clean = unit.trim().toLowerCase();
  return (size === 1 && /^(wash|load|use|tablet|capsule|sheet)$/.test(clean)) || (size === 100 && /^(ml|g)$/.test(clean));
}
