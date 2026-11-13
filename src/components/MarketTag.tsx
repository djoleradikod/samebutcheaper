"use client";

import { useContext } from "react";
import { localFor, type Local } from "@/lib/localize";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { CountryContext, FixedContext, useLocal } from "@/lib/client/country";
import { useT } from "@/lib/i18n/client";
import { tagVariants } from "@/lib/reserve";
import { marketTag } from "@/lib/i18n/en/client/marketTag";
import { picker } from "@/lib/i18n/en/client/picker";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { marketTag, picker };

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
          {/* In the page's language, so the invisible copy is the same text as the visible one and reserves its height. */}
          <Tag {...props} local={localFor(v.country, false, local.lang)} />
        </span>
      ))}
    </>
  );
}

function Tag({ market, whereToBuy, className = "", local }: TagProps & { local: Local }) {
  const t = useT(TEXT);
  if (local.country === market) return null;
  const from = MARKETS[market].currency;
  const title = t("picker.pricesCheckedIn", market);
  if (!whereToBuy) {
    return (
      <span title={title} className={`whitespace-nowrap text-[13px] font-medium text-muted ${className}`}>
        {t("picker.marketPrices", market)}
      </span>
    );
  }
  return (
    <span className={`text-[13px] font-medium text-ink-2 ${className}`}>
      {t("marketTag.these", market, local.converts(from) ? t("marketTag.converted", from, local.currency) : "")}{" "}
      <a
        href={`#${whereToBuy}`}
        className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-0"
      >
        {t("marketTag.lookFor")}
      </a>
    </span>
  );
}
