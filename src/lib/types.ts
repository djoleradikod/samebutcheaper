import type { BundleInput, PairInput } from "./schema";
import type { Currency } from "./format";
import type { LookFor, MarketCode } from "./markets";

export type MatchType = PairInput["match_type"];
export type CategorySlug = PairInput["category"];

export type ProductSide = PairInput["brand"] & {
  /** Price per single unit (e.g. per tablet, per fl oz). */
  ppu: number;
};

export type Pair = Omit<PairInput, "brand" | "alternative"> & {
  brand: ProductSide;
  alternative: ProductSide;
  /** 0-100, how much cheaper the alternative is per unit. */
  savingsPct: number;
  /** Dollars saved when buying the same quantity as one brand-name pack. */
  savingsPerPack: number;
  /** Ranking score used for "biggest savings" ordering. */
  score: number;
  currency: Currency;
  /** What to search for in countries where this listing doesn't deliver. */
  lookFor: LookFor;
};

export type BundleComponent = BundleInput["components"][number] & {
  ppu: number;
  /** Cost of the same amount the bundle contains (ppu x bundle item size). */
  equivalentCost: number;
  lookFor: LookFor;
};

export type Bundle = Omit<BundleInput, "components"> & {
  components: BundleComponent[];
  /** Sum of equivalentCost over all components. */
  equivalentTotal: number;
  /** Sum of full-pack prices (what you pay at the register to build it). */
  upfrontTotal: number;
  savingsPct: number;
  /** Saved per bundle, in the bundle's currency. */
  savings: number;
  score: number;
  currency: Currency;
};

export type Catalog = {
  generatedAt: string;
  pairs: Pair[];
  bundles: Bundle[];
};

/** Light-weight shape shipped to the client for search and filtering. */
export type PairSummary = {
  slug: string;
  title: string;
  market: MarketCode;
  currency: Currency;
  category: CategorySlug;
  subcategory: string;
  brandName: string;
  brandProduct: string;
  altName: string;
  altProduct: string;
  unit: string;
  brandPpu: number;
  altPpu: number;
  savingsPct: number;
  savingsPerPack: number;
  matchType: MatchType;
  confidence: "high" | "medium";
  score: number;
  keywords: string;
};
