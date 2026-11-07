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

/** Salts and hydrates a name can carry, in a name or a bracket like "(as magnesium)". */
const SALT_WORD =
  /\b(hcl|dihydrochloride|hydrochloride|monohydrate|magnesium|sodium|potassium|calcium|zinc|citrate|carbonate|oxide|malate|glycinate|bisglycinate|gluconate|picolinate|sulfate|sulphate|fumarate|succinate|tartrate|maleate|phosphate|acetate|nitrate)\b/g;
/** Spellings of one salt. */
const SAME_SALT: Record<string, string> = { hcl: "hydrochloride", dihydrochloride: "hydrochloride", sulphate: "sulfate" };

/** The salt words in a name, leaving out the ingredient's own, so "Calcium (as calcium citrate)" gives "citrate". */
function saltWords(name: string) {
  const own = new Set(ingredientKey(name).split("-"));
  const words = (name.toLowerCase().match(SALT_WORD) ?? []).map((w) => SAME_SALT[w] ?? w).filter((w) => !own.has(w));
  return [...new Set(words)].sort().join("+");
}

/** Both names state a salt and the two aren't the same one. A name that states none proves nothing either way. */
export function differentSalts(a: string, b: string) {
  const [x, y] = [saltWords(a), saltWords(b)];
  return x !== "" && y !== "" && x !== y;
}
