"use client";

import { useContext } from "react";
import { localFor, MARKET_ADJECTIVE, rateDate, rateText, currencyName, type Local } from "@/lib/localize";
import { MARKET_LABEL, MARKETS, type MarketCode } from "@/lib/markets";
import { CountryContext, FixedContext, useLocal } from "@/lib/client/country";
import { tagVariants } from "@/lib/reserve";

type TagProps = { market: MarketCode; whereToBuy?: string; className?: string };

/**
 * "UK prices", in plain text, on a swap priced somewhere other than where the shopper is.
 * `whereToBuy` is the id of the section that says what to look for at home.
 *
 * In a record's stand-in (its own view, until the shopper's arrives) it also carries an invisible copy of the tag each
 * kind of shopper will get, and globals.css shows the one for this shopper's country, so the offers under it don't
 * move when the real one arrives (src/lib/reserve.ts).
 */
export function MarketTag(props: TagProps) {
  const local = useLocal();
  const fixed = useContext(FixedContext);
  const fromServer = useContext(CountryContext);
  const standIn = fixed && fromServer == null;
  if (!standIn || !props.whereToBuy) return <Tag {...props} local={local} />;
  return (
    <>
      <span className="mt-v" data-k="default">
        <Tag {...props} local={local} />
      </span>
      {tagVariants(props.market).map((v) => (
        <span key={v.token} className="mt-v" data-k={v.token} data-m={props.market} aria-hidden="true">
          <Tag {...props} local={localFor(v.country)} />
        </span>
      ))}
    </>
  );
}

function Tag({ market, whereToBuy, className = "", local }: TagProps & { local: Local }) {
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
