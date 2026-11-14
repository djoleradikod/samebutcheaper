import { MARKET_LABEL, type MarketCode } from "../../../markets";
import { CATEGORY_MAP, MATCH_TYPE_META } from "../../../categories";
import { NO_RATING } from "../../../rating";
import type { CategorySlug, MatchType } from "../../../types";

/** A swap card and row (PairCard.tsx, UnitPrice.tsx), on lists and in search. */
export const cards = {
  moreSwaps: "More swaps",
  /** What a screen reader hears for the "−52%" ticket. */
  cheaperPct: (n: number) => `${n}% cheaper`,
  /** In place of the saving where a store's affiliate terms withhold the price (src/lib/programme-terms.ts). */
  seePriceAt: (store: string) => `Price at ${store}`,
  save: "Save",
  noRating: NO_RATING,
  /** The match as a card shows it. "Same active" alone is jargon; the other short names read fine. */
  matchShort: (type: MatchType) => (type === "identical_active" ? MATCH_TYPE_META[type].label : MATCH_TYPE_META[type].short),
  matchLabel: (type: MatchType) => MATCH_TYPE_META[type].label,
  /** What a screen reader hears for a product tile with no photo. */
  noPhoto: (name: string) => `${name}: no photo yet`,
  /** The short name as a badge shows it ("Same active"). */
  matchShortPlain: (type: MatchType) => MATCH_TYPE_META[type].short,
  confidence: {
    high: "Label-verified",
    highTitle: "Both labels were confirmed from primary sources",
    medium: "Strong evidence",
    mediumTitle: "Strong evidence, but not every detail came from a primary source",
  },
  matchDescription: (type: MatchType) => MATCH_TYPE_META[type].description,
  aisle: (slug: CategorySlug) => CATEGORY_MAP[slug].name,
  marketLabel: (m: string) => MARKET_LABEL[m as MarketCode],
};
