"use client";

import { MARKET_LABEL, type MarketCode } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";

/**
 * "UK prices", in plain text, on a swap priced somewhere other than where the shopper is.
 * `whereToBuy` is the id of the section that says what to look for at home.
 */
export function MarketTag({
  market,
  whereToBuy,
  className = "",
}: {
  market: MarketCode;
  whereToBuy?: string;
  className?: string;
}) {
  const country = useCountry() ?? "US";
  if (country === market) return null;
  const title = `Prices checked in ${MARKET_LABEL[market]} stores`;
  if (!whereToBuy) {
    return (
      <span title={title} className={`whitespace-nowrap text-[13px] font-medium text-muted ${className}`}>
        {MARKET_LABEL[market]} prices
      </span>
    );
  }
  return (
    <span className={`text-[13px] font-medium text-ink-2 ${className}`}>
      These are {MARKET_LABEL[market]} prices.{" "}
      <a
        href={`#${whereToBuy}`}
        className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0"
      >
        What to look for where you are
      </a>
    </span>
  );
}
