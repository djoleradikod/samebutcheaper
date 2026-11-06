/** Display order: everyday shopping first, medicine last. Kept apart from schema.ts so client code doesn't pull in zod. */
export const CATEGORY_SLUGS = [
  "food-pantry",
  "household",
  "skincare-personal-care",
  "beauty-hair",
  "baby",
  "pet",
  "kitchen",
  "tech-tools",
  "batteries",
  "tools-diy",
  "office",
  "car",
  "garden",
  "supplements",
  "otc-medicine",
] as const;
