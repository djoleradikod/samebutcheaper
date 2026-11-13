/**
 * Matches receipt lines to catalogue swaps, with a confidence. Pure: the caller passes the swaps this shopper's
 * country lists (forCountry), and tests pass the same.
 *
 * A wrong match costs more trust than a miss, so this is strict:
 * - The brand must be on the line. A line that names only the brand (with a strength or a pack size at most) is a
 *   match only when exactly one of the brand's products fits what it says; when several fit, the shopper is asked
 *   which one, and the products that don't fit (another strength, form or variant) are never among them.
 * - The line's own words must be the product's words: "HEINZ BAKED BEANZ" never becomes Heinz ketchup.
 * - A strength on the line must be the product's strength ("NUROFEN 400MG" is not the 200 mg pack).
 * - A variant word on the line that the product doesn't have (zero, light, max, children, pods, size 5) rules it out,
 *   and one the product has that the line doesn't say makes it a "did you mean" at most.
 * - A brand spelt nearly right (found with the site search's fuzzy matcher, Fuse) is only ever a "did you mean".
 * Confident matches show as swaps, uncertain ones as "did you mean", and the rest as nothing on file yet.
 */
import Fuse from "fuse.js";
import { describing, strengthsIn, umlautsWrittenOut, words, type ParsedLine, type Size } from "./parse";

/** What the matcher reads from a swap. Build it with toCandidate. */
export type Candidate = {
  slug: string;
  brand: string;
  /** The brand-name product as named on the swap page, size included. */
  product: string;
  subcategory: string;
  actives: { name: string; amount: string }[];
  /** The brand pack the saving is worked out for. */
  size: number;
  unit: string;
  savingsPct: number;
  /** The cheaper product's brand: a line naming one of these is already the cheaper pick. */
  altBrand: string;
};

export function toCandidate(p: {
  slug: string;
  subcategory: string;
  savingsPct: number;
  brand: { brand: string; product: string; size: number; unit: string; key_ingredients?: { name: string; amount: string }[] };
  alternative: { brand: string };
}): Candidate {
  return {
    slug: p.slug,
    brand: p.brand.brand,
    product: p.brand.product,
    subcategory: p.subcategory,
    actives: p.brand.key_ingredients ?? [],
    size: p.brand.size,
    unit: p.brand.unit,
    savingsPct: p.savingsPct,
    altBrand: p.alternative.brand,
  };
}

export type LineMatch =
  /** Shown as a swap. `slug` is the swap with the biggest saving for that product; `others` more are on file. */
  | { status: "swap"; slug: string; others: number }
  /** Shown as "did you mean". */
  | { status: "maybe"; slug: string; others: number }
  /**
   * The line names only a brand (with a strength or a size at most) and more than one of that brand's products fits
   * it: the shopper picks which one. `slugs` holds the best swap for each product that fits, best fit first.
   */
  | { status: "choose"; slugs: string[] }
  /** The line already names a product we list as the cheaper pick. */
  | { status: "own" }
  | { status: "none" };

// ---------------------------------------------------------------------------------------------------------------------
// Word classes

/** Words that make a different product of the same brand. One on the line that the product lacks rules it out. */
const VARIANTS = new Set([
  "light", "zero", "diet", "decaf", "free", "children", "infant", "junior", "max", "extra", "plus", "ultra", "sensitive",
  "nonbio", "bio", "organic", "unscented", "mini", "indoor", "puppy", "kitten", "senior", "pant", "color", "universal",
  "gel", "powder", "pod", "spray", "night", "cherry", "strawberry", "chocolate", "salted", "unsalted", "skimmed", "semi",
  "whole", "crunchy", "smooth", "creamy", "reduced", "low", "fresh", "akut", "forte", "duo", "dual", "rapid", "express",
  "aa", "aaa", "cr2032", "9v", "pm", "nighttime", "sleep", "sinus", "cold", "flu", "cough", "migraine", "arthritis", "nacht",
]);
/** Dosage forms. One on the line that the product lacks rules it out; the line leaving it out is fine. */
const FORMS = new Set(["tablet", "capsule", "liquid", "syrup", "suspension", "cream", "ointment", "drop", "sachet", "chewable", "lozenge"]);

/** A size of nappy, a stage or a pasta number: "size4", "no5". Two different ones are two products. */
const isSpec = (w: string) => /^(?:size|no)\d+$/.test(w);

