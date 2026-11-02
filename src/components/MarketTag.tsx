"use client";

import { flag, MARKET_LABEL, type MarketCode } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";

/** "🇬🇧 UK prices" on a swap priced somewhere other than where the shopper is. */
export function MarketTag({ market }: { market: MarketCode }) {
  const country = useCountry() ?? "US";
  if (country === market) return null;
  return (
    <span
      title={`Prices checked in ${MARKET_LABEL[market]} stores`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted"
    >
      <span aria-hidden="true">{flag(market)}</span>
      {MARKET_LABEL[market]} prices
    </span>
  );
}
