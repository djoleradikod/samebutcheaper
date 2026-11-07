import { NO_RATING } from "./rating";
import { formatSize, inSentence, ppu } from "./format";
import { differentSalts, ingredientKey, slugify } from "./ingredient-key";
import type { CategorySlug, Pair, ProductSide } from "./types";

/**
 * Researched verdicts, plus "check" for things we couldn't compare from the labels, "about_same"
 * for a pack within 5%, and "unknown" when a value is missing on one side, which proves nothing.
 */
export type Verdict =
  | "same"
  | "about_same"
  | "alt_better"
  | "brand_better"
  | "different"
  | "check"
  | "unknown"
  /** No side is better or worse. The row's verdictLabel says what the numbers show. */
  | "neutral";
/** What kind of evidence a row is, so the intro can say what's on file. */
export type RowKind = "test" | "formula" | "inactive_check" | "maker" | "pack" | "price" | "licence" | "rating" | "researched";
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
  kind?: RowKind;
  /** A small line under the aspect name, e.g. the test's date and panel. */
  detail?: string;
  /** Replaces the verdict's own words. */
  verdictLabel?: string;
};
/** Nutrition and ingredients from community records, kept apart from the label rows and out of the counts. */
export type NutritionGroup = {
  caption: string;
  rows: CompareRow[];
  /** The two product records. */
  records: { name: string; page: string }[];
  source: string;
  license: string;
  licenseUrl: string;
};
export type Comparison = {
  /** "Active ingredients" or "Specs": one row per ingredient or spec, from the labels. */
  label: string;
  ingredients: CompareRow[];
  /** Everything else: test results, formula, pack, price, rating, licence, researched rows. */
  rows: CompareRow[];
  nutrition: NutritionGroup | null;
};

/** A pack this close in size counts as about the same. */
const ABOUT_SAME_SHARE = 0.05;

function packVerdict(brandSize: number, altSize: number): Verdict {
  if (brandSize === altSize) return "same";
  return Math.abs(brandSize - altSize) / Math.max(brandSize, altSize) <= ABOUT_SAME_SHARE ? "about_same" : "different";
}

