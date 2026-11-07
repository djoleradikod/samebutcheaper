import { z } from "zod";
import { CATEGORY_SLUGS } from "./category-slugs";
import { MARKET_CODES, RETAILERS } from "./markets";
import { inRange, RATING_SCALES } from "./rating";

export { MARKET_CODES, RETAILERS };

/**
 * Source-of-truth schema for a product pair. Each file in data/pairs/*.json is
 * an array of these. scripts/build-catalog.ts validates every pair and derives
 * the computed fields (price per unit, savings) into src/generated/catalog.json.
 */

export { CATEGORY_SLUGS };

export const MATCH_TYPES = [
  "identical_active",
  "identical_formula",
  "same_manufacturer",
  "equivalent_spec",
  // Not written by hand: the catalogue build sets it on an equivalent_spec swap with nothing on file beyond pack and price.
  "same_kind",
] as const;

const ingredient = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
});

/**
 * Photo hosts we may show. Open Facts photos are CC BY-SA and credited on the
 * page. Brand and retailer photos are copyrighted, so they only get added here
 * once they come through an affiliate API that licenses them (Amazon PA-API,
 * Walmart via Impact). Any other host is dropped to null and the page draws a tile.
 */
export const IMAGE_HOSTS = [
  "images.openfoodfacts.org",
  "images.openbeautyfacts.org",
  "images.openpetfoodfacts.org",
  "images.openproductsfacts.org",
  "static.openfoodfacts.org",
  // DailyMed (U.S. National Library of Medicine): label and carton images from the
  // official drug label (SPL), in the public domain.
  "dailymed.nlm.nih.gov",
] as const;

const imageUrl = z
  .string()
  .url()
  .refine((u) => {
    try {
      const url = new URL(u);
      return url.protocol === "https:" && (IMAGE_HOSTS as readonly string[]).includes(url.hostname);
    } catch {
      return false;
    }
  }, "image must be an https photo from an allowed host")
  .nullable()
  .optional()
  .catch(null);

/**
 * A rating or test score, as the source gives it. `stars` is the older spelling of a score on the stars-5 scale.
 * See "Ratings" in data/README.md and src/lib/rating.ts.
 */
export const ratingSchema = z
  .object({
    stars: z.number().min(0).max(5).optional(),
    score: z.number().optional(),
    scale: z.enum(RATING_SCALES).default("stars-5"),
    count: z.number().int().min(0).optional(),
    source: z.string().url(),
    /** When the score was read or published. Falls back to the record's price_checked. */
    date: z.string().optional(),
    /** A test's publisher, "Which?". Left out for shopper ratings. */
    publisher: z.string().optional(),
  })
  .refine((r) => (r.score ?? r.stars) !== undefined, "a rating needs a score")
  .refine((r) => inRange(r.score ?? r.stars ?? 0, r.scale), "score is outside its scale");
const rating = ratingSchema.nullable().optional();

/** One row of the "same or different" table on a swap page. */
export const ASPECT_VERDICTS = ["same", "alt_better", "brand_better", "different"] as const;
const aspect = z.object({
  /** "Inactive ingredients", "Coating", "Rating", "Returns", "Third-party tested"... */
  aspect: z.string().min(2),
  brand: z.string().min(1),
  alternative: z.string().min(1),
  verdict: z.enum(ASPECT_VERDICTS),
  /** Where this row was checked. */
  source: z.string().url().optional().catch(undefined),
});

const product = z.object({
  brand: z.string().min(1),
  product: z.string().min(1),
  size: z.number().positive(),
  unit: z.string().min(1),
  /** Price in the currency of the pair's market (USD for "US"). Legacy files use price_usd. */
  price: z.number().positive(),
  retailer: z
    .string()
    .transform((r) => r.toLowerCase().trim())
    .pipe(z.enum(RETAILERS).catch("other")),
  asin: z
    .string()
    .regex(/^[A-Z0-9]{10}$/)
    .nullable()
    .optional()
    .catch(null),
  url: z.string().url(),
  /** Product photo (https). Missing or invalid falls back to a drawn pack tile. */
  image: imageUrl,
  rating,
  /** UPC/EAN barcode digits, used to fetch openly licensed photos and match affiliate feeds. */
  gtin: z
    .string()
    .regex(/^\d{8,14}$/)
    .nullable()
    .optional()
    .catch(null),
  /** Regulatory licence number: NDC (US), PL (UK), DIN (Canada), PZN (Germany). */
  license_id: z.string().min(3).max(40).nullable().optional().catch(null),
  key_ingredients: z.array(ingredient).default([]),
});

