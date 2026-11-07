import "server-only";
import Fuse from "fuse.js";
import { getAllBundles, getAllPairs, ingredientKey } from "@/lib/catalog";
import { differentSalts } from "@/lib/ingredient-key";
import type { LookFor } from "@/lib/markets";
import type { Bundle, Pair } from "@/lib/types";
import type { Active, LookupProduct } from "./types";
import { normAmount, tokens } from "./text";

/** Verified swaps from our own catalog that answer a lookup. */

const ACTIVE_MATCHES = new Set(["identical_active", "identical_formula", "same_manufacturer"]);

type ActiveKey = { name: string; key: string; amount: string };

function keySet(list: { name: string; amount: string }[]): ActiveKey[] {
  return list
    .map((a) => ({ name: a.name, key: ingredientKey(a.name), amount: normAmount(a.amount) }))
    .filter((a) => a.key);
}

/** Same ingredient set with no two salts named against each other, and the same strength wherever both sides state one. */
function sameActives(a: ActiveKey[], b: ActiveKey[]) {
  if (!a.length || a.length !== b.length) return false;
  return a.every((x) =>
    b.some((y) => y.key === x.key && !differentSalts(x.name, y.name) && (!x.amount || !y.amount || x.amount === y.amount)),
  );
}

function brandMatches(pairBrand: string, product: LookupProduct) {
  const want = tokens(pairBrand).join(" ");
  if (!want) return false;
  const hay = ` ${tokens(`${product.brand} ${product.name}`).join(" ")} `;
  return hay.includes(` ${want} `);
}

/** Pairs whose brand side is this product (same brand and, when known, same actives). */
export function verifiedSwapsFor(product: LookupProduct): Pair[] {
  const actives = keySet(product.actives);
  return getAllPairs().filter((p) => {
    if (!brandMatches(p.brand.brand, product)) return false;
    if (!actives.length) return true;
    const brandSide = keySet(p.brand.key_ingredients);
    return !brandSide.length || sameActives(actives, brandSide);
  });
}

/** Pairs whose cheaper side has exactly these actives at these strengths. */
export function swapsWithSameActives(actives: Active[], exclude: Set<string> = new Set()): Pair[] {
  const want = keySet(actives);
  if (!want.length) return [];
  return getAllPairs()
    .filter((p) => ACTIVE_MATCHES.has(p.match_type) && !exclude.has(p.slug))
    .filter((p) => sameActives(want, keySet(p.alternative.key_ingredients)))
    .sort((a, b) => b.savingsPct - a.savingsPct);
}

export function bundlesFor(product: LookupProduct): Bundle[] {
  return getAllBundles().filter((b) => brandMatches(b.bundle.brand, product));
}

/** Catalog swaps for a free-text query (brand side), best first. */
export function searchCatalog(q: string, limit = 6): Pair[] {
  const fuse = new Fuse(getAllPairs(), {
    keys: [
      { name: "brand.brand", weight: 3 },
      { name: "brand.product", weight: 2 },
      { name: "title", weight: 1 },
      { name: "brand.key_ingredients.name", weight: 1 },
    ],
    threshold: 0.3,
    ignoreLocation: true,
  });
  return fuse.search(q, { limit }).map((r) => r.item);
}

const FORM_PLURAL: Record<string, string> = {
  tablet: "tablets",
  "chewable tablet": "chewable tablets",
  caplet: "caplets",
  capsule: "capsules",
  softgel: "softgels",
  "liquid gel": "liquid gels",
  gelcap: "gelcaps",
  lozenge: "lozenges",
  gummy: "gummies",
};

/** What to look for on a shelf anywhere: the actives and strengths, or the product type. */
export function lookForProduct(product: LookupProduct): LookFor {
  const actives = product.actives.filter((a) => a.name.length <= 60);
  if ((product.kind === "medicine" || product.kind === "supplement") && actives.length && actives.length <= 4) {
    return {
      text: product.name,
      actives: actives.map((a) => ({ name: a.name.replace(/\b(hydrochloride|hcl)\b/i, "").trim(), amount: a.amount })),
      form: FORM_PLURAL[product.form] ?? "",
    };
  }
  if (product.kind === "supplement" && actives.length >= 8) {
    const audience = product.name.match(/50\+|65\+|women'?s?|men'?s?|kids|children'?s?|prenatal|teens?/gi) ?? [];
    return { text: ["multivitamin", ...audience.map((a) => a.toLowerCase())].join(" ") };
  }
  const name = genericName(product);
  if (product.kind === "cosmetic") {
    const all = product.ingredients.join(", ");
    const keys = KEY_COSMETIC.filter(([re, label]) => re.test(all) && !name.toLowerCase().includes(label)).map(
      ([, label]) => label,
    );
    if (keys.length) return { text: `${name} with ${keys.slice(0, 2).join(" and ")}` };
  }
  return { text: name };
}

/** Ingredients shoppers filter skincare by, in the words they search with. */
const KEY_COSMETIC: [RegExp, string][] = [
  [/ceramide/i, "ceramides"],
  [/niacinamide/i, "niacinamide"],
  [/hyaluron/i, "hyaluronic acid"],
  [/\bretin(ol|yl|al)\b/i, "retinol"],
  [/salicylic acid/i, "salicylic acid"],
  [/glycolic acid/i, "glycolic acid"],
  [/benzoyl peroxide/i, "benzoyl peroxide"],
  [/zinc oxide/i, "zinc oxide"],
  [/ascorbic acid|ascorbyl/i, "vitamin C"],
  [/\burea\b/i, "urea"],
  [/colloidal oatmeal|avena sativa/i, "colloidal oatmeal"],
];

/** "CeraVe Moisturizing Cream 454 g" -> "Moisturizing Cream": the product type without the brand or size. */
function genericName(product: LookupProduct) {
  let t = product.name.replace(/[®™©]/g, "");
  if (product.brand) {
    const brand = product.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`^\\s*${brand}\\b\\s*`, "i"), "");
  }
  t = t
    .replace(/,?\s*\b\d+(?:[.,]\d+)?\s*(?:ml|l|g|kg|oz|fl\.? ?oz|lb|ct|count|pack|pk|tablets?|capsules?)\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length >= 3 ? t : (product.uses[1] ?? product.uses[0] ?? product.name);
}
