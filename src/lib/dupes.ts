/**
 * "Generic for X" pages: one per brand product, grouping every verified swap for
 * it. Pure so the catalog script can list the slugs for the proxy's 404 check.
 */
type DupeInput = {
  slug: string;
  subcategory: string;
  match_type: string;
  brand: { brand: string; key_ingredients: { name: string }[] };
};

export function dupeSlugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The active ingredients in plain form, or null for spec matches such as chargers. */
export function dupeActives(p: DupeInput): string[] | null {
  if (p.match_type === "equivalent_spec") return null;
  const names = p.brand.key_ingredients.map((i) => i.name.replace(/\s*\(.*?\)/g, "").trim()).filter(Boolean);
  return names.length ? names : null;
}

/** Same brand and same actives (or same kind of product) share one page. */
export function dupeSlugFor(p: DupeInput): string {
  const actives = dupeActives(p);
  const what = actives ? actives.slice(0, 2).join(" ") : p.subcategory;
  return dupeSlugify(`${p.brand.brand} ${what}`).slice(0, 80).replace(/-$/, "");
}