const NOT_ON_FILE =
  /^(unknown|n\/a)\b|(\bnot|n['’]t) (listed|recorded|rated|stated|shown|given|published|disclosed|on file)\b|^none (listed|stated)\b|^no \w+ (listed|stated)\b/i;

/** Whether a value says it isn't stated, wherever the words sit. A bracket is an aside, so "6 ft cable (rating not stated)" still states a value. */
function notOnFile(value: string) {
  const text = value.trim();
  return NOT_ON_FILE.test(text.replace(/\(.*?\)/g, "").trim() || text);
}

/** A missing value against a real one isn't a difference. A verdict that says the brand or the cheaper one won stays. */
function withoutFalseDifference(row: CompareRow): CompareRow {
  const missing = notOnFile(row.brand) || notOnFile(row.alternative);
  return missing && (row.verdict === "different" || row.verdict === "check") ? { ...row, verdict: "unknown" } : row;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s,]+/g, "");

/** One row per ingredient: "Bisacodyl" and "Bisacodyl USP" are one row. A name the key drops, like "Sodium", keeps its own words. */
const rowKey = (name: string) => ingredientKey(name) || slugify(name);

/**
 * An amount in a form two labels can agree on: "8.80%" and "8.8%", "1,000 mg", "1.000 mg" and "1000 mg",
 * "1,5%" and "1.5%", "per 2 caplets" and "per 2 tablets" all come out equal. Any other difference stays.
 * A point before three digits is a thousands separator unless the number starts at zero, as in "0.454%".
 */
function amountKey(amount: string) {
  return amount
    .toLowerCase()
    .replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1")
    .replace(/(?<![\d.])[1-9]\d{0,2}(?:\.\d{3})+(?!\d)/g, (n) => n.replace(/\./g, ""))
    .replace(/\d*\.?\d+/g, (n) => String(Number(n)))
    .replace(/\bcaplet(s?)\b/g, "tablet$1")
    .replace(/[µμ]g\b/g, "mcg")
    .replace(/[\s,]+/g, "");
}

/** Letters and digits only, for comparing two records of the same ingredient list. */
const listKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** The cheaper product reads "No rating found yet". For a brand, that would contradict a test named elsewhere on the page. */
function ratingText(p: ProductSide, missing: string) {
  return p.rating?.label ?? missing;
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
  for (const i of pair.brand.key_ingredients) rows.set(rowKey(i.name), { name: i.name, brand: i.amount });
  for (const i of pair.alternative.key_ingredients) {
    const key = rowKey(i.name);
    const row = rows.get(key);
    // "Creatine monohydrate" and "Creatine HCl" share a key but aren't one row.
    if (row && !differentSalts(row.name, i.name)) row.alt = i.amount;
    else rows.set(row ? `${key}|${i.name}` : key, { name: i.name, alt: i.amount });
  }
  const chemistry = pair.match_type !== "equivalent_spec" && pair.match_type !== "same_kind";
  return [...rows.values()].map((r) => {
    const slug = chemistry && slugFor ? slugFor(r.name) : undefined;
    return {
      aspect: r.name,
      brand: r.brand === undefined ? "Not listed" : r.brand || "Yes",
      alternative: r.alt === undefined ? "Not listed" : r.alt || "Yes",
      verdict: amountVerdict(r.brand, r.alt),
      href: slug ? `/ingredient/${slug}` : undefined,
    };
  });
}

/** Both sides have to state a value for a row to say same or different. A name with an amount only on one side proves neither. */
function amountVerdict(brand: string | undefined, alt: string | undefined): Verdict {
  if (brand === undefined || alt === undefined) return "unknown";
  const stated = (amount: string) => amount !== "" && !notOnFile(amount);
  if (brand === "" && alt === "") return "same";
  if (!stated(brand) || !stated(alt)) return "unknown";
  return amountKey(brand) === amountKey(alt) ? "same" : "different";
}

/* --------------------------------------------------------- test results */

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const TEST_HOSTS: [RegExp, string][] = [
  [/^Which\?/, "which.co.uk"],
  [/^Stiftung Warentest/, "test.de"],
  [/^Öko-Test/, "oekotest.de"],
  [/^Auto Express/, "autoexpress.co.uk"],
];

/** The test's own page, when the record has it. */
function testPage(pair: Pair, testName: string) {
  const host = TEST_HOSTS.find(([name]) => name.test(testName))?.[1];
  return host ? pair.sources.find((s) => hostOf(s) === host) : undefined;
}

/** The test's own page, or else the page the evidence names as reporting the result, but never a brand's own shop. */
function testSource(pair: Pair, testName: string) {
  const reported = pair.sources.find((s) => {
    const site = hostOf(s).split(".")[0];
    return site.length >= 3 && !sideNamed(pair, site) && new RegExp(`\\b${site.replace(/[^a-z0-9-]/g, "")}\\b`, "i").test(pair.evidence);
  });
  return testPage(pair, testName) ?? reported ?? pair.sources[0];
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "");

/** A name's words, each also without a trailing "s", so "Aldi's" finds "Aldi" and "Sainsbury's" finds "sainsburys". */
function nameWords(text: string) {
  const words = new Set<string>();
  for (const w of fold(text).split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3 || /^\d+$/.test(w) || w === "the" || w === "and") continue;
    words.add(w);
    words.add(w.replace(/s$/, ""));
  }
  return words;
}

/**
 * Which side a name in the text means. It has to share a word with one side and none with the other,
 * counting only words the two sides don't share. Anything less clear is null, and no row gets written.
 */
