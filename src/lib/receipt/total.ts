/**
 * The yearly figure for a checked shopping list, and the link that shares it. Pure, shared by server, client and tests.
 *
 * The counting follows src/lib/yearly.ts exactly, as My list does: a swap you keep buying counts at how often the
 * shopper says they buy it (every month until they say, and the page says that is an assumption), a thing bought once
 * counts once and is never added into the year, and a record priced per wash has no pack to count.
 */
import type { Currency } from "@/lib/format";
import { frequencyFor, isFrequency, yearlySaving, type FrequencyId, type OftenChoices, type SavingKind, type SwapPrices } from "@/lib/yearly";

/** What the total needs from a swap. */
export type Countable = {
  slug: string;
  /** Saved on one brand-name pack, in the record's currency. */
  savings: number;
  currency: Currency;
  yearly: { kind: SavingKind; prices: SwapPrices } | null;
};

export type Counted =
  | { how: "yearly"; amount: number; often: FrequencyId; chosen: boolean }
  | { how: "once"; amount: number }
  | { how: "per-amount" };

/**
 * One swap as the total counts it. `shared` is a frequency that came in a shared link: it stands until the viewer
 * picks their own on this page, and it counts as chosen (the person who shared it chose it).
 */
export function countSwap(item: Countable, choices: OftenChoices, shared?: FrequencyId | null): Counted {
  const y = item.yearly;
  if (!y || y.kind === "once") return { how: "once", amount: item.savings };
  if (y.kind === "per-amount") return { how: "per-amount" };
  const own = choices.swaps[item.slug];
  const { often, chosen } = own ? { often: own, chosen: true } : shared ? { often: shared, chosen: true } : frequencyFor(choices, item.slug);
  return { how: "yearly", amount: yearlySaving(y.prices, often), often, chosen };
}

// ---------------------------------------------------------------------------------------------------------------------
// The share link: catalogue slugs and, where the shopper picked one, how often. Never a word of the receipt.

export type Shared = { slug: string; often: FrequencyId | null };

/** Most swaps a link carries. */
export const SHARE_MAX = 60;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "slug.1m~other-slug~third.2w" */
export function shareValue(items: readonly Shared[]): string {
  return items
    .slice(0, SHARE_MAX)
    .map((i) => (i.often ? `${i.slug}.${i.often}` : i.slug))
    .join("~");
}

/** Reads a shared link back, keeping only swaps that exist, once each, and frequencies we offer. Anything else is dropped. */
export function parseShare(raw: string | null | undefined, exists: (slug: string) => boolean): Shared[] {
  if (!raw) return [];
  const out: Shared[] = [];
  const seen = new Set<string>();
  for (const part of raw.slice(0, 8000).split("~")) {
    const [slug, often] = part.split(".");
    if (!slug || !SLUG.test(slug) || seen.has(slug) || !exists(slug)) continue;
    seen.add(slug);
    out.push({ slug, often: isFrequency(often) ? often : null });
    if (out.length >= SHARE_MAX) break;
  }
  return out;
}
