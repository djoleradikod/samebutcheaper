/**
 * Filtering and ordering kits on /bundles. Pure, for the client list and tests.
 * Amounts are already in the shopper's currency, so kits from two markets sort together.
 */

export type KitFacts = {
  slug: string;
  aisle: string;
  /** Every piece comes from one store, so it's one order like the kit. */
  oneStore: boolean;
  /** The saving after the rebuild's extra delivery, in the shopper's currency. */
  net: number;
  netPct: number;
  /** Position in the page's default order: photos first, then score. */
  rank: number;
  /** Shoppers have reported it as changed (src/lib/reported-state.ts): it sorts last under every order, so it never leads. */
  stale?: boolean;
};

export const KIT_SORTS = [
  { value: "recommended", label: "Best first" },
  { value: "amount", label: "Most saved after delivery" },
  { value: "pct", label: "Biggest % saved after delivery" },
] as const;

export type KitSort = (typeof KIT_SORTS)[number]["value"];

export function filterKits<T extends KitFacts>(items: readonly T[], { aisle, oneStore, sort }: { aisle: string; oneStore: boolean; sort: KitSort }): T[] {
  const list = items.filter((i) => (aisle === "all" || i.aisle === aisle) && (!oneStore || i.oneStore));
  const by: Record<KitSort, (a: T, b: T) => number> = {
    recommended: (a, b) => a.rank - b.rank,
    amount: (a, b) => b.net - a.net || b.netPct - a.netPct,
    pct: (a, b) => b.netPct - a.netPct || b.net - a.net,
  };
  return [...list].sort((a, b) => Number(!!a.stale) - Number(!!b.stale) || by[sort](a, b) || a.slug.localeCompare(b.slug));
}