/** A line word found among a product's words, allowing for till-roll shortening ("TOM" for tomato). */
function found(word: string, product: ReadonlySet<string>) {
  if (product.has(word)) return true;
  for (const p of product) {
    if (word.length >= 3 && p.startsWith(word)) return true;
    if (p.length >= 4 && word.startsWith(p)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Index

type Group = {
  /** The swaps for one brand-name product, best saving first. */
  slugs: string[];
  brandWords: string[];
  /** Every word that names the product: its name, aisle and actives, without the brand's own words. */
  words: Set<string>;
  strengths: Set<string>;
  size: Size | null;
};

export type Index = {
  groups: Group[];
  /** brand words joined by a space -> groups of that brand */
  byBrand: Map<string, Group[]>;
  /** Another way a brand is written ("loewensenf") -> its key in byBrand ("lowensenf"). */
  aliases: Map<string, string>;
  /** Brand names for the fuzzy search, each with its key in byBrand. */
  fuzzy: Fuse<{ name: string; key: string }>;
  /** Brands of the cheaper side that aren't also a brand-name side, as word lists, and store names. */
  cheaper: string[][];
};

/** Store and own-label names a receipt line may start with. The catalogue's cheaper brands are added to these. */
const STORE_BRANDS = [
  "tesco", "sainsburys", "asda", "aldi", "lidl", "morrisons", "waitrose", "co op", "coop", "iceland", "great value", "gv",
  "equate", "kirkland", "kirkland signature", "ks", "members mark", "good and gather", "up and up", "market pantry",
  "signature select", "kroger", "ja", "k classic", "gut and gunstig", "rewe beste wahl", "jeden tag", "balea", "isana",
  "dontodent", "milsani", "penny", "netto", "dm", "mivolis", "das gesunde plus", "everyday essentials", "specially selected",
];

/** The brand's unit as a size the parser can compare: 730 ml, 460 g, 16 tablets. */
function brandSize(size: number, unit: string): Size | null {
  const u = unit.toLowerCase().trim();
  if (/^(ml|millilitre|milliliter)$/.test(u)) return { amount: size, unit: "ml" };
  if (/^(l|litre|liter)$/.test(u)) return { amount: size * 1000, unit: "ml" };
  if (/^(g|gram|gramme)$/.test(u)) return { amount: size, unit: "g" };
  if (/^(kg|kilo|kilogram)$/.test(u)) return { amount: size * 1000, unit: "g" };
  if (/^(oz|fl ?oz)$/.test(u)) return { amount: size, unit: "oz" };
  if (/^(lb)$/.test(u)) return { amount: size * 16, unit: "oz" };
  if (/^(square metre|square meter|m2|metre|meter|yard|gb|tb)$/.test(u)) return null;
  return { amount: size, unit: "count" };
}

function sameSize(a: Size, b: Size) {
  return a.unit === b.unit && Math.abs(a.amount - b.amount) <= Math.max(0.5, b.amount * 0.03);
}

export function buildIndex(candidates: readonly Candidate[]): Index {
  const byProduct = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = `${c.brand}\n${c.product}`.toLowerCase();
    byProduct.set(key, [...(byProduct.get(key) ?? []), c]);
  }
  const groups: Group[] = [];
  const byBrand = new Map<string, Group[]>();
  for (const list of byProduct.values()) {
    const sorted = [...list].sort((a, b) => b.savingsPct - a.savingsPct);
    const c = sorted[0];
    const brandWords = words(c.brand);
    const own = new Set(brandWords);
    const text = [c.product, c.subcategory, ...c.actives.map((a) => a.name)].join(" ");
    const group: Group = {
      slugs: sorted.map((x) => x.slug),
      brandWords,
      words: new Set([...words(text), ...words(umlautsWrittenOut(text))].filter((w) => !own.has(w))),
      strengths: new Set(strengthsIn([c.product, ...c.actives.map((a) => a.amount)].join(" "))),
      size: brandSize(c.size, c.unit),
    };
    groups.push(group);
    const key = brandWords.join(" ");
    byBrand.set(key, [...(byBrand.get(key) ?? []), group]);
  }
  const brandKeys = new Set(byBrand.keys());
  const aliases = new Map<string, string>();
  for (const c of candidates) {
    const key = words(c.brand).join(" ");
    const other = words(umlautsWrittenOut(c.brand)).join(" ");
    if (other !== key && !brandKeys.has(other)) aliases.set(other, key);
  }
  const cheaper = [...new Set([...candidates.map((c) => words(c.altBrand).join(" ")), ...STORE_BRANDS])]
    .filter((k) => k && !brandKeys.has(k))
    .map((k) => k.split(" "));
  const fuzzy = new Fuse(
    [...byBrand.keys()].map((key) => ({ name: key.replace(/ /g, ""), key })),
    { keys: ["name"], threshold: 0.3, ignoreLocation: true, includeScore: true },
  );
  return { groups, byBrand, aliases, fuzzy, cheaper };
}

// ---------------------------------------------------------------------------------------------------------------------
// One line

type Item = Extract<ParsedLine, { kind: "item" }>;

/** Is `brand` on the line: all its words, or written as one word ("HAAGENDAZS", "PGTIPS")? Short brands must lead. */
function brandOnLine(brand: string[], line: string[]) {
  const joined = brand.join("");
  if (joined.length <= 3) return brand.every((w, i) => line[i] === w) || line[0] === joined;
  return brand.every((w) => line.includes(w)) || line.includes(joined);
}

type Scored = { group: Group; coverage: number; matched: number; sizeMatch: boolean; missingVariant: boolean };

function score(item: Item, group: Group, brandWords: string[]): Scored | null {
  const own = new Set(brandWords);
  const lineWords = describing(item.words).filter((w) => !own.has(w) && w !== brandWords.join(""));
  // A strength on the line must be this product's.
  if (item.strengths.length && group.strengths.size && !item.strengths.some((s) => group.strengths.has(s))) return null;
  // A size of nappy, a stage or a pasta number must agree, and a product without one isn't what the line means.
  const specs = lineWords.filter(isSpec);
  const groupSpecs = [...group.words].filter(isSpec);
  if (specs.length && !specs.some((s) => groupSpecs.includes(s))) return null;
  // A variant or a form the line names that the product doesn't have.
  if (lineWords.some((w) => (VARIANTS.has(w) || FORMS.has(w)) && !group.words.has(w))) return null;

  const plain = lineWords.filter((w) => !isSpec(w));
  const matched = plain.filter((w) => found(w, group.words)).length;
  const coverage = plain.length ? matched / plain.length : item.strengths.length ? 1 : 0;
  const sizeMatch = Boolean(group.size && item.sizes.some((s) => sameSize(s, group.size!)));
  const said = new Set(lineWords);
  const missingVariant = [...group.words].some((w) => (VARIANTS.has(w) || isSpec(w)) && !said.has(w));
  return { group, coverage, matched, sizeMatch, missingVariant };
}

const better = (a: Scored, b: Scored) =>
  b.coverage - a.coverage || Number(b.sizeMatch) - Number(a.sizeMatch) || Number(a.missingVariant) - Number(b.missingVariant) || b.matched - a.matched;

/** Strictly ahead on what decides a match, so a tie isn't settled by catalogue order. */
const ahead = (a: Scored, b: Scored | undefined) => !b || better(a, b) < 0;

export function matchLine(item: Item, index: Index): LineMatch {
  let line = item.words;

  // Brands named exactly, as the catalogue writes them or with umlauts written out. A line can't name two, so the
  // longest brand wins ("Dulux Trade" over "Dulux").
  const exact = [...index.byBrand.keys(), ...index.aliases.keys()]
    .map((k) => k.split(" "))
    .filter((b) => brandOnLine(b, line))
    .sort((a, b) => b.join(" ").length - a.join(" ").length);

  if (!exact.length) {
    if (index.cheaper.some((b) => brandOnLine(b, line.slice(0, b.length + 1)))) return { status: "own" };
    return fuzzyMatch(item, index);
  }

  const written = exact[0];
  const brandWords = (index.aliases.get(written.join(" ")) ?? written.join(" ")).split(" ");
  if (written.join(" ") !== brandWords.join(" ")) {
    // Read the brand as the catalogue writes it, so its words aren't counted as the product's.
    line = [...brandWords, ...line.filter((w) => !written.includes(w) && w !== written.join(""))];
    item = { ...item, words: line };
  }
  const scored = index.byBrand
    .get(brandWords.join(" "))!
    .map((g) => score(item, g, brandWords))
    .filter((s): s is Scored => s !== null)
    .sort(better);
  const [top, next] = scored;
  if (!top) return { status: "none" };
  const pick = { slug: top.group.slugs[0], others: top.group.slugs.length - 1 };

  const said = describing(line).filter((w) => !brandWords.includes(w) && !isSpec(w)).length;
  if (said === 0) return brandOnly(item, scored, true);
  // The line's words are the product's, it wins outright, and nothing the product is (a variant) went unsaid unless the pack size says it.
  const confident = ahead(top, next) && (!top.missingVariant || top.sizeMatch) && top.coverage >= 0.75 && top.matched >= 1;
  if (confident) return { status: "swap", ...pick };
  if (top.coverage >= 0.5) return { status: "maybe", ...pick };
  return { status: "none" };
}

/** Most products a "which one" question lists. */
export const CHOOSE_MAX = 6;

/**
 * A line with nothing but the brand, and perhaps a strength or a pack size. `scored` holds the brand's products that
 * fit it: a product of another strength, or with a variant or form the line names and it lacks, never got this far.
 * A pack size narrows them when some match it. One product left is the match (a swap unless it is a variant the line
 * didn't say, such as Junior or Max, and the pack size doesn't say it either); several are a question for the shopper.
 */
function brandOnly(item: Item, scored: Scored[], canSwap: boolean): LineMatch {
  const sized = item.sizes.length ? scored.filter((s) => s.sizeMatch) : [];
  const fits = sized.length ? sized : scored;
  if (!fits.length) return { status: "none" };
  if (fits.length === 1) {
    const [only] = fits;
    const pick = { slug: only.group.slugs[0], others: only.group.slugs.length - 1 };
    // A product with a variant the line didn't say (Junior, Max, Infant) stays a question unless the pack size says it.
    const sure = canSwap && (!only.missingVariant || only.sizeMatch);
    return { status: sure ? "swap" : "maybe", ...pick };
  }
  return { status: "choose", slugs: fits.slice(0, CHOOSE_MAX).map((s) => s.group.slugs[0]) };
}

/** Classic Levenshtein distance, for checking what the fuzzy search proposes. */
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/** A brand spelt nearly right ("CLARITIN" for Clarityn, "NUROFN"): at most a "did you mean", and only if the rest agrees. */
function fuzzyMatch(item: Item, index: Index): LineMatch {
  const lead = describing(item.words).slice(0, 2);
  const tries = [lead.join(""), ...lead].filter((w) => w.length >= 5);
  for (const t of tries) {
    for (const hit of index.fuzzy.search(t, { limit: 3 })) {
      const name = hit.item.name;
      if (name.length < 5 || name[0] !== t[0] || distance(t, name) > (name.length >= 8 ? 2 : 1)) continue;
      const brandWords = hit.item.key.split(" ");
      // Read the line as if the brand were spelt right, so its own words aren't counted against the product.
      const fixed: Item = { ...item, words: item.words.flatMap((w) => (w === t ? brandWords : w)) };
      if (lead.length === 2 && t === lead.join("")) fixed.words = [...brandWords, ...item.words.filter((w) => !lead.includes(w))];
      const scored = index.byBrand
        .get(hit.item.key)!
        .map((g) => score(fixed, g, brandWords))
        .filter((s): s is Scored => s !== null)
        .sort(better);
      const top = scored[0];
      if (!top) continue;
      const said = describing(fixed.words).filter((w) => !brandWords.includes(w) && !isSpec(w)).length;
      // A brand spelt nearly right and nothing else to go on is too little, even for a question.
      if (said === 0 && (item.strengths.length || scored.some((s) => s.sizeMatch))) return brandOnly(fixed, scored, false);
      if (said > 0 && top.coverage >= 0.5) {
        return { status: "maybe", slug: top.group.slugs[0], others: top.group.slugs.length - 1 };
      }
    }
  }
  return { status: "none" };
}

// ---------------------------------------------------------------------------------------------------------------------
// A whole paste

export type ReceiptLine = { index: number; text: string; query: string } & LineMatch;

export type ReceiptMatch = {
  lines: ReceiptLine[];
  /** Lines that weren't products: totals, payments, loyalty, dates. */
  noise: number;
};

/**
 * Every product line with its match. A product named twice is shown once: the second line is dropped from the swaps
 * and suggestions, so the yearly total never counts one pack twice.
 */
export function matchReceipt(parsed: readonly ParsedLine[], index: Index): ReceiptMatch {
  const seen = new Set<string>();
  const lines: ReceiptLine[] = [];
  let noise = 0;
  for (const p of parsed) {
    if (p.kind === "noise") {
      noise++;
      continue;
    }
    const m = matchLine(p, index);
    if ((m.status === "swap" || m.status === "maybe") && seen.has(m.slug)) continue;
    if (m.status === "swap" || m.status === "maybe") seen.add(m.slug);
    // The same question twice ("NUROFEN" on two lines) is asked once. Which one a shopper picks can still be a swap
    // another line found; the page counts each swap once whichever way it came.
    if (m.status === "choose") {
      const key = `choose:${m.slugs.join(" ")}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    lines.push({ index: p.index, text: p.text, query: p.query, ...m });
  }
  return { lines, noise };
}
