/**
 * Ingredient names reduced to one key. Pure, so the catalogue build and the swap page's rows
 * group names the same way the ingredient pages do.
 */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INGREDIENT_STOP = new Set(["chemistry", "formula", "ingredients", "sodium", "potassium", "chloride", "dextrose", "maltodextrin"]);

/** International names that group with their US names, so UK and US swaps share one page. */
const SAME_AS_US: Record<string, string> = {
  paracetamol: "acetaminophen",
  aciclovir: "acyclovir",
  beclometasone: "beclomethasone",
  salbutamol: "albuterol",
};

/** Canonical ingredient key: drops salt forms and grade labels so "Cetirizine HCl" and "cetirizine" group. */
export function ingredientKey(name: string) {
  const base = slugify(name)
    .replace(/-(usp|nf|hcl|hydrochloride|dihydrochloride|monohydrate)\b/g, "")
    .replace(/^white-(petrolatum)$/, "$1")
    .replace(/-+$/g, "")
    .replace(/\b(paracetamol|aciclovir|beclometasone|salbutamol)\b/g, (w) => SAME_AS_US[w]);
  return INGREDIENT_STOP.has(base) ? "" : base;
}
