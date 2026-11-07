"use client";

import type { PairSummary } from "@/lib/types";
import { BasketCard, type BasketSummary } from "./BasketCard";
import { PairCard } from "./PairCard";

/**
 * The homepage's top swaps, for the shopper's country. The page picks the list on the server.
 */
export function FeaturedPairs({
  list,
  limit = 12,
  eagerFirst = false,
}: {
  list: PairSummary[];
  limit?: number;
  /** True when these are the first images on the page. */
  eagerFirst?: boolean;
}) {
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
  list,
  limit = 6,
}: {
  list: BasketSummary[];
  limit?: number;
}) {
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
