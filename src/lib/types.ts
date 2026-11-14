import type { Checkout } from "./delivery";
import type { BundleDe, BundleInput, ClaimDe, ClaimInput, ImageRecord, NutritionRecord, NutritionSource, PairDe, PairInput, PresetDe, PresetInput, ShelfLifeDe, ShelfLifeInput } from "./schema";
import type { MarketCurrency as Currency } from "./format";
import type { LookFor, MarketCode } from "./markets";
import type { RatingScale } from "./rating";
import type { Freshness, PriceSeen } from "./freshness";
import type { Withheld } from "./programme-terms";

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

/** `de`: the German text, from data/i18n/de/, when there is one. */
export type Claim = ClaimInput & { de?: ClaimDe };
export type ShelfLife = ShelfLifeInput & { de?: ShelfLifeDe };
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
  /** The price is stale (over 180 days, see freshness.ts) when the catalogue was built. Stale swaps never lead. */
  priceOld: boolean;
  /** When each side's price was last seen, from data/prices/observations, with a short history. */
  prices: { brand: PriceSeen; alternative: PriceSeen };
  /** The tier from the older side's date. */
  freshness: Freshness;
  /** Who to credit for the nutrition records on this swap. Null when neither side has one. */
  nutritionSource: NutritionSource | null;
  /**
   * Sides whose price the store's affiliate terms don't let us show (src/lib/programme-terms.ts). Set only when one
   * is: the page then shows no price, unit price or saving for the swap, only "see the price at <store>".
   */
  withheld?: Partial<Record<"brand" | "alternative", Withheld>>;
  /** The German text, from data/i18n/de/, when there is one. */
  de?: PairDe;
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
  /** Who sells the cheaper product, which groups lines into one order per store. */
  seller: string;
  /** The cheaper product's real pack and how many of them one brand pack's amount takes. Null when it's priced per amount. */
  pack: { price: number; per: number } | null;
  /** Whole packs bought at the till for qty, or null with no pack to count. */
  packs: number | null;
  /** What those packs cost at the till. */
  tillCost: number;
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
  /** Buying it in whole packs at its starting quantities: one order per store, each with its delivery. */
  checkout: Checkout;
  /** The German text, from data/i18n/de/presets/, when there is one. */
  de?: PresetDe;
  /** Lines (by swap slug) whose prices a store's affiliate terms don't let us show; the basket then shows no totals. */
  withheld?: string[];
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
  /** "kit" and "item-<n>" (the bundle item a piece replaces): when each price was last seen. */
  prices: Record<string, PriceSeen>;
  /** The tier from the oldest piece's date. */
  freshness: Freshness;
  /** The German text, from data/i18n/de/bundles/, when there is one. */
  de?: BundleDe;
  /** "kit" and "item-<n>" prices a store's affiliate terms don't let us show; the kit then shows no prices or totals. */
  withheld?: Record<string, Withheld>;
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
  /**
   * Set when a store's affiliate terms withhold a price on this swap (src/lib/programme-terms.ts): the store to name
   * in place of the saving and unit prices, which are then 0 and must not be shown.
   */
  seePriceAt?: string;
};
