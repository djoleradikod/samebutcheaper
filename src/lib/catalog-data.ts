import catalogJson from "@/generated/catalog.json";
import type { Bundle, Catalog, Pair } from "./types";

/**
 * The catalogue for jobs that run outside a page (upkeep, the weekly letter, the preview script). Unlike
 * src/lib/catalog.ts it isn't marked server-only, so scripts and tests can load it; a job takes the catalogue as an
 * argument and uses this one by default.
 */
export type CatalogueView = { pairs: readonly Pair[]; bundles: readonly Bundle[] };

export function catalogueData(): CatalogueView {
  const c = catalogJson as unknown as Catalog;
  return { pairs: c.pairs, bundles: c.bundles };
}
