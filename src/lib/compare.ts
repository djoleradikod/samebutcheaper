import { formatSize, ppu } from "./format";
import type { CategorySlug, Pair, ProductSide } from "./types";

/**
 * Researched verdicts, plus "check" for things we couldn't compare from the labels, "about_same"
 * for a pack within 5%, and "unknown" when a value is missing on one side, which proves nothing.
 */
export type Verdict = "same" | "about_same" | "alt_better" | "brand_better" | "different" | "check" | "unknown";
export type CompareRow = {
  aspect: string;
  brand: string;
  alternative: string;
  verdict: Verdict;
  source?: string;
  /** Link for the aspect name, e.g. an ingredient page. */
  href?: string;
  /** Left out of the "x of y the same" count. The unit price differs on every swap, so it says nothing there. */
  uncounted?: boolean;
};
export type Comparison = {
  /** "Active ingredients" or "Specs": one row per ingredient or spec, from the labels. */
  label: string;
  ingredients: CompareRow[];
  /** Everything else: formula, pack, price, rating, licence, researched rows. */
  rows: CompareRow[];
};

/** A pack this close in size counts as about the same. */
const ABOUT_SAME_SHARE = 0.05;

function packVerdict(brandSize: number, altSize: number): Verdict {
  if (brandSize === altSize) return "same";
  return Math.abs(brandSize - altSize) / Math.max(brandSize, altSize) <= ABOUT_SAME_SHARE ? "about_same" : "different";
}

const NOT_ON_FILE = /^(not (listed|recorded|rated|stated|given|published|disclosed|on file)|unknown|n\/a)\b/i;

/** A missing value against a real one isn't a difference. A verdict that says the brand or the cheaper one won stays. */
function withoutFalseDifference(row: CompareRow): CompareRow {
  const missing = NOT_ON_FILE.test(row.brand.trim()) || NOT_ON_FILE.test(row.alternative.trim());
  return missing && (row.verdict === "different" || row.verdict === "check") ? { ...row, verdict: "unknown" } : row;
}

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
      verdict: !both ? "unknown" : same ? "same" : "different",
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
    verdict: packVerdict(b.size, a.size),
  });

  rows.push({
    aspect: `Price per ${b.unit}`,
    brand: ppu(b.ppu, pair.currency),
    alternative: `${ppu(a.ppu, pair.currency)} (${Math.round(pair.savingsPct)}% less)`,
    verdict: "alt_better",
    uncounted: true,
  });

  if (b.license_id || a.license_id) {
    const same = !!b.license_id && !!a.license_id && norm(b.license_id) === norm(a.license_id);
    rows.push({
      aspect: "Licence number",
      brand: b.license_id ?? "Not recorded",
      alternative: a.license_id ?? "Not recorded",
      verdict: !b.license_id || !a.license_id ? "unknown" : same ? "same" : "different",
    });
  }

  if (b.rating || a.rating) {
    const diff = (a.rating?.stars ?? 0) - (b.rating?.stars ?? 0);
    rows.push({
      aspect: "Shopper rating",
      brand: ratingText(b),
      alternative: ratingText(a),
      verdict:
        !b.rating || !a.rating ? "unknown" : Math.abs(diff) <= 0.2 ? "same" : diff > 0 ? "alt_better" : "brand_better",
      source: a.rating?.source ?? b.rating?.source,
    });
  }

  // Researched rows win over generated ones with the same name.
  let researched: CompareRow[] = (pair.aspects ?? []).map(withoutFalseDifference);
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

