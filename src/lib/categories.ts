import { CATEGORY_SLUGS } from "./category-slugs";
import type { CategorySlug, MatchType } from "./types";

export type CategoryMeta = {
  slug: CategorySlug;
  name: string;
  short: string;
  description: string;
  icon:
    | "pill"
    | "leaf"
    | "droplet"
    | "sparkles"
    | "spray"
    | "baby"
    | "paw"
    | "wheat"
    | "plug"
    | "cooking"
    | "battery"
    | "wrench"
    | "paperclip"
    | "car"
    | "sprout";
};

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "otc-medicine",
    name: "OTC Medicine",
    short: "Pain, allergy, stomach, sleep",
    description:
      "Pain, allergy and stomach medicines, compared per tablet or per dose. Each swap says what the labels show. Ask a pharmacist if you're unsure.",
    icon: "pill",
  },
  {
    slug: "supplements",
    name: "Supplements & Vitamins",
    short: "Creatine, fish oil, multivitamins",
    description:
      "Vitamins, minerals and other supplements, compared per serving. Each swap says what the labels show.",
    icon: "leaf",
  },
  {
    slug: "skincare-personal-care",
    name: "Skincare & Personal Care",
    short: "Moisturisers, acne, dental, shave",
    description:
      "The same kind of product, with ingredients and active percentages from the label.",
    icon: "droplet",
  },
  {
    slug: "beauty-hair",
    name: "Beauty & Hair",
    short: "Haircare, makeup removers, lip",
    description: "The same kind of product, with both ingredient lists side by side. No scent-alike “dupes”.",
    icon: "sparkles",
  },
  {
    slug: "household",
    name: "Household & Cleaning",
    short: "Laundry, dishes, paper, cleaning",
    description:
      "Laundry, dishes, paper and cleaning products, compared per wash, per sheet or per litre, with test results where they exist.",
    icon: "spray",
  },
  {
    slug: "baby",
    name: "Baby",
    short: "Formula and skin care",
    description:
      "The same kind of product, compared per unit. Check with your doctor or health visitor before changing formula.",
    icon: "baby",
  },
  {
    slug: "pet",
    name: "Pet",
    short: "Food, litter, flea & tick",
    description:
      "The same kind of food or treatment, compared per kilo or per dose. Ask your vet if you're unsure.",
    icon: "paw",
  },
  {
    slug: "food-pantry",
    name: "Food & Pantry",
    short: "Staples, sweeteners, drinks",
    description:
      "Own-label food next to the brand, compared per 100 g or per litre, with taste tests where they exist.",
    icon: "wheat",
  },
  {
    slug: "tech-tools",
    name: "Tech accessories",
    short: "Chargers, cables, keyboards",
    description:
      "Chargers, cables, memory and keyboards, compared per item, with lab tests where they exist.",
    icon: "plug",
  },
  {
    slug: "kitchen",
    name: "Kitchen",
    short: "Foil, bags, filters, kettles",
    description:
      "Foil, film, bags and basics, compared per metre or per item, with test results where they exist.",
    icon: "cooking",
  },
  {
    slug: "batteries",
    name: "Batteries",
    short: "AA, AAA, button cells, rechargeables",
    description:
      "AA, AAA, button cells and rechargeables, compared per cell, with test results where they exist.",
    icon: "battery",
  },
  {
    slug: "tools-diy",
    name: "Tools & DIY",
    short: "Hand tools, glue, sealant, gloves",
    description:
      "Hand tools, glue, sealant and gloves, compared per item, with test results where they exist.",
    icon: "wrench",
  },
  {
    slug: "office",
    name: "Office & School",
    short: "Paper, pens, ink, labels",
    description: "Paper, pens, ink and labels, compared per sheet or per item.",
    icon: "paperclip",
  },
  {
    slug: "car",
    name: "Car",
    short: "Screenwash, wipers, car care",
    description:
      "Fluids and car care, compared per litre or per item, with group test results where they exist.",
    icon: "car",
  },
  {
    slug: "garden",
    name: "Garden",
    short: "Compost, feed, hoses, secateurs",
    description:
      "The same kind of product, compared per litre or per item, with test results where they exist.",
    icon: "sprout",
  },
];

