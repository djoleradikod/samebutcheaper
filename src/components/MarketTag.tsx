"use client";

import { MARKET_ADJECTIVE, rateDate, rateText, currencyName } from "@/lib/localize";
import { MARKET_LABEL, MARKETS, type MarketCode } from "@/lib/markets";
import { useLocal } from "@/lib/client/country";

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
  const local = useLocal();
  if (local.country === market) return null;
  const from = MARKETS[market].currency;
  const label = MARKET_ADJECTIVE[market];
  const title = `Prices checked in ${MARKET_LABEL[market]} stores`;
  if (!whereToBuy) {
    return (
      <span title={title} className={`whitespace-nowrap text-[13px] font-medium text-muted ${className}`}>
        {label} prices
      </span>
    );
  }
  return (
    <span className={`text-[13px] font-medium text-ink-2 ${className}`}>
      These are {label} prices{local.converts(from) ? `, shown in ${currencyName(local.currency)} at the ECB rate of ${rateDate()} (${rateText(from, local.currency)})` : ""}.{" "}
      <a
        href={`#${whereToBuy}`}
        className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0"
      >
        What to look for where you are
      </a>
    </span>
  );
}
