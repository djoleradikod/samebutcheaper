"use client";

import type { Currency } from "@/lib/format";
import { setBuyingOften, useBuyingOften } from "@/lib/client/buyingOften";
import { frequencyFor, packSaving, yearlySaving, type SavingKind, type SwapPrices } from "@/lib/yearly";
import { FrequencySelect } from "./FrequencySelect";
import { Money } from "./Money";

export type YearlySavingProps = {
  slug: string;
  kind: SavingKind;
  prices: SwapPrices;
  currency: Currency;
  /** The brand's name, for the sentence and the control's label. */
  brand: string;
  /** "100 tablets", the brand's pack. */
  pack: string;
  /** "per wash", for a record priced per amount. */
  per: string;
};

/**
 * The swap page's "in a year" block. Before the shopper picks, it counts a pack every month (or their last choice on
 * another swap) and says it's an assumption. Things you buy once show the one-off saving instead.
 * The first render has no stored choice, on the server and in the browser alike, and the stored one only changes words
 * and figures inside lines that keep their size.
 */
export function YearlySaving({ slug, kind, prices, currency, brand, pack, per }: YearlySavingProps) {
  const choices = useBuyingOften();

  if (kind === "per-amount") {
    return (
      <p className="mt-3 text-[13px] text-muted">
        These prices are {per}, not for a pack, so there&apos;s no pack to count over a year.
      </p>
    );
  }

  if (kind === "once") {
    return (
      <div className="mt-4 rounded-card border border-line bg-canvas px-3 py-2.5 md:px-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold">
          Saves
          <span className="price text-[1.625rem] text-ink">
            <Money n={packSaving(prices)} from={currency} />
          </span>
          once
        </p>
        <p className="mt-0.5 text-[13px] text-ink-2">Not a regular buy, so we don&apos;t put a yearly figure on it.</p>
      </div>
    );
  }

  const { often, chosen } = frequencyFor(choices, slug);
  return (
    <div className="mt-4 rounded-card border border-line bg-canvas px-3 py-2.5 md:px-4">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-[15px] font-semibold" aria-live="polite" aria-atomic="true">
        Saves
        <span className="price text-[1.625rem] text-ink tabular-nums">
          <Money n={yearlySaving(prices, often)} from={currency} />
        </span>
        a year
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[15px] text-ink-2">
        <span>
          if you buy the {brand} pack ({pack})
        </span>
        <FrequencySelect value={often} onChange={(next) => setBuyingOften(slug, next)} label={`How often you buy the ${brand} pack`} />
      </div>
      <p className="mt-1.5 text-[13px] text-muted">
        {chosen ? "Your choice, kept on this device only." : "Our assumption, not yours. Pick how often you buy it."}
      </p>
    </div>
  );
}
