import type { PairInput } from "./schema";

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
};

export type Catalog = {
  generatedAt: string;
  pairs: Pair[];
};

/** Light-weight shape shipped to the client for search and filtering. */
export type PairSummary = {
  slug: string;
  title: string;
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
