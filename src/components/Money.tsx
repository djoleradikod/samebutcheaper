"use client";

import type { Currency } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import { useLocal } from "@/lib/client/country";
import { FX_SOURCE, fallbackNotice } from "@/lib/localize";

/**
 * A price in the selected country's currency. A converted one always reads "about", in a smaller size so
 * it doesn't fight the figure. Works anywhere, including inside server components.
 */
export function Money({ n, from, prose = false }: { n: number; from: Currency; /** In a sentence: "about" at full size. */ prose?: boolean }) {
  const local = useLocal();
  const text = local.bare(n, from);
  if (!local.converts(from)) return <>{text}</>;
  if (prose) return <>about {text}</>;
  return (
    <>
      <span className="text-[0.55em] font-medium">about </span>
      {text}
    </>
  );
}

/** A unit price at the unit it reads best in, marked the same way. */
export function UnitAmount({ ppu, unit, from }: { ppu: number; unit: string; from: Currency }) {
  const local = useLocal();
  const text = local.unitBare(ppu, unit, from);
  if (!local.converts(from)) return <>{text}</>;
  return (
    <>
      <span className="text-[0.55em] font-medium">about </span>
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
  const text = useLocal().original(n, from, market, checked);
  if (!text) return null;
  return <span className={`block text-xs leading-tight font-medium text-muted ${className}`}>({text})</span>;
}

/** Says plainly when the prices on a page aren't the selected country's own. */
export function FallbackBand() {
  const notice = fallbackNotice(useLocal());
  if (!notice) return null;
  return (
    <p className="border-b border-line bg-canvas px-4 py-2 text-[13px] leading-snug font-medium text-ink-2 sm:px-6">
      {notice.text}
      {notice.rate && (
        <>
          {" "}
          <a href={FX_SOURCE.url} target="_blank" rel="noopener" className="underline underline-offset-2">
            {notice.rate}
          </a>
        </>
      )}
    </p>
  );
}
