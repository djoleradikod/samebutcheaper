"use client";

import type { Currency } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import { useContext } from "react";
import { CountryContext, FixedContext, setShowOthers, useLocal } from "@/lib/client/country";
import { FX_SOURCE, fallbackNotice, originalPriceText } from "@/lib/localize";
import { countryInSentence } from "@/lib/markets";
import { useT } from "@/lib/i18n/client";
import { shared } from "@/lib/i18n/en/client/shared";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { shared };

/**
 * A price in the selected country's currency. A converted one always reads "about", in a smaller size so
 * it doesn't fight the figure. Works anywhere, including inside server components.
 */
export function Money({ n, from, prose = false }: { n: number; from: Currency; /** In a sentence: "about" at full size. */ prose?: boolean }) {
  const local = useLocal();
  const about = useT(TEXT)("shared.about");
  const text = local.bare(n, from);
  if (!local.converts(from)) return <>{text}</>;
  if (prose) return <>{about} {text}</>;
  return (
    <>
      <span className="text-[0.55em] font-medium">{about} </span>
      {text}
    </>
  );
}

/** A unit price at the unit it reads best in, marked the same way. */
export function UnitAmount({ ppu, unit, from }: { ppu: number; unit: string; from: Currency }) {
  const local = useLocal();
  const about = useT(TEXT)("shared.about");
  const text = local.unitBare(ppu, unit, from);
  if (!local.converts(from)) return <>{text}</>;
  return (
    <>
      <span className="text-[0.55em] font-medium">{about} </span>
      {text}
    </>
  );
}

/** "(£9.99 at a UK store, Nov 2026)" beside a converted price. Nothing when no conversion happened. */
export function OriginalPrice({
  n,
  from,
  market,
  checked,
  className = "",
}: {
  n: number;
  from: Currency;
  market: MarketCode;
  checked: string;
  className?: string;
}) {
  const local = useLocal();
  const text = local.original(n, from, market, checked);
  const fixed = useContext(FixedContext);
  const fromServer = useContext(CountryContext);
  // A record's stand-in converts nothing, but holds this line's space for a shopper whose view will (src/lib/reserve.ts).
  if (fixed && fromServer == null) {
    return (
      <span className={`orig-slot text-xs leading-tight font-medium ${className}`} data-from={from} aria-hidden="true">
        {/* In the page's language: the same text as the line it stands in for, or the reserved height is wrong. */}
        ({originalPriceText(n, from, market, checked, local.lang)})
      </span>
    );
  }
  if (!text) return null;
  return <span className={`block text-xs leading-tight font-medium text-muted ${className}`}>({text})</span>;
}

/** Says plainly when the prices on a page aren't the selected country's own. */
/** Says whose prices these are and, where we've left out stores we can't place in this country, offers them back. */
export function FallbackBand({ hidden }: { hidden: number }) {
  const local = useLocal();
  const notice = fallbackNotice(local);
  if (!notice) return null;
  const buttonClass = "cursor-pointer font-semibold text-cobalt underline underline-offset-2";
  return (
    <p className="band-size border-b border-line bg-canvas px-4 py-2 text-[13px] leading-snug font-medium text-ink-2 sm:px-6">
      {notice.text}
      {notice.rate && (
        <>
          {" "}
          <a href={FX_SOURCE.url} target="_blank" rel="noopener" className="underline underline-offset-2">
            {notice.rate}
          </a>
        </>
      )}
      {local.others ? (
        <>
          {" "}
          This includes stores we couldn&apos;t confirm sell in {countryInSentence(local.country)}.{" "}
          <button type="button" className={buttonClass} onClick={() => setShowOthers(false)}>
            Hide swaps from other countries
          </button>
        </>
      ) : (
        hidden > 0 && (
          <>
            {" "}
            We list only stores we could confirm sell in {countryInSentence(local.country)}.{" "}
            <button type="button" className={buttonClass} onClick={() => setShowOthers(true)}>
              Show {hidden} swaps from other countries
            </button>
          </>
        )
      )}
    </p>
  );
}
