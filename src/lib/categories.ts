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
    | "plug";
};

export const CATEGORIES: CategoryMeta[] = [
  {
    slug: "otc-medicine",
    name: "OTC Medicine",
    short: "Pain, allergy, stomach, sleep",
    description:
      "Store-brand medicines must contain the same active ingredient at the same strength as the brand name. That is an FDA requirement, not a marketing claim.",
    icon: "pill",
  },
  {
    slug: "supplements",
    name: "Supplements & Vitamins",
    short: "Creatine, fish oil, multivitamins",
    description:
      "Same compound, same dose, often third-party tested. Compared per serving or per gram of active ingredient.",
    icon: "leaf",
  },
  {
    slug: "skincare-personal-care",
    name: "Skincare & Personal Care",
    short: "Moisturisers, acne, dental, shave",
    description:
      "Matching ingredient (INCI) lists and the same active percentages, without the department-store markup.",
    icon: "droplet",
  },
  {
    slug: "beauty-hair",
    name: "Beauty & Hair",
    short: "Haircare, makeup removers, lip",
    description: "Formulas that match ingredient for ingredient. No scent-alike “dupes”.",
    icon: "sparkles",
  },
  {
    slug: "household",
    name: "Household & Cleaning",
    short: "Laundry, disinfectant, filters",
    description:
      "The same EPA registration number, the same active chemistry, and independent test results.",
    icon: "spray",
  },
  {
    slug: "baby",
    name: "Baby",
    short: "Formula, children’s medicine, care",
    description:
      "FDA nutrient rules apply to every infant formula sold in the US. Store brands meet the same standard for far less.",
    icon: "baby",
  },
  {
    slug: "pet",
    name: "Pet",
    short: "Flea & tick, joint, cleaning",
    description:
      "The same active ingredients at the same concentrations, often with matching EPA registrations.",
    icon: "paw",
  },
  {
    slug: "food-pantry",
    name: "Food & Pantry",
    short: "Staples, sweeteners, drinks",
    description:
      "Single-ingredient staples and products made in the same plant, as shown by recalls and USDA establishment codes.",
    icon: "wheat",
  },
  {
    slug: "tech-tools",
    name: "Tech & Tools",
    short: "Chargers, cables, batteries, tools",
    description:
      "Certified to the same standards (MFi, USB-IF, UL) with matching specs, and backed by independent lab tests.",
    icon: "plug",
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
};

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
  CategorySlug,
  CategoryMeta
>;

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
      "Public records (recalls, regulatory filings, plant codes) show the same company makes both.",
    strength: 3,
  },
  equivalent_spec: {
    label: "Equivalent spec",
    short: "Same spec",
    description:
      "Published specs, certifications and independent tests show they do the same job to a comparable standard.",
    strength: 3,
  },
};
