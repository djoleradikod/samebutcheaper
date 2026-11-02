import { z } from "zod";

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

export const RETAILERS = ["amazon", "walmart", "target", "costco", "other"] as const;

const ingredient = z.object({
  name: z.string().min(1),
  amount: z.string().default(""),
});

const product = z.object({
  brand: z.string().min(1),
  product: z.string().min(1),
  size: z.number().positive(),
  unit: z.string().min(1),
  price_usd: z.number().positive(),
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
  })
  .refine((p) => normalizeUnit(p.brand.unit) === normalizeUnit(p.alternative.unit), {
    message: "brand and alternative must use the same unit",
    path: ["alternative", "unit"],
  });

export type PairInput = z.infer<typeof pairSchema>;

export function normalizeUnit(unit: string) {
  return unit
    .toLowerCase()
    .trim()
    .replace(/\.$/, "")
    .replace(/s$/, "")
    .replace(/^fluid ounce$/, "fl oz")
    .replace(/^ounce$/, "oz");
}
