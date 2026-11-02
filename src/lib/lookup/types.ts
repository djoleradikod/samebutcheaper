import type { CategorySlug } from "@/lib/types";

/** Where a looked-up product's data came from. */
export type LookupSource = "fda" | "dsld" | "obf" | "off" | "opff" | "photo";

export const SOURCE_LABEL: Record<LookupSource, string> = {
  fda: "FDA drug label (DailyMed)",
  dsld: "NIH Dietary Supplement Label Database",
  obf: "Open Beauty Facts",
  off: "Open Food Facts",
  opff: "Open Pet Food Facts",
  photo: "Your photo",
};

export type Active = { name: string; amount: string };

export type ProductKind = "medicine" | "supplement" | "cosmetic" | "food" | "pet" | "other";

/** One product, normalised from any source. */
export type LookupProduct = {
  source: LookupSource;
  id: string;
  /** Public page for the source record, when there is one. */
  url: string | null;
  brand: string;
  name: string;
  kind: ProductKind;
  category: CategorySlug | null;
  /** "100 tablets", "200 ml"... */
  size: string;
  /** "tablet", "softgel"... for medicines. */
  form: string;
  upc: string | null;
  /** Active ingredients with strength (medicines, supplements). */
  actives: Active[];
  /** Full, inactive or INCI ingredient list. */
  ingredients: string[];
  /** What it is for: purpose, uses, category. */
  uses: string[];
  directions: string | null;
  warnings: string[];
  /** ISO country codes where the product is reported on sale (Open*Facts). */
  countries: string[];
  manufacturer: string | null;
  image: string | null;
};

/** A short search result, linking to the full product. */
export type Candidate = {
  source: LookupSource;
  id: string;
  brand: string;
  name: string;
  detail: string;
  kind: ProductKind;
  image: string | null;
};

/** A product with the same active ingredients on its official label. */
export type LabelMatch = {
  id: string;
  brand: string;
  manufacturer: string;
  /** "Walmart (Equate)" when it is a known store brand. */
  storeBrand: string | null;
  url: string | null;
};
