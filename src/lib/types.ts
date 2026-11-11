import type { Checkout } from "./delivery";
import type { BundleInput, ClaimInput, ImageRecord, NutritionRecord, NutritionSource, PairInput, PresetInput, ShelfLifeInput } from "./schema";
import type { MarketCurrency as Currency } from "./format";
import type { LookFor, MarketCode } from "./markets";
import type { RatingScale } from "./rating";

export type MatchType = PairInput["match_type"];
export type CategorySlug = PairInput["category"];

/** A self-hosted photo: <src>-160.webp and <src>-480.webp, with its licence record. */
export type Photo = {
  src: string;
  credit: string;
  license: string;
  page: string;
  source: string;
  /** The right product but a poor picture. It sorts after clean photos. */
  weak?: boolean;
};

/** A rating after the catalogue build: the raw score and scale, what it comes to as a share, and how it reads. */
export type Rating = {
  score: number;
  scale: RatingScale;
  count?: number;
  source: string;
  date?: string;
  publisher?: string;
  wording?: string;
  share: number;
  label: string;
};

export type ProductSide = Omit<PairInput["brand"], "rating"> & {
  rating: Rating | null;
  /** Price per single unit (e.g. per tablet, per fl oz). */
  ppu: number;
  photo: Photo | null;
  /** Open Food Facts record, for food only. Null when there is none on file. */
  nutrition: NutritionRecord | null;
};

export type Claim = ClaimInput;
export type ShelfLife = ShelfLifeInput;
export type { ImageRecord, NutritionRecord, NutritionSource };

/** What a bigger pack does for you. All from sourced prices. */
export type BulkView = {
  /** Units of the cheaper pack you must use before buying it beat buying the brand as you go. */
  breakEvenUnits: number;
  /** Bigger pack of the alternative, when one is on file. */
  bigger?: { product: string; size: number; price: number; ppu: number; retailer: string; url: string; extraSavingPct: number };
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
  /** Who sells the cheaper product, for the seller rule in localize.ts. */
  sellers: string[];
  /** This same swap priced in another market. A list shows one of the two, see localize.ts. */
  twin: { slug: string; market: MarketCode } | null;
  /** What to search for in countries where this listing doesn't deliver. */
  lookFor: LookFor;
  /** Findings that apply to this swap, most specific first. */
  evidence_claims: Claim[];
  shelfLife: ShelfLife | null;
  bulkView: BulkView;
  /** The price record is more than a year old when the catalogue was built. */
  priceOld: boolean;
  /** Who to credit for the nutrition records on this swap. Null when neither side has one. */
  nutritionSource: NutritionSource | null;
};

export type PresetLine = {
  pair: string;
  qty: number;
  note?: string;
  title: string;
  subcategory: string;
  brandName: string;
  altName: string;
  brandPhoto: string | null;
  altPhoto: string | null;
  /** Cost of qty brand packs. */
  brandCost: number;
  /** Cost of the same amount of the alternative, at its unit price. */
  altCost: number;
  saved: number;
  savingsPct: number;
  unit: string;
  brandPpu: number;
  altPpu: number;
};

export type Preset = Omit<PresetInput, "items"> & {
  lines: PresetLine[];
  /** Every line's seller. A basket only lists where all of them sell. */
  sellers: string[];
  brandTotal: number;
  altTotal: number;
  savings: number;
  savingsPct: number;
  currency: Currency;
  /** Up to four photos of the cheaper items, for the card. */
  photos: string[];
  /** Share of lines with a real photo of the cheaper item, 0 to 1. */
  photoShare: number;
  score: number;
};

export type BundleComponent = BundleInput["components"][number] & {
  ppu: number;
  photo: Photo | null;
  /** Cost of the same amount the bundle contains (ppu x bundle item size). */
  equivalentCost: number;
  lookFor: LookFor;
  /** Who sells it (see sellers.ts), which groups pieces into one order per store. */
  seller: string;
};

export type Bundle = Omit<BundleInput, "components"> & {
  /** The brand kit's own photo, when one is on file. */
  photo: Photo | null;
  components: BundleComponent[];
  /** Every component's seller. A kit only lists where all of them sell. */
  sellers: string[];
  /** Sum of equivalentCost over all components. */
  equivalentTotal: number;
  /** Sum of full-pack prices (what you pay at the register to build it). */
  upfrontTotal: number;
  savingsPct: number;
  /** Saved per bundle, in the bundle's currency. */
  savings: number;
  score: number;
  currency: Currency;
  /** Who sells the brand's kit. */
  kitSeller: string;
  /** Rebuilding it: one order per store, with each store's delivery against its free-delivery threshold. */
  checkout: Checkout;
  /** Buying the kit: one order, with its store's delivery. */
  kitCheckout: Checkout;
  /** What the rebuild's extra orders add in delivery and surcharges over the kit's one order. Null when a rule is unknown. */
  extraDelivery: number | null;
  /** The saving after that extra delivery, when it's known; otherwise the same as savings. */
  netSavings: number;
  netSavingsPct: number;
};

export type Catalog = {
  generatedAt: string;
  pairs: Pair[];
  bundles: Bundle[];
  presets: Preset[];
  claims: Claim[];
  shelfLife: ShelfLife[];
  /** Every self-hosted photo in use, for the credits page. */
  credits: (Photo & { brand: string; product: string })[];
  /** Coverage numbers the gauntlet tracks. */
  coverage: {
    pairs: number;
    bothSidesReal: number;
    anySideReal: number;
    medicine: number;
    categories: number;
    markets: Record<string, number>;
  };
};

/** Light-weight shape shipped to the client for search and filtering. */
export type PairSummary = {
  slug: string;
  title: string;
  market: MarketCode;
  sellers: string[];
  twin: { slug: string; market: MarketCode } | null;
  /** How the cheaper product rates, as it reads on a card. Null when we have no rating. */
  altRating: string | null;
  currency: Currency;
  category: CategorySlug;
  subcategory: string;
  brandName: string;
  brandProduct: string;
  altName: string;
  altProduct: string;
  /** Base path of a self-hosted photo (no size suffix), or null for a drawn tile. */
  brandImage: string | null;
  altImage: string | null;
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
