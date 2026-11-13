import type { Currency } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import type { CategorySlug, MatchType } from "@/lib/types";
import type { SavingKind, SwapPrices } from "@/lib/yearly";
import type { LineMatch } from "./match";

/** What the result shows for one catalogue swap. Built on the server from the record, see view.ts. */
export type SwapView = {
  slug: string;
  href: string;
  market: MarketCode;
  /** The brand and the brand-name product as the swap page names them. */
  from: string;
  fromProduct: string;
  to: string;
  toProduct: string;
  match: MatchType;
  savingsPct: number;
  /** Saved on one brand-name pack, in `currency`. */
  savings: number;
  currency: Currency;
  category: CategorySlug;
  unit: string;
  fromPhoto: string | null;
  toPhoto: string | null;
  yearly: { kind: SavingKind; prices: SwapPrices; pack: string; per: string } | null;
};

/** One product line of the shopper's list, as the result shows it. */
export type ResultLine = {
  index: number;
  /** The line as typed. Only ever sent back to the browser that sent it; never stored or logged. */
  text: string;
  /**
   * For a line with nothing on file: the cleaned name we count, so the page can show exactly what that is. For a "did you
   * mean": the name the page counts if the shopper answers No.
   */
  counted?: string | null;
} & LineMatch;

export type CheckResult = {
  lines: ResultLine[];
  noise: number;
  swaps: Record<string, SwapView>;
};
