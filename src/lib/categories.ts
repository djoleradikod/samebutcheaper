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
      "Matching ingredient (INCI) lists and identical active percentages, without the department-store markup.",
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
      "Identical EPA registration numbers, the same active chemistry, and independent test results.",
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

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
  CategorySlug,
  CategoryMeta
>;

export const MATCH_TYPE_META: Record<
  MatchType,
  { label: string; short: string; description: string; strength: number }
> = {
  identical_active: {
    label: "Identical active ingredient",
    short: "Same active",
    description:
      "Same active ingredient(s), same strength, same dosage form, confirmed from the official label.",
    strength: 4,
  },
  identical_formula: {
    label: "Identical formula",
    short: "Same formula",
    description: "The full ingredient list matches in the same order, so it is the same formula.",
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
      "Published specifications, certifications and independent tests show the same performance.",
    strength: 3,
  },
};