export function sideNamed(pair: Pair, mention: string): "brand" | "alternative" | null {
  const [brandSlug = "", altSlug = ""] = pair.slug.split("-vs-");
  const brand = nameWords(`${pair.brand.brand} ${pair.brand.product} ${brandSlug}`);
  const alt = nameWords(`${pair.alternative.brand} ${pair.alternative.product} ${altSlug}`);
  const words = [...nameWords(mention)];
  const forBrand = words.some((w) => brand.has(w) && !alt.has(w));
  const forAlt = words.some((w) => alt.has(w) && !brand.has(w));
  return forBrand === forAlt ? null : forBrand ? "brand" : "alternative";
}

const verdictFrom = (brandRank: number, altRank: number): Verdict =>
  brandRank === altRank ? "same" : altRank < brandRank ? "alt_better" : "brand_better";

type Score = { brand: string; alternative: string; verdict: Verdict; lowerIsBetter?: boolean };

/** "Tesco 78%, 59p for 400g." The comma keeps out names with a percentage in them, like "Belgian 70%". */
const PANEL_LINE = /^(.+?)(?: scored)? (\d{1,3})%,\s/;
const PANEL_TEST = /^(Which\? [^,:.]+?), (?:published|tested) (?:\d{1,2} )?([A-Z][a-z]+ \d{4})/;
const PANEL_SIZE = /\b(\d+)(?:-strong panel| tasters| testers| people)|\bpanel of (\d+)/;

/** Which?'s panel results: the first sentence names the test and each side has its own line. */
function panelResult(pair: Pair): CompareRow | null {
  const [first, ...lines] = splitSentences(pair.evidence);
  const test = first?.match(PANEL_TEST);
  if (!test) return null;
  const found: { brand?: number; alternative?: number } = {};
  for (const line of lines) {
    const m = line.match(PANEL_LINE);
    const side = m && sideNamed(pair, m[1]);
    if (!m || !side) continue;
    const score = Number(m[2]);
    if (found[side] !== undefined && found[side] !== score) return null;
    found[side] = score;
  }
  if (found.brand === undefined || found.alternative === undefined) return null;
  const panel = first.match(PANEL_SIZE);
  return {
    aspect: test[1],
    brand: `${found.brand}%`,
    alternative: `${found.alternative}%`,
    verdict: verdictFrom(-found.brand, -found.alternative),
    detail: panel ? `${test[2]}, ${panel[1] ?? panel[2]} people` : test[2],
    source: testSource(pair, test[1]),
    kind: "test",
  };
}