export const pairSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    market: z.enum(MARKET_CODES).default("US"),
    category: z.enum(CATEGORY_SLUGS),
    subcategory: z.string().min(1),
    title: z.string().min(3),
    brand: product,
    alternative: product,
    match_type: z.enum(MATCH_TYPES),
    confidence: z.enum(["high", "medium"]),
    summary: z.string().min(10),
    evidence: z.string().min(10),
    differences: z.string().default(""),
    /** Researched rows for the same-or-different table (quality, form, testing, service...). */
    aspects: z.array(aspect).default([]),
    sources: z.array(z.string().url()).min(2),
    price_checked: z.string().min(4),
    /** What to search for in other countries. Derived from the actives when absent. */
    look_for: z.string().optional(),
    /** One or two plain sentences on why this brand's premium isn't worth paying, specific to this swap. */
    why: z.string().min(20).optional(),
    /** Evidence claim ids (data/evidence/claims.json). Claims matching the category apply anyway. */
    claims: z.array(z.string()).default([]),
    /** Shelf-life record id (data/evidence/shelf-life.json), when the subcategory match isn't right. */
    shelf_life: z.string().optional(),
    /** A bigger pack of the alternative, for the bulk view. Same unit as the pair. */
    bulk: z
      .object({
        product: z.string().min(1),
        size: z.number().positive(),
        price: z.number().positive(),
        retailer: product.shape.retailer,
        url: z.string().url(),
      })
      .optional(),
  })
  .refine((p) => normalizeUnit(p.brand.unit) === normalizeUnit(p.alternative.unit), {
    message: "brand and alternative must use the same unit",
    path: ["alternative", "unit"],
  });

export type PairInput = z.infer<typeof pairSchema>;
export type MatchType = (typeof MATCH_TYPES)[number];

export function normalizeUnit(unit: string) {
  return unit
    .toLowerCase()
    .trim()
    .replace(/\.$/, "")
    .replace(/s$/, "")
    .replace(/^fluid ounce$/, "fl oz")
    .replace(/^ounce$/, "oz");
}

/* ---------------------------------------------------------------------------
 * Bundles: a brand's kit/set/stack vs building the same thing from cheaper
 * equivalents. Stored in data/bundles/*.json.
 * ------------------------------------------------------------------------- */

const bundleItem = z.object({
  name: z.string().min(1),
  size: z.number().positive(),
  unit: z.string().min(1),
  key_ingredients: z.array(ingredient).default([]),
});

const bundleComponent = product.extend({
  replaces: z.number().int().min(0),
  match_type: z.enum(MATCH_TYPES),
  look_for: z.string().optional(),
});

export const bundleSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    market: z.enum(MARKET_CODES).default("US"),
    category: z.enum(CATEGORY_SLUGS),
    title: z.string().min(3),
    bundle: z.object({
      brand: z.string().min(1),
      name: z.string().min(1),
      price: z.number().positive(),
      billing: z.enum(["one-time", "subscription"]).catch("one-time"),
      supply_days: z.number().positive().nullable().optional().catch(null),
      retailer: product.shape.retailer,
      asin: product.shape.asin,
      url: z.string().url(),
      image: imageUrl,
      items: z.array(bundleItem).min(2),
      extras: z.array(z.string()).default([]),
    }),
    components: z.array(bundleComponent).min(2),
    match_type: z.enum(MATCH_TYPES),
    confidence: z.enum(["high", "medium"]),
    summary: z.string().min(10),
    evidence: z.string().min(10),
    differences: z.string().default(""),
    sources: z.array(z.string().url()).min(2),
    price_checked: z.string().min(4),
  })
  .superRefine((b, ctx) => {
    const seen = new Set<number>();
    b.components.forEach((c, i) => {
      const item = b.bundle.items[c.replaces];
      if (!item) {
        ctx.addIssue({ code: "custom", path: ["components", i, "replaces"], message: "points to no bundle item" });
        return;
      }
      if (seen.has(c.replaces))
        ctx.addIssue({ code: "custom", path: ["components", i, "replaces"], message: "bundle item replaced twice" });
      seen.add(c.replaces);
      if (normalizeUnit(item.unit) !== normalizeUnit(c.unit))
        ctx.addIssue({
          code: "custom",
          path: ["components", i, "unit"],
          message: `unit "${c.unit}" differs from bundle item unit "${item.unit}"`,
        });
    });
    b.bundle.items.forEach((_, i) => {
      if (!seen.has(i))
        ctx.addIssue({ code: "custom", path: ["bundle", "items", i], message: "bundle item has no replacement" });
    });
  });

export type BundleInput = z.infer<typeof bundleSchema>;

/* ---------------------------------------------------------------------------
 * Presets: a basket for a life moment (a new flat, baby's first year), built
 * from swaps in the catalogue. Stored in data/presets/*.json. Every price comes
 * from the swaps themselves, so a preset adds no new price claims.
 * ------------------------------------------------------------------------- */

export const PRESET_ICONS = [
  "key",
  "baby",
  "cooking",
  "spray",
  "paw",
  "laptop",
  "shirt",
  "bath",
  "car",
  "sprout",
  "wrench",
  "battery",
  "pill",
  "cart",
  "plane",
] as const;

