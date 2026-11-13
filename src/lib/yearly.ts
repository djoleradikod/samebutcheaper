/**
 * What a swap saves in a year, from how often the shopper says they buy the brand's pack.
 *
 * Pure and shared by server and client. We have no data on how often anyone buys anything, so the shopper picks it.
 * Until they do, the figure is for "every month" (or the last choice they made on another swap), and the page says so.
 *
 *   yearly saving = brand packs a year x brand pack size x (brand unit price - cheaper unit price)
 *
 * The unit prices come straight from the recorded prices and pack sizes, not the rounded per-pack figure, so twelve
 * months of a pack is exactly twelve packs' worth. Things you buy once (a charger, a tool, a single durable item)
 * get no yearly figure at all, and records priced per wash or per 100 ml have no pack to count.
 */
import { money, type Currency } from "./format";
import type { Local } from "./localize";

export const FREQUENCIES = [
  { id: "1w", label: "every week", perYear: 52 },
  { id: "2w", label: "every 2 weeks", perYear: 26 },
  { id: "1m", label: "every month", perYear: 12 },
  { id: "2m", label: "every 2 months", perYear: 6 },
  { id: "3m", label: "every 3 months", perYear: 4 },
  { id: "6m", label: "twice a year", perYear: 2 },
  { id: "1y", label: "once a year", perYear: 1 },
] as const;

export type FrequencyId = (typeof FREQUENCIES)[number]["id"];

/** The assumption before the shopper has said anything. The page names it beside the figure. */
export const DEFAULT_FREQUENCY: FrequencyId = "1m";

const BY_ID = new Map<string, (typeof FREQUENCIES)[number]>(FREQUENCIES.map((f) => [f.id, f]));

export function isFrequency(x: unknown): x is FrequencyId {
  return typeof x === "string" && BY_ID.has(x);
}

export function packsPerYear(id: FrequencyId) {
  return BY_ID.get(id)!.perYear;
}

export function frequencyLabel(id: FrequencyId) {
  return BY_ID.get(id)!.label;
}

/** The two recorded prices and pack sizes. Both sides are priced in the same unit and currency (the catalogue enforces it). */
export type SwapPrices = { brandPrice: number; brandSize: number; altPrice: number; altSize: number };

/** Saved on one brand-name pack's worth: that many units at the cheaper unit price instead of the brand's. Never below zero. */
export function packSaving({ brandPrice, brandSize, altPrice, altSize }: SwapPrices) {
  return Math.max(0, brandPrice - (altPrice / altSize) * brandSize);
}

/** Saved in a year when the shopper buys the brand's pack this often, in the record's own currency. */
export function yearlySaving(prices: SwapPrices, often: FrequencyId) {
  return packsPerYear(often) * packSaving(prices);
}

// ---------------------------------------------------------------------------------------------------------------------
// Which swaps get a yearly figure

/**
 * yearly: something you keep buying, so a figure a year makes sense.
 * once: a durable thing you buy once (a charger, a tool, a single item). It shows the one-off saving.
 * per-amount: a record priced per wash, per cell or per 100 ml, with no pack to count. It shows no yearly figure.
 */
export type SavingKind = "yearly" | "once" | "per-amount";

/** What the rule reads from a swap. */
export type KindInput = {
  category: string;
  /** The brand side's unit and pack size. */
  unit: string;
  size: number;
  /** Both product names, which say "price per wash" on a record priced per amount. */
  products: string[];
};

/** Amounts by weight, volume or area: always something you use up. */
const MEASURE = /^(fl ?oz|oz|ml|cl|l|litre|liter|g|gram|gramme|mg|kg|kilo|kilogram|lb|square metre|square meter|m2)\b/i;

/** Units that are a durable thing, whatever the aisle or pack size: four trackers or a 128 GB stick are still bought once. */
const DURABLE_UNITS = new Set([
  "adapter",
  "cable",
  "charger",
  "gb",
  "tb",
  "hub",
  "inflator",
  "kettle",
  "keyboard",
  "mouse",
  "pan",
  "pot",
  "ratchet",
  "stylu",
  "stylus",
  "tool",
  "tracker",
]);

/** Hardware aisles, where a counted item lasts (a hose, pliers, a set of brushes or drill bits) unless it's one of these. */
const HARDWARE = new Set(["tech-tools", "tools-diy", "car", "garden"]);
const USED_UP = new Set(["battery", "batterie", "cell", "filter", "glove", "wipe", "yard", "roll", "bag", "sheet", "label"]);

export function savingKind({ category, unit, size, products }: KindInput): SavingKind {
  const u = unit.trim().toLowerCase();
  if (products.some((p) => /\b(price|cost) per\b/i.test(p))) return "per-amount";
  if (MEASURE.test(u)) return "yearly";
  if (DURABLE_UNITS.has(u)) return "once";
  if (HARDWARE.has(category) && !USED_UP.has(u)) return "once";
  // One of something that isn't a measure: a single tablet, a kit, a pair. Nobody buys it monthly.
  if (size <= 1) return "once";
  return "yearly";
}

// ---------------------------------------------------------------------------------------------------------------------
// The shopper's choices, as stored on the device

/** Per swap, plus the last choice, which stands in for swaps they haven't set. */
export type OftenChoices = { last: FrequencyId | null; swaps: Record<string, FrequencyId> };

export const NO_CHOICES: OftenChoices = { last: null, swaps: {} };

/** Reads what's stored, dropping anything that isn't a choice we offer. Bad or missing data is no choices, never an error. */
export function parseChoices(raw: string | null): OftenChoices {
  if (!raw) return NO_CHOICES;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return NO_CHOICES;
    const { last, swaps } = data as { last?: unknown; swaps?: unknown };
    const kept: Record<string, FrequencyId> = {};
    if (swaps && typeof swaps === "object" && !Array.isArray(swaps)) {
      for (const [slug, id] of Object.entries(swaps)) if (isFrequency(id)) kept[slug] = id;
    }
    return { last: isFrequency(last) ? last : null, swaps: kept };
  } catch {
    return NO_CHOICES;
  }
}

export function withChoice(choices: OftenChoices, slug: string, often: FrequencyId): OftenChoices {
  return { last: often, swaps: { ...choices.swaps, [slug]: often } };
}

/** How often to count for a swap, and whether the shopper set it for this swap (if not, it's an assumption and reads as one). */
export function frequencyFor(choices: OftenChoices, slug: string): { often: FrequencyId; chosen: boolean } {
  const own = choices.swaps[slug];
  if (own) return { often: own, chosen: true };
  return { often: choices.last ?? DEFAULT_FREQUENCY, chosen: false };
}

// ---------------------------------------------------------------------------------------------------------------------
// Adding up

export type Amount = { amount: number; currency: Currency };

/**
 * One figure in the shopper's currency, marked "about" if any part had to be converted. With no country there's
 * no currency to convert into, so each currency keeps its own total rather than adding pounds to euros.
 */
export function totalText(parts: readonly Amount[], local: Local) {
  if (!local.known) {
    const totals = new Map<Currency, number>();
    for (const p of parts) totals.set(p.currency, (totals.get(p.currency) ?? 0) + p.amount);
    return [...totals].map(([currency, total]) => money(total, currency)).join(" + ");
  }
  const total = money(parts.reduce((sum, p) => sum + local.amount(p.amount, p.currency), 0), local.currency);
  return parts.some((p) => local.converts(p.currency)) ? `about ${total}` : total;
}