const GRADE = "(\\d\\.\\d)";
const WORD = "(very good|good|satisfactory|sufficient|poor)";
const WORD_RANK: Record<string, number> = { "very good": 1, good: 2, satisfactory: 3, sufficient: 4, poor: 5 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A pair of grades read out of one sentence, with the name each one belongs to. */
type GradeRead = { names: [string, string?]; values: [string, string?]; words?: [string?, string?] };

/**
 * The ways the German test records state both results. Only these count, so a sentence
 * written any other way gets no row. In German tests a lower grade is better.
 */
const GRADE_SENTENCES: { re: RegExp; read: (m: RegExpMatchArray) => GradeRead }[] = [
  // "give Bevola 1.5 and Sensodyne 2.0"
  { re: new RegExp(`\\bgive (.+?) ${GRADE} and (.+?) ${GRADE}\\b`), read: (m) => ({ names: [m[1], m[3]], values: [m[2], m[4]] }) },
  // "rated both very good, Whiskas 1.2 and Coshida 1.3"
  { re: new RegExp(`, (\\S+(?: \\S+)?) ${GRADE} and (\\S+(?: \\S+)?) ${GRADE}\\b`), read: (m) => ({ names: [m[1], m[3]], values: [m[2], m[4]] }) },
  // "Lidl's Formil powder scored 1.6 against Persil's 1.9"
  { re: new RegExp(`(.+?) scored ${GRADE} against (.+?)'s ${GRADE}\\b`), read: (m) => ({ names: [m[1], m[3]], values: [m[2], m[4]] }) },
  // "Alnatura scored better at 2.3 against 2.6"
  { re: new RegExp(`(.+?) scored better at ${GRADE} against ${GRADE}\\b`), read: (m) => ({ names: [m[1]], values: [m[2], m[3]] }) },
  // "the Netto food scored 1.3 at about 7 cents a day, and the Whiskas got 1.8"
  { re: new RegExp(`\\bthe (.+?) scored ${GRADE}\\b.*?\\band the (.+?) got ${GRADE}\\b`), read: (m) => ({ names: [m[1], m[3]], values: [m[2], m[4]] }) },
  // "the Lenor liquid was rated poor (5.1) and the Aldi liquid got 2.5"
  {
    re: new RegExp(`\\bthe (.+?) was rated ${WORD} \\(${GRADE}\\) and the (.+?) got ${GRADE}\\b`),
    read: (m) => ({ names: [m[1], m[4]], values: [m[3], m[5]], words: [m[2]] }),
  },
  // "the Rossmann tablet got a good 2.1 at 9 cents a wash, and the Frosch tablet was rated poor"
  {
    re: new RegExp(`\\bthe (.+?) got a ${WORD} ${GRADE}\\b.*?\\band the (.+?) was rated ${WORD}\\b`),
    read: (m) => ({ names: [m[1], m[4]], values: [m[3]], words: [m[2], m[5]] }),
  },
  // "the Balea shampoo was rated good and the Pantene satisfactory", "...and the Pril was sufficient"
  {
    re: new RegExp(`\\bthe (.+?) was rated ${WORD}\\b.*?\\band the (.+?) (?:was )?${WORD}\\b`),
    read: (m) => ({ names: [m[1], m[3]], values: [""], words: [m[2], m[4]] }),
  },
];

/** "gave these two sun milks the same grade, 1.5" */
const SAME_GRADE = new RegExp(`\\bthe same grade, ${GRADE}\\b`);
/** "Both were rated very good by Öko-Test", "rated both fine oat flakes very good" */
const BOTH_RATED = new RegExp(`\\b(?:both\\b[^.,]*?\\brated|rated both\\b[^.,]*?)\\s*${WORD}\\b`, "i");

const GERMAN_TEST = /(Stiftung Warentest|Öko-Test)/;

function germanTestName(pair: Pair) {
  const publisher = pair.summary.match(GERMAN_TEST)?.[1];
  if (!publisher) return null;
  const issue = (text: string) => text.match(new RegExp(`${publisher}(?:'s)?\\b[^.]*?\\b(\\d{1,2}/\\d{4})`))?.[1];
  const number = issue(pair.summary) ?? issue(pair.evidence);
  if (number) return { name: `${publisher} ${number}` };
  const programme = pair.summary.match(new RegExp(`${publisher}'s ([^,.]*?results)\\b`))?.[1];
  if (programme) return { name: `${publisher} ${programme}` };
  const when = pair.summary.match(/\bin ([A-Z][a-z]+ \d{4})\b/)?.[1];
  return { name: publisher, detail: when };
}

/** Puts a read in brand-then-alternative order. Null unless each name clearly means a different side. */
function scoreFrom(pair: Pair, r: GradeRead): Score | null {
  const first = sideNamed(pair, r.names[0]);
  if (!first) return null;
  const second = r.names[1] === undefined ? (first === "brand" ? "alternative" : "brand") : sideNamed(pair, r.names[1]);
  if (!second || second === first) return null;
  const shown = (i: 0 | 1) => {
    const word = r.words?.[i];
    const value = r.values[i];
    if (word && value) return `${cap(word)} (${value})`;
    return word ? cap(word) : (value ?? "");
  };
  const rank = (i: 0 | 1) => {
    const value = r.values[i];
    const word = r.words?.[i];
    return { value: value ? Number(value) : undefined, word: word ? WORD_RANK[word] : undefined };
  };
  const [a, b] = [rank(0), rank(1)];
  const useValues = a.value !== undefined && b.value !== undefined;
  const useWords = a.word !== undefined && b.word !== undefined;
  if (!useValues && !useWords) return null;
  const [x, y] = useValues ? [a.value!, b.value!] : [a.word!, b.word!];
  const [brandRank, altRank] = first === "brand" ? [x, y] : [y, x];
  return {
    brand: shown(first === "brand" ? 0 : 1),
    alternative: shown(first === "brand" ? 1 : 0),
    verdict: verdictFrom(brandRank, altRank),
    lowerIsBetter: useValues,
  };
}

/** A German test result stated plainly in the record's summary, for both sides. */
function gradeResult(pair: Pair): CompareRow | null {
  const test = germanTestName(pair);
  if (!test) return null;
  for (const sentence of splitSentences(pair.summary)) {
    let score: Score | null = null;
    const same = sentence.match(SAME_GRADE);
    const both = sentence.match(BOTH_RATED);
    for (const { re, read } of GRADE_SENTENCES) {
      const m = sentence.match(re);
      if (m && (score = scoreFrom(pair, read(m)))) break;
    }
    if (!score && same) score = { brand: same[1], alternative: same[1], verdict: "same", lowerIsBetter: true };
    if (!score && both) score = { brand: cap(both[1].toLowerCase()), alternative: cap(both[1].toLowerCase()), verdict: "same" };
    if (!score) continue;
    const notes = [test.detail, score.lowerIsBetter ? "Lower grades are better" : undefined].filter(Boolean);
    return {
      aspect: test.name,
      brand: score.brand,
      alternative: score.alternative,
      verdict: score.verdict,
      detail: notes.join(". ") || undefined,
      source: testSource(pair, test.name),
      kind: "test",
    };
  }
  return null;
}

/** Researched rows that report a named test or its results. A shopper rating isn't one. */
const TEST_ASPECT = /\bscore$|^test results?\b|^consumer reports (rating|rank)\b|^load test$|\bin the test$/i;
const AUTO_EXPRESS_DATE = /^Auto Express, (?:\d{1,2} )?([A-Z][a-z]+ \d{4})/;

function withTestDetails(pair: Pair, row: CompareRow): CompareRow {
  if (!TEST_ASPECT.test(row.aspect)) return { ...row, kind: "researched" };
  const date = /^Auto Express/.test(row.aspect) ? pair.evidence.match(AUTO_EXPRESS_DATE)?.[1] : undefined;
  // "Cost per wash in the test" doesn't name its test, so it takes the name the evidence opens with.
  return { ...row, kind: "test", detail: date, source: row.source ?? testPage(pair, row.aspect) ?? testPage(pair, pair.evidence) };
}

/* -------------------------------------------------------------- nutrition */

/** Under the larger of 10% or this much, two values count as about the same. Picked to sit below what a label rounds to. */
const NUTRIENTS = [
  { key: "kcal", label: "Energy", unit: "kcal", close: 10 },
  { key: "fat", label: "Fat", unit: "g", close: 0.5 },
  { key: "saturates", label: "Saturates", unit: "g", close: 0.3 },
  { key: "sugars", label: "Sugars", unit: "g", close: 0.5 },
  { key: "salt", label: "Salt", unit: "g", close: 0.1 },
  { key: "protein", label: "Protein", unit: "g", close: 0.5 },
  { key: "fibre", label: "Fibre", unit: "g", close: 0.5 },
] as const;

const ABOUT_SAME_NUTRIENT_SHARE = 0.1;
/** Two matched products this far apart on energy almost always means one record is wrong, so we show neither set of figures. */
const WRONG_RECORD_ENERGY_RATIO = 1.8;
/** extract_nutrition.py cuts lists at this length. */
const INGREDIENTS_CUT_AT = 600;

/** "About the same", or which side is higher. Says nothing about which is better for you. */
export function nutrientVerdict(brandValue: number, altValue: number, close: number, brandName: string, altName: string) {
  const gap = Math.abs(brandValue - altValue);
  if (gap <= close || gap <= Math.max(brandValue, altValue) * ABOUT_SAME_NUTRIENT_SHARE) return "About the same";
  return `${brandValue > altValue ? brandName : altName} higher`;
}

const plainNumber = (n: number) => String(Number(n.toFixed(2)));
const ingredientText = (s: string) => (s.length >= INGREDIENTS_CUT_AT ? `${s}…` : s);

/** Case and punctuation aren't a difference. Under a same-formula label, wording that still doesn't match sends the shopper to the pack. */
export function ingredientListLabel(brand: string, alt: string, matchType: Pair["match_type"]) {
  if (listKey(brand) === listKey(alt)) return "Same list";
  return matchType === "identical_formula" ? "Records worded differently, check the pack" : "Lists differ";
}

function nutritionGroup(pair: Pair): NutritionGroup | null {
  const b = pair.brand.nutrition;
  const a = pair.alternative.nutrition;
  const source = pair.nutritionSource;
  if (!b || !a || !source) return null;
  const rows: CompareRow[] = [];
  const energyGap = b.kcal && a.kcal ? Math.max(b.kcal, a.kcal) / Math.min(b.kcal, a.kcal) : 1;
  if (energyGap <= WRONG_RECORD_ENERGY_RATIO) {
    for (const n of NUTRIENTS) {
      const x = b[n.key];
      const y = a[n.key];
      if (x === null || y === null) continue;
      rows.push({
        aspect: n.label,
        brand: `${plainNumber(x)} ${n.unit}`,
        alternative: `${plainNumber(y)} ${n.unit}`,
        verdict: "neutral",
        verdictLabel: nutrientVerdict(x, y, n.close, pair.brand.brand, pair.alternative.brand),
      });
    }
  }
  if (b.ingredients && a.ingredients) {
    rows.push({
      aspect: "Ingredients",
      brand: ingredientText(b.ingredients),
      alternative: ingredientText(a.ingredients),
      verdict: "neutral",
      verdictLabel: ingredientListLabel(b.ingredients, a.ingredients, pair.match_type),
    });
  }
  if (rows.length === 0) return null;
  const unit = pair.brand.unit;
  const per = /^(ml|cl|l|litre|liter|fl oz)\b/i.test(unit) ? "per 100 ml" : /^(g|kg|oz|lb|gram)\b/i.test(unit) ? "per 100 g" : "per 100 g or 100 ml";
  return {
    caption: rows.some((r) => r.aspect !== "Ingredients") ? `Nutrition ${per}, and ingredients` : "Ingredients",
    rows,
    records: [
      { name: pair.brand.brand, page: b.page },
      { name: pair.alternative.brand, page: a.page },
    ],
    source: source.source,
    license: source.license,
    licenseUrl: source.licenseUrl,
  };
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
      kind: "formula",
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
            kind: "formula",
          }
        : {
            aspect: "Inactive ingredients",
            brand: `Its own ${words}`,
            alternative: "Can differ. Read the label if you have allergies",
            verdict: "check",
            kind: "inactive_check",
          },
    );
  } else if (pair.match_type === "same_manufacturer") {
    rows.push({ aspect: "Who makes it", brand: "Same maker", alternative: "Same maker (see sources)", verdict: "same", kind: "maker" });
  }

  rows.push({
    aspect: "Pack",
    brand: formatSize(b.size, b.unit),
    alternative: formatSize(a.size, a.unit),
    verdict: packVerdict(b.size, a.size),
    kind: "pack",
  });

  rows.push({
    aspect: `Price per ${b.unit}`,
    brand: ppu(b.ppu, pair.currency),
    alternative: `${ppu(a.ppu, pair.currency)} (${Math.round(pair.savingsPct)}% less)`,
    verdict: "alt_better",
    uncounted: true,
    kind: "price",
  });

  if (b.license_id || a.license_id) {
    const same = !!b.license_id && !!a.license_id && norm(b.license_id) === norm(a.license_id);
    rows.push({
      aspect: "Licence number",
      brand: b.license_id ?? "Not recorded",
      alternative: a.license_id ?? "Not recorded",
      verdict: !b.license_id || !a.license_id ? "unknown" : same ? "same" : "different",
      kind: "licence",
    });
  }

  if (b.rating || a.rating) {
    const diff = (a.rating?.share ?? 0) - (b.rating?.share ?? 0);
    rows.push({
      aspect: a.rating?.publisher ? `${a.rating.publisher} score` : "Shopper rating",
      brand: ratingText(b, "Not compared here"),
      alternative: ratingText(a, NO_RATING),
      verdict:
        !b.rating || !a.rating ? "unknown" : Math.abs(diff) <= 0.04 ? "same" : diff > 0 ? "alt_better" : "brand_better",
      source: a.rating?.source ?? b.rating?.source,
      kind: "rating",
    });
  }

  // Researched rows win over generated ones with the same name.
  let researched: CompareRow[] = (pair.aspects ?? []).map(withoutFalseDifference).map((r) => withTestDetails(pair, r));
  const fromText = panelResult(pair) ?? gradeResult(pair);
  if (fromText && !researched.some((r) => norm(r.aspect) === norm(fromText.aspect))) researched = [fromText, ...researched];
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
  const ordered = leadsWithFormula ? [first, ...researched, ...rest] : [...researched, ...generated];
  // A test result is the proof a doubtful shopper is looking for, so it goes first.
  return {
    label: pair.match_type === "equivalent_spec" || pair.match_type === "same_kind" ? "Specs" : "Active ingredients",
    ingredients,
    rows: [...ordered.filter((r) => r.kind === "test"), ...ordered.filter((r) => r.kind !== "test")],
    nutrition: nutritionGroup(pair),
  };
}

