"use client";

import { isMarket, type MarketCode } from "@/lib/markets";
import type { PairSummary } from "@/lib/types";
import { useCountry } from "@/lib/client/country";
import { BasketCard, type BasketSummary } from "./BasketCard";
import { PairCard } from "./PairCard";

/**
 * The homepage's top swaps. The page builds one list per market that has enough swaps of its
 * own, filled up from the US list. Everyone else sees the US list, our largest.
 */
export function FeaturedPairs({
  lists,
  limit = 12,
  eagerFirst = false,
}: {
  lists: Partial<Record<MarketCode, PairSummary[]>>;
  limit?: number;
  /** True when these are the first images on the page. */
  eagerFirst?: boolean;
}) {
  const country = useCountry();
  const list = (isMarket(country) ? lists[country] : undefined) ?? lists.US ?? [];
  const shown = list.slice(0, limit);
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
      {shown.map((p, i) => (
        <PairCard key={p.slug} pair={p} eager={eagerFirst && i === 0} />
      ))}
    </div>
  );
}

/**
 * The basket presets: the shopper's market first, in two rows on a desktop and a
 * sideways snap rail on a phone, where the next card shows at the edge.
 */
export function FeaturedBaskets({
  lists,
  limit = 6,
}: {
  lists: Partial<Record<MarketCode, BasketSummary[]>>;
  limit?: number;
}) {
  const country = useCountry();
  const list = (isMarket(country) ? lists[country] : undefined) ?? lists.US ?? [];
  if (!list.length) return null;
  return (
    <div className="rail rail-snap -mx-4 -my-1 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:px-0 xl:grid-cols-3">
      {list.slice(0, limit).map((b, i) => (
        <div key={b.slug} className="w-[70vw] max-w-[300px] shrink-0 snap-start md:w-auto md:max-w-none">
          <BasketCard basket={b} eager={i === 0} />
        </div>
      ))}
    </div>
  );
}
