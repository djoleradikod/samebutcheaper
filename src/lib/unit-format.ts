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