/** Words that end in a full stop without ending the sentence. */
const ABBREVIATION = "e\\.g|i\\.e|vs|cf|ca|approx|incl|excl|St|Dr|Mr|Mrs|Ms|Prof|No|Nr|Reg|Inc|Ltd|Co|Corp|Bros|U\\.S|U\\.K";
/** Names written in lower case that can start a sentence. */
const LOWER_CASE_START = "t-online|test\\.de|up&up|iMore|newstime";
/** "Which?" only ends a sentence when the next word clearly starts a new one. Otherwise it's "Which? Best Buy". */
const AFTER_WHICH = "The|It|Its|They|Their|Both|Neither|This|That|These|Those|However|But|So";
const SENTENCE_END = new RegExp(
  `(?<!\\bWhich\\?)(?<!\\b(?:${ABBREVIATION})\\.)(?<=[.!?])\\s+(?=[A-Z0-9'"]|(?:${LOWER_CASE_START})\\b)|(?<=\\bWhich\\?)\\s+(?=(?:${AFTER_WHICH})\\b)`,
);

/** Splits text at real sentence ends, and not after "Which?", "e.g." or "No.". */
export function splitSentences(text: string) {
  return text
    .split(SENTENCE_END)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The note that says how old a price is. The date beside the prices already covers it. */
const PRICE_DATE_NOTE = /treat (these|the) prices|\b(checked|dated)\b.*\b(19|20)\d\d\b|^([\w'-]+ )?prices? (are|is|date|dates|were|was) from\b.*\b(19|20)\d\d\b/i;

/** "Honest differences" text as separate points. */
export function differencePoints(text: string) {
  return splitSentences(text).filter((s) => s.length > 3 && !PRICE_DATE_NOTE.test(s));
}

/** Sentences about prices, dates, stores or how a record was read. True, but none of them is a way the product loses. */
const NOT_ABOUT_THE_PRODUCT = new RegExp(
  [
    "\\b(prices?|priced|pricing|priciest|costs?|cheap(er|est)?|low-cost|on sale|marked down|out of stock|in stock)\\b",
    "[£$€]\\s?\\d|\\b\\d+p\\b|\\bEUR\\b",
    "\\b(checked|dated?|listing|listed at|pages?|site|photos?|records?|sources?|sellers?|marketplace)\\b",
    "\\b(19|20)\\d\\d\\b",
    "\\b(January|February|March|April|June|July|August|September|October|November|December)\\b",
    "\\bI\\b|\\bwe (did not confirm|didn't confirm|left out|ignore)\\b",
    "\\b(no|single|small|one) (taste )?tests?\\b",
    // Says the two match, or talks about the saving: neither is a way the product loses.
    "(?<!not )\\bthe same\\b|^same\\b|\\bon both\\b|\\b(lists?|labels?) (match|show no)|no ingredient differences?",
    "\\b(didn't|wasn't) (score )?better\\b|\\bscores are level\\b|\\bclose to a tie\\b|\\bwith either\\b",
    "^both (contain|labels say)\\b",
    "\\bsavings? (is|are) (small|modest)\\b|\\bconfidence\\b|\\balso (available|sells)\\b|\\bbarcode\\b|\\bmeta description\\b|\\bfigures come\\b",
  ].join("|"),
  "i",
);

/** The points that are a real way the cheaper product loses, for the "Against it" line. */
export function drawbacks(points: string[]) {
  return points.filter((p) => !NOT_ABOUT_THE_PRODUCT.test(p));
}

/** Exact counts for a one-line summary: never a blended score. */
export function matchParts(c: Comparison) {
  const all = [...c.ingredients, ...c.rows];
  const count = (v: Verdict) => all.filter((r) => r.verdict === v).length;
  const labels = c.ingredients.map((r) => r.verdict);
  const labelMatches = labels.length === 0 || labels.includes("unknown") ? null : labels.every((v) => v === "same");
  return {
    /** Every active or spec row matches. Null when the label data is missing on either side. */
    labelMatches: labels.some((v) => v === "different" || v === "brand_better") ? false : labelMatches,
    same: count("same") + count("about_same"),
    differ: count("different") + count("check"),
    brandBetter: count("brand_better"),
    altBetter: count("alt_better"),
  };
}
