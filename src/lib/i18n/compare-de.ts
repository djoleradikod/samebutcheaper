/**
 * The same-or-different table and the differences on a German page.
 *
 * compare.ts reads the English record (its rules know English sentences: Which? panels, German test grades written in
 * English, which sentences are caveats), so it always runs on the English. This module then shows each piece it found
 * in German: researched rows, label rows and difference sentences come from the record's German text, which lines up
 * one to one with the English (record-check.ts makes sure of that); the table's own words come from the dictionary.
 * Nothing here translates by itself: what has no German entry stays as the record wrote it.
 */
import { RESTATES_PACK, splitSentences, type Comparison, type CompareRow } from "../compare";
import type { Pair, Rating } from "../types";
import { en } from "./en";
import { de } from "./de";
import { germanFigures, monthNameDe } from "./format";
import type { PairDe } from "../schema";

const W = en.rows.words;
const D = de.rows.words;
const KEY_OF = new Map(Object.entries(W).map(([key, text]) => [text, key as keyof typeof W]));

/** The German for one of the table's own English words, or null. */
export function tableWord(text: string): string | null {
  const key = KEY_OF.get(text);
  return key ? D[key] : null;
}

/** English month names and "N people" in a test's detail line. */
function detailDe(detail: string | undefined) {
  if (!detail) return detail;
  return detail
    .split(". ")
    .map((part) => tableWord(part) ?? part)
    .join(". ")
    .replace(/\b([A-Z][a-z]+)( \d{4})\b/g, (all, month: string, year: string) => {
      const name = monthNameDe(month);
      return name ? `${name}${year}` : all;
    })
    .replace(/, (\d+) people$/, ", $1 Personen");
}

/** "Very good (1.2)", "Good", "1.5" or "88%" as German test results read. */
function resultDe(value: string) {
  const m = value.match(/^(very good|good|satisfactory|sufficient|poor)(?: \((\d\.\d)\))?$/i);
  if (m) {
    const word = de.rows.grades[m[1].toLowerCase()];
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    return m[2] ? `${cap} (${germanFigures(m[2])})` : cap;
  }
  return germanFigures(value);
}

/** A rating as it reads in German: "4,4 von 5", "Note 1,5", "Öko-Test: sehr gut". */
export function ratingLabelDe(r: Pick<Rating, "score" | "scale" | "publisher" | "count" | "wording">) {
  const word = (w: string) => de.rows.grades[w.toLowerCase()] ?? w;
  if (r.wording) return r.publisher ? `${r.publisher}: ${word(r.wording)}` : word(r.wording);
  const one = (n: number) => germanFigures(n.toFixed(1).replace(/\.0$/, ""));
  const score =
    r.scale === "stars-5"
      ? de.rows.rating.outOf(one(r.score), 5)
      : r.scale === "out-of-10"
        ? de.rows.rating.outOf(one(r.score), 10)
        : r.scale === "percent"
          ? `${Math.round(r.score)} %`
          : de.rows.rating.grade(germanFigures(r.score.toFixed(1)));
  if (r.publisher) return `${r.publisher} ${score}`;
  return r.count ? de.rows.rating.fromRatings(score, r.count.toLocaleString("de-DE")) : score;
}

type Context = { pair: Pair; text: PairDe | null };

/** The German for an ingredient name or amount, from the record's German label rows. */
function labelMaps(ctx: Context) {
  const names = new Map<string, string>();
  const amounts = { brand: new Map<string, string>(), alternative: new Map<string, string>() };
  if (!ctx.text?.ingredients) return { names, amounts };
  for (const side of ["brand", "alternative"] as const) {
    ctx.pair[side].key_ingredients.forEach((k, i) => {
      const g = ctx.text!.ingredients![side][i];
      if (!g) return;
      if (!names.has(k.name)) names.set(k.name, g.name);
      if (k.amount && !amounts[side].has(k.amount)) amounts[side].set(k.amount, g.amount);
    });
  }
  return { names, amounts };
}

function ratingValue(value: string, rating: Rating | null) {
  return tableWord(value) ?? (rating && value === rating.label ? ratingLabelDe(rating) : value);
}

