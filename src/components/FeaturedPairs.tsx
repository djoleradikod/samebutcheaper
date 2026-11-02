"use client";

import { isMarket, type MarketCode } from "@/lib/markets";
import type { PairSummary } from "@/lib/types";
import { useCountry } from "@/lib/client/country";
import { PairCard } from "./PairCard";

/**
 * The homepage's top swaps, using prices from the shopper's own country when
 * we have enough of them. Everyone else sees the US list, our largest.
 */
export function FeaturedPairs({ lists, limit = 12 }: { lists: Partial<Record<MarketCode, PairSummary[]>>; limit?: number }) {
  const country = useCountry();
  const us = lists.US ?? [];
  const own = isMarket(country) && country !== "US" ? (lists[country] ?? []) : [];
  const shown = own.length >= 3 ? [...own, ...us].slice(0, limit) : us.slice(0, limit);
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((p, i) => (
        <PairCard key={p.slug} pair={p} rank={i + 1} />
      ))}
    </div>
  );
}