export const presetSchema = z.object({
  /** Same id across markets: "new-flat" sold as "new-flat-gb" and "new-flat-us". */
  family: z.string().min(2),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  market: z.enum(MARKET_CODES),
  title: z.string().min(3),
  /** Who it's for, in a few words. */
  audience: z.string().min(3),
  blurb: z.string().min(10),
  icon: z.enum(PRESET_ICONS),
  /** Where this list of items came from: which checklists and guides were read. */
  research: z.string().min(20),
  /** The guides and checklists behind the list of items. Prices come from each swap's own sources. */
  sources: z.array(z.string().url()).min(2),
  items: z
    .array(
      z.object({
        pair: z.string().min(3),
        /** How many of the brand-name pack this basket buys. */
        qty: z.number().positive().default(1),
        note: z.string().optional(),
      }),
    )
    .min(4),
});

export type PresetInput = z.infer<typeof presetSchema>;

/* ---------------------------------------------------------------------------
 * Evidence: cited findings on why a brand premium isn't worth paying, and how
 * long things keep. Stored in data/evidence/. Every record needs two sources.
 * ------------------------------------------------------------------------- */

const citation = z.object({
  url: z.string().url(),
  publisher: z.string().min(2),
  title: z.string().min(3),
  /** Year or year-month of the finding. */
  date: z.string().min(4),
});

export const claimSchema = z.object({
  id: z.string().min(3),
  /** Short headline, e.g. "Own-label beans beat Heinz in blind tests". */
  title: z.string().min(5),
  /** The finding in our own words, with the numbers from the source. */
  finding: z.string().min(20),
  /** "general" applies across categories. */
  categories: z.array(z.string()).min(1),
  subcategories: z.array(z.string()).default([]),
  markets: z.array(z.enum(MARKET_CODES)).default([]),
  /** Where the evidence stops or the cheap option lost. */
  caveat: z.string().default(""),
  sources: z.array(citation).min(2),
});

export type ClaimInput = z.infer<typeof claimSchema>;

export const BULK_ADVICE = ["stock_up", "buy_to_use", "buy_small"] as const;

export const shelfLifeSchema = z.object({
  id: z.string().min(3),
  label: z.string().min(3),
  categories: z.array(z.string()).default([]),
  /** Subcategory names this record applies to, compared case-insensitively. */
  subcategories: z.array(z.string()).default([]),
  unopened: z.string().min(3),
  opened: z.string().default(""),
  storage: z.string().default(""),
  /** stock_up: keeps for years. buy_to_use: fine if you get through it in time. buy_small: goes off or weakens. */
  advice: z.enum(BULK_ADVICE),
  note: z.string().default(""),
  sources: z.array(citation).min(2),
});

export type ShelfLifeInput = z.infer<typeof shelfLifeSchema>;

/** One self-hosted product photo. Stored in data/images.json, keyed by "brand|product". */
export const imageRecordSchema = z.object({
  /** Basename in public/products/. The site loads <file>-160.webp and <file>-480.webp. */
  file: z.string().min(3),
  source: z.string().min(2),
  credit: z.string().min(2),
  license: z.string().min(2),
  /** The page the photo came from. */
  page: z.string().url(),
  /** What the source calls this product, so a reviewer can check the match. */
  matched: z.string().default(""),
  /** Date a person or reviewer agent looked at the picture and agreed it shows this product. */
  reviewed: z.string().nullable().default(null),
  /** The right product but a poor picture, such as a bottle cropped through its name. It shows, but after the clean ones. */
  weak: z.boolean().default(false),
});

export type ImageRecord = z.infer<typeof imageRecordSchema>;

const per100 = z.number().nonnegative().nullable();

/** One Open Food Facts record for a product. Values are per 100 g or 100 ml, null when the record doesn't say. */
export const nutritionRecordSchema = z.object({
  code: z.string().min(1),
  page: z.string().url(),
  name: z.string(),
  modified: z.string(),
  kcal: per100,
  fat: per100,
  saturates: per100,
  sugars: per100,
  salt: per100,
  protein: per100,
  fibre: per100,
  ingredients: z.string().nullable(),
});

/** data/evidence/nutrition.json, written by scripts/qa/extract_nutrition.py. Items are keyed by "brand|product". */
export const nutritionFileSchema = z.object({
  source: z.string().min(2),
  license: z.string().min(2),
  licenseUrl: z.string().url(),
  dump: z.string(),
  items: z.record(z.string(), nutritionRecordSchema),
});

export type NutritionRecord = z.infer<typeof nutritionRecordSchema>;
export type NutritionSource = Omit<z.infer<typeof nutritionFileSchema>, "items">;

const LEGACY_PRICE = "price_usd";

/**
 * Older data files name prices `price_usd`. Renames them to `price` so both
 * spellings validate (US data is in USD either way).
 */
export function migrateLegacyPrices(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const fix = (o: unknown) => {
    if (o && typeof o === "object" && LEGACY_PRICE in o && !("price" in o)) {
      const rec = o as Record<string, unknown>;
      rec.price = rec[LEGACY_PRICE];
      delete rec[LEGACY_PRICE];
    }
  };
  const r = raw as Record<string, unknown>;
  fix(r.brand);
  fix(r.alternative);
  fix(r.bundle);
  if (Array.isArray(r.components)) r.components.forEach(fix);
  return raw;
}