/** Pastel tile colours per category, used for product tiles without a photo. */
export const CATEGORY_TONE: Record<CategorySlug, { bg: string; fg: string }> = {
  "otc-medicine": { bg: "#e0f2fe", fg: "#0369a1" },
  supplements: { bg: "#ecfccb", fg: "#3f6212" },
  "skincare-personal-care": { bg: "#fce7f3", fg: "#9d174d" },
  "beauty-hair": { bg: "#ede9fe", fg: "#5b21b6" },
  household: { bg: "#cffafe", fg: "#0e7490" },
  baby: { bg: "#fef3c7", fg: "#92400e" },
  pet: { bg: "#ffedd5", fg: "#9a3412" },
  "food-pantry": { bg: "#fef9c3", fg: "#854d0e" },
  "tech-tools": { bg: "#e0e7ff", fg: "#3730a3" },
  kitchen: { bg: "#fee2e2", fg: "#991b1b" },
  batteries: { bg: "#d1fae5", fg: "#065f46" },
  "tools-diy": { bg: "#e7e5e4", fg: "#44403c" },
  office: { bg: "#dbeafe", fg: "#1e40af" },
  car: { bg: "#e2e8f0", fg: "#334155" },
  garden: { bg: "#dcfce7", fg: "#166534" },
};

/** Display order: everyday shopping first, medicine last. */
CATEGORIES.sort((a, b) => CATEGORY_SLUGS.indexOf(a.slug) - CATEGORY_SLUGS.indexOf(b.slug));

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
  CategorySlug,
  CategoryMeta
>;

const MATCH_PHRASE: [MatchType, string][] = [
  ["identical_active", "the same active ingredients"],
  ["identical_formula", "the same formula on the label"],
  ["same_manufacturer", "the same manufacturer"],
  ["equivalent_spec", "comparable specs or tests"],
];

/** One or two sentences on what a group of swaps can claim, so a page promises no more than its weakest swap shows. */
export function matchSentence(types: MatchType[]) {
  const phrases = MATCH_PHRASE.filter(([type]) => types.includes(type)).map(([, phrase]) => phrase);
  const list = phrases.length < 2 ? phrases.join("") : `${phrases.slice(0, -1).join(", ")}, or ${phrases[phrases.length - 1]}`;
  if (!types.includes("same_kind")) return list ? `Each has ${list}.` : "";
  if (!list) return "Each is the same kind of product. Our records don't show that the two match on what's inside or how well they work.";
  return `Some have ${list}, and the rest are only the same kind of product. Each swap says which.`;
}

export const MATCH_TYPE_META: Record<
  MatchType,
  { label: string; short: string; description: string; strength: number }
> = {
  identical_active: {
    label: "Same active ingredient",
    short: "Same active",
    description:
      "Same active ingredient(s), same strength, same dosage form, confirmed from the official label.",
    strength: 4,
  },
  identical_formula: {
    label: "Same formula per label",
    short: "Same formula",
    description: "The full ingredient list on the label matches, in the same order.",
    strength: 4,
  },
  same_manufacturer: {
    label: "Same manufacturer",
    short: "Same maker",
    description:
      "Public records (recalls, regulatory filings, plant codes) or an on-record statement from one of the companies show the same company makes both.",
    strength: 3,
  },
  equivalent_spec: {
    label: "Does the same job",
    short: "Same job",
    description:
      "Published specs, certifications or independent tests show they do the same job to a comparable standard.",
    strength: 3,
  },
  same_kind: {
    label: "Same kind of product",
    short: "Same kind",
    description: "The same kind of product, priced from real sources. What we have doesn't show that they match on what's inside or how well they work.",
    strength: 1,
  },
};
