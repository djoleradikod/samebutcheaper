import { z } from "zod";
import { MARKET_CODES, RETAILERS } from "./markets";

export { MARKET_CODES, RETAILERS };

/**
 * Source-of-truth schema for a product pair. Each file in data/pairs/*.json is
 * an array of these. scripts/build-catalog.ts validates every pair and derives
 * the computed fields (price per unit, savings) into src/generated/catalog.json.
 */

export const CATEGORY_SLUGS = [
  "otc-medicine",
  "supplements",
  "skincare-personal-care",
  "beauty-hair",
  "household",
  "baby",
  "pet",
  "food-pantry",
  "tech-tools",
] as const;

export const MATCH_TYPES = [
  "identical_active",
  "identical_formula",
  "same_manufacturer",
  "equivalent_spec",
] as const;

const ingredient = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
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
    sources: z.array(z.string().url()).min(2),
    price_checked: z.string().min(4),
    /** What to search for in other countries. Derived from the actives when absent. */
    look_for: z.string().optional(),
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