/** How many researched rows the intro names before it just counts the rest. */
const RESEARCHED_NAMED = 3;

/**
 * The line under "Same or different?". It's built from the rows on this swap, so it can't
 * promise specs, certifications or tests the table doesn't show.
 */
export function onFileIntro(c: Comparison) {
  const proof = proofOnFile(c);
  if (proof.length === 0) {
    return c.ingredients.length
      ? "Beyond the pack size and the unit price, our records only have details the other side doesn't state. Nothing here compares what's inside."
      : "All we have on file for this swap is the pack size and the unit price. Nothing here compares what's inside.";
  }
  return `On file for this swap: ${proof.join(", ")}, pack size and unit price.`;
}

/** Whether anything on file goes beyond pack and price. Without it a swap can't claim to do the same job. */
export function hasProof(c: Comparison) {
  return proofOnFile(c).length > 0;
}

const CONTAINER = "pack|packet|bag|bottle|can|box|tub|tin|jar|tube|pouch|roll|carton|container";
/** A researched row with one of these names only restates the pack size, which compares nothing: "Bag size", "Length per roll". */
export const RESTATES_PACK = new RegExp(
  `^(?:(?:${CONTAINER})(?: (?:size|count|contents))?|(?:size|length|weight|volume|contents|count|amount) (?:of|per) (?:the |a )?(?:${CONTAINER}))$`,
  "i",
);

