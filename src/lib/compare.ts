import { RETAILER_LABEL } from "./affiliate";
import { formatSize, ppu } from "./format";
import type { CategorySlug, Pair, ProductSide } from "./types";

/** Researched verdicts, plus "check" for things we couldn't compare from the labels. */
export type Verdict = "same" | "alt_better" | "brand_better" | "different" | "check";
export type CompareRow = {
  aspect: string;
  brand: string;
  alternative: string;
  verdict: Verdict;
  source?: string;
  /** Link for the aspect name, e.g. an ingredient page. */
  href?: string;
};
export type Comparison = {
  /** "Active ingredients" or "Specs": one row per ingredient or spec, from the labels. */
  label: string;
  ingredients: CompareRow[];
  /** Everything else: formula, pack, price, rating, licence, researched rows. */
  rows: CompareRow[];
};

const norm = (s: string) => s.toLowerCase().replace(/[\s,]+/g, "");
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function ratingText(p: ProductSide) {
  if (!p.rating) return "Not rated";
  return `${p.rating.stars.toFixed(1)} ★ (${p.rating.count.toLocaleString("en-US")})`;
}

/** What "inactive ingredients" means for this kind of product. */
const INACTIVE_WORDS: Partial<Record<CategorySlug, string>> = {
  "otc-medicine": "fillers, coating, dyes and flavour",
  supplements: "fillers, capsule, coating and flavour",
  "skincare-personal-care": "base, fragrance and preservatives",
  "beauty-hair": "base, fragrance and preservatives",
  household: "fragrance, dyes and stabilisers",
  baby: "base, flavour and preservatives",
  pet: "other ingredients and flavour",
  "food-pantry": "other ingredients",
};

/** One row per active ingredient or spec, matched up by name. */
function ingredientRows(pair: Pair, slugFor?: (name: string) => string | undefined): CompareRow[] {
  const rows = new Map<string, { name: string; brand?: string; alt?: string }>();
  for (const i of pair.brand.key_ingredients) rows.set(normName(i.name), { name: i.name, brand: i.amount });
  for (const i of pair.alternative.key_ingredients) {
    const key = normName(i.name);
    const row = rows.get(key);
    if (row) row.alt = i.amount;
    else rows.set(key, { name: i.name, alt: i.amount });
  }
  const chemistry = pair.match_type !== "equivalent_spec";
  return [...rows.values()].map((r) => {
    const both = r.brand !== undefined && r.alt !== undefined;
    const same = both && norm(r.brand!) === norm(r.alt!);
    const slug = chemistry && slugFor ? slugFor(r.name) : undefined;
    return {
      aspect: r.name,
      brand: r.brand === undefined ? "Not listed" : r.brand || "Yes",
      alternative: r.alt === undefined ? "Not listed" : r.alt || "Yes",
      verdict: same ? "same" : "different",
      href: slug ? `/ingredient/${slug}` : undefined,
    };
  });
}

/**
 * The "same or different" table on a swap page: ingredient or spec rows from
 * the labels, rows we can state from the match type and prices, then any rows
 * researchers added (quality, testing, service...). A researched row replaces
 * a generated row with the same name.
 */