function rowDe(r: CompareRow, ctx: Context, labels: ReturnType<typeof labelMaps>): CompareRow {
  const { pair, text } = ctx;
  const researched = pair.aspects.findIndex((a) => a.aspect === r.aspect);
  if (researched >= 0) {
    const g = text?.aspects[researched];
    const row = g ? { ...r, aspect: g.aspect, brand: g.brand, alternative: g.alternative } : r;
    return { ...row, detail: detailDe(row.detail), verdictLabel: row.verdictLabel && (tableWord(row.verdictLabel) ?? row.verdictLabel) };
  }
  switch (r.kind) {
    case "test":
      return { ...r, brand: resultDe(r.brand), alternative: resultDe(r.alternative), detail: detailDe(r.detail) };
    case "inactive_check": {
      const words = de.rows.inactive[pair.category] ?? de.rows.inactive.other;
      return {
        ...r,
        aspect: tableWord(r.aspect) ?? r.aspect,
        brand: de.rows.ownWords(words),
        alternative: pair.category === "otc-medicine" ? de.rows.canDifferMedicine : (tableWord(r.alternative) ?? r.alternative),
      };
    }
    case "rating": {
      const publisher = pair.alternative.rating?.publisher;
      const aspect = publisher && r.aspect === en.rows.score(publisher) ? de.rows.score(publisher) : (tableWord(r.aspect) ?? r.aspect);
      return { ...r, aspect, brand: ratingValue(r.brand, pair.brand.rating), alternative: ratingValue(r.alternative, pair.alternative.rating) };
    }
    case "price":
      // readableRows writes it in the page's language already.
      return r;
    case "formula":
    case "maker":
    case "pack":
    case "licence":
      return { ...r, aspect: tableWord(r.aspect) ?? r.aspect, brand: tableWord(r.brand) ?? r.brand, alternative: tableWord(r.alternative) ?? r.alternative };
    default:
      // A label row: an ingredient or spec, its amount on each side.
      return {
        ...r,
        aspect: labels.names.get(r.aspect) ?? r.aspect,
        brand: tableWord(r.brand) ?? labels.amounts.brand.get(r.brand) ?? r.brand,
        alternative: tableWord(r.alternative) ?? labels.amounts.alternative.get(r.alternative) ?? r.alternative,
      };
  }
}

function nutritionDe(c: Comparison["nutrition"], pair: Pair): Comparison["nutrition"] {
  if (!c) return c;
  const higher = (label: string | undefined) => {
    if (!label) return label;
    const word = tableWord(label);
    if (word) return word;
    for (const name of [pair.brand.brand, pair.alternative.brand]) if (label === en.rows.higher(name)) return de.rows.higher(name);
    return label;
  };
  const caption = (() => {
    if (c.caption === W.ingredients) return D.ingredients;
    for (const [per, german] of Object.entries(de.rows.per100)) if (c.caption === en.rows.caption(per, true)) return de.rows.caption(german, true);
    return c.caption;
  })();
  return {
    ...c,
    caption,
    rows: c.rows.map((r) => ({
      ...r,
      aspect: tableWord(r.aspect) ?? r.aspect,
      // The ingredient lists are the community record's own words; the figures read the German way.
      brand: r.aspect === W.ingredients ? r.brand : germanFigures(r.brand),
      alternative: r.aspect === W.ingredients ? r.alternative : germanFigures(r.alternative),
      verdictLabel: higher(r.verdictLabel),
    })),
  };
}

/** The whole table in German. `text` is the record's German (germanText in record.ts), or null to keep its English words. */
export function comparisonDe(c: Comparison, pair: Pair, text: PairDe | null): Comparison {
  const ctx = { pair, text };
  const labels = labelMaps(ctx);
  return {
    label: tableWord(c.label) ?? c.label,
    ingredients: c.ingredients.map((r) => rowDe(r, ctx, labels)),
    rows: c.rows.map((r) => rowDe(r, ctx, labels)),
    nutrition: nutritionDe(c.nutrition, pair),
  };
}

/** How many researched rows the intro names before it counts the rest (as in compare.ts). */
const RESEARCHED_NAMED = 3;

/** The line under the table's heading, from the English table (what kinds of rows it has) and the German one (their names). */
export function onFileIntroDe(english: Comparison, german: Comparison) {
  const i = de.rows.intro;
  const has = (kind: string) => english.rows.some((r) => r.kind === kind);
  const tests = german.rows.filter((r) => r.kind === "test").map((r) => r.aspect);
  const researched = english.rows
    .map((r, n) => ({ r, german: german.rows[n] }))
    .filter(({ r }) => r.kind === "researched" && !RESTATES_PACK.test(r.aspect.trim()))
    // German nouns keep their capitals, so a row's name goes in as written.
    .map(({ german: g }) => g.aspect);
  const others = researched.length - RESEARCHED_NAMED;
  const proof = [
    ...(tests.length === 1 ? [i.test(tests[0])] : tests.length > 1 ? [i.tests(tests.length)] : []),
    ...(english.nutrition ? [english.nutrition.rows.some((r) => r.aspect !== W.ingredients) ? i.nutrition : i.communityIngredients] : []),
    ...(english.ingredients.some((r) => r.verdict !== "unknown") ? [german.label] : []),
    ...(has("formula") ? [i.ingredientList] : []),
    ...(has("maker") ? [i.maker] : []),
    ...researched.slice(0, RESEARCHED_NAMED),
    ...(others > 0 ? [i.others(others)] : []),
    ...(has("licence") ? [i.licences] : []),
    ...(english.rows.some((r) => r.kind === "rating" && r.verdict !== "unknown") ? [i.ratings] : []),
  ];
  if (proof.length === 0) return english.ingredients.length ? i.nothingInside : i.onlyPack;
  return i.onFile(proof.join(", "));
}

/** The German for sentences of the English `differences`, one for one. Without German text they stay as written. */
export function differencesDe(sentences: string[], pair: Pair, text: PairDe | null) {
  if (!text) return sentences;
  const all = splitSentences(pair.differences);
  return sentences.map((s) => {
    const n = all.indexOf(s);
    return n >= 0 && text.differences[n] ? text.differences[n] : s;
  });
}