function proofOnFile(c: Comparison) {
  const has = (kind: RowKind) => c.rows.some((r) => r.kind === kind);
  const tests = c.rows.filter((r) => r.kind === "test").map((r) => r.aspect);
  const researched = c.rows.filter((r) => r.kind === "researched" && !RESTATES_PACK.test(r.aspect.trim())).map((r) => inSentence(r.aspect));
  const others = researched.length - RESEARCHED_NAMED;
  return [
    ...(tests.length === 1 ? [`the ${tests[0]} result`] : tests.length > 1 ? [`${tests.length} test results`] : []),
    ...(c.nutrition ? [c.nutrition.rows.some((r) => r.aspect !== "Ingredients") ? "nutrition and ingredients from community records" : "ingredients from community records"] : []),
    // A row with a value on one side only compares nothing.
    ...(c.ingredients.some((r) => r.verdict !== "unknown") ? [inSentence(c.label)] : []),
    ...(has("formula") ? ["the ingredient list"] : []),
    ...(has("maker") ? ["who makes it"] : []),
    ...researched.slice(0, RESEARCHED_NAMED),
    ...(others > 0 ? [`${others} other ${others === 1 ? "point" : "points"}`] : []),
    ...(has("licence") ? ["licence numbers"] : []),
    // As above, a rating on one side only compares nothing.
    ...(c.rows.some((r) => r.kind === "rating" && r.verdict !== "unknown") ? ["ratings"] : []),
  ];
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

/** Says nothing happened, or that the two match. These leave the page. Kept narrow, because they go for good. */
const SAYS_NOTHING = new RegExp(
  [
    "\\b(didn't|did not|wasn't|was not) (score )?better\\b",
    "^same [\\w\\s]{0,30}\\.?$",
    "\\bare the same\\.?$",
    "^neither difference changes\\b",
  ].join("|"),
  "i",
);

/**
 * True and worth knowing, but about the record rather than a way the products differ: prices and dates,
 * who tested what, what we couldn't check, what applies to both, and instructions. Goes beside the evidence.
 */
const CAVEAT = new RegExp(
  [
    "\\bprices?\\b|\\bout of stock\\b|\\bmarked down\\b|\\bon sale\\b|\\bshipping\\b|\\bdelivery\\b|\\bbottle deposit\\b",
    "\\b(we|i)( also)? (did not|didn't|could not|couldn't|can't|cannot|have not|haven't|have no|found no|know of no|read nothing|used|left out|took|compared|ignored?|checked)\\b",
    "\\bno\\b[^.]{0,40}\\b(tests?|trials?)\\b[^.]*\\b(covers?|compares?|found|read)\\b",
    "\\bour (grades?|sources?)\\b|\\bthe sources\\b",
    "\\bone panel\\b|\\btaste result\\b|\\bscores? (are|is) taste\\b|\\bsingle small tests?\\b|\\bthe test covered\\b|\\bits grades\\b",
    "\\bone[- ]point\\b[^.]*\\b(tie|small)\\b|\\bone point between\\b|\\bgrades are almost level\\b",
    "\\bphotos?\\b|\\bbarcode\\b|\\bmeta description\\b|\\bconfidence\\b|\\bbefore publishing\\b|\\bthis pair\\b",
    "\\bpaywall\\b|\\bmembers[- ]only\\b|\\bfor members\\b",
    "\\b(data|records?) (does|do|doesn't|don't)\\b|\\b(isn't|aren't) on either\\b|\\bon either (page|record|listing)\\b",
    "^neither\\b|^both\\b(?!.*\\bbut\\b)|\\bon both\\b",
    "^(ask|check|follow|match|confirm|dose|do not confuse|note:)\\b",
    "\\bno (ingredient|formula) differences?\\b|\\b(were|was) not (verified|compared|checked|listed)\\b|\\bchecked\\b|\\bunclear\\b",
    "\\brecords?\\b|\\b(list|figures?) comes? from\\b|\\bdo(es)? not say\\b|\\bdoesn't say\\b|\\b(has|have) since changed\\b",
    "\\brate[sd] ingredients\\b|\\bdoesn't test\\b|\\bnot exactly this model\\b|\\balso available\\b|\\banother [\\w\\s-]*\\boption\\b",
  ].join("|"),
  "i",
);

/** A warning stays in the differences list, however else the sentence reads, because a shopper must not miss it. */
const SAFETY = /\b(toxic|poison\w*|danger\w*|hazard\w*|fatal|allerg\w+|not suitable|not for (children|infants|babies|cats|dogs))\b/i;

/**
 * Sorts a record's "differences" text. `points` are concrete differences, for "where the brand wins".
 * `caveats` go beside the evidence, so nothing honest is lost when the section hides. A sentence
 * neither rule knows counts as a difference, because that's the mistake that hides nothing.
 */
export function sortDifferences(text: string) {
  const points: string[] = [];
  const caveats: string[] = [];
  for (const s of splitSentences(text)) {
    if (s.length <= 3 || SAYS_NOTHING.test(s)) continue;
    (CAVEAT.test(s) && !SAFETY.test(s) ? caveats : points).push(s);
  }
  return { points, caveats };
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