export function comparison(pair: Pair, slugFor?: (name: string) => string | undefined): Comparison {
  const b = pair.brand;
  const a = pair.alternative;
  const rows: CompareRow[] = [];
  const text = `${pair.summary} ${pair.evidence}`;

  if (pair.match_type === "identical_formula") {
    rows.push({
      aspect: "Full formula",
      brand: "Same ingredient list",
      alternative: "Same ingredient list, same order",
      verdict: "same",
    });
  } else if (pair.match_type === "identical_active") {
    const words = INACTIVE_WORDS[pair.category] ?? "other ingredients";
    rows.push(
      /(same|identical|matching) (inactive|other) ingredients/i.test(text)
        ? {
            aspect: "Inactive ingredients",
            brand: "Same list per the label",
            alternative: "Same list per the label",
            verdict: "same",
          }
        : {
            aspect: "Inactive ingredients",
            brand: `Its own ${words}`,
            alternative: "Can differ. Read the label if you have allergies",
            verdict: "check",
          },
    );
  } else if (pair.match_type === "same_manufacturer") {
    rows.push({ aspect: "Who makes it", brand: "Same maker", alternative: "Same maker (see sources)", verdict: "same" });
  }

  rows.push({
    aspect: "Pack",
    brand: formatSize(b.size, b.unit),
    alternative: formatSize(a.size, a.unit),
    verdict: b.size === a.size ? "same" : "different",
  });

  rows.push({
    aspect: `Price per ${b.unit}`,
    brand: ppu(b.ppu, pair.currency),
    alternative: `${ppu(a.ppu, pair.currency)} (${Math.round(pair.savingsPct)}% less)`,
    verdict: "alt_better",
  });

  if (b.license_id || a.license_id) {
    const same = !!b.license_id && !!a.license_id && norm(b.license_id) === norm(a.license_id);
    rows.push({
      aspect: "Licence number",
      brand: b.license_id ?? "Not recorded",
      alternative: a.license_id ?? "Not recorded",
      verdict: same ? "same" : "different",
    });
  }

  if (b.rating || a.rating) {
    const diff = (a.rating?.stars ?? 0) - (b.rating?.stars ?? 0);
    rows.push({
      aspect: "Shopper rating",
      brand: ratingText(b),
      alternative: ratingText(a),
      verdict:
        !b.rating || !a.rating ? "check" : Math.abs(diff) <= 0.2 ? "same" : diff > 0 ? "alt_better" : "brand_better",
      source: a.rating?.source ?? b.rating?.source,
    });
  }

  rows.push({
    aspect: "Where we priced it",
    brand: RETAILER_LABEL[b.retailer] ?? "Retailer",
    alternative: RETAILER_LABEL[a.retailer] ?? "Retailer",
    verdict: b.retailer === a.retailer ? "same" : "different",
  });

  // Researched rows win over generated ones with the same name.
  let researched: CompareRow[] = pair.aspects ?? [];
  const taken = new Set(researched.map((r) => norm(r.aspect)));
  let ingredients = ingredientRows(pair, slugFor).filter((r) => !taken.has(norm(r.aspect)));
  // A researched row that repeats an ingredient or spec row word for word only
  // adds its verdict to that row (e.g. "Cheaper one wins" on higher output).
  const sameText = (x: CompareRow, y: CompareRow) => norm(x.brand) === norm(y.brand) && norm(x.alternative) === norm(y.alternative);
  ingredients = ingredients.map((row) => {
    const dup = researched.find((r) => sameText(r, row));
    return dup ? { ...row, verdict: dup.verdict, source: dup.source ?? row.source } : row;
  });
  researched = researched.filter((r) => !ingredients.some((row) => sameText(r, row)));
  const generated = rows.filter((r) => !taken.has(norm(r.aspect)));
  // The formula or inactive-ingredients row first, then researched detail, then the practical rows.
  const [first, ...rest] = generated;
  const leadsWithFormula = first && ["Full formula", "Inactive ingredients", "Who makes it"].includes(first.aspect);
  return {
    label: pair.match_type === "equivalent_spec" ? "Specs" : "Active ingredients",
    ingredients,
    rows: leadsWithFormula ? [first, ...researched, ...rest] : [...researched, ...generated],
  };
}

/** "Honest differences" text as separate points. */
export function differencePoints(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/** Exact counts for a one-line summary: never a blended score. */
export function matchParts(c: Comparison) {
  const all = [...c.ingredients, ...c.rows];
  const count = (v: Verdict) => all.filter((r) => r.verdict === v).length;
  return {
    /** Every active or spec row matches. Null when the label data lists none. */
    labelMatches: c.ingredients.length ? c.ingredients.every((r) => r.verdict === "same") : null,
    same: count("same"),
    differ: count("different") + count("check"),
    brandBetter: count("brand_better"),
    altBetter: count("alt_better"),
  };
}
