/**
 * Checks a German record against its English one: every field the page shows is there (so a page is never half German),
 * the lists line up one to one, and each German text carries exactly the numbers its English carries. A translation that
 * drops a strength, changes a price or loses a pack size fails the catalogue build.
 *
 * Pure, so the tests use it too.
 */
import { splitSentences } from "../compare";
import type { BundleDe, ClaimDe, PairDe, PresetDe, ShelfLifeDe } from "../schema";

type EnglishBundle = {
  title: string;
  summary: string;
  evidence: string;
  differences: string;
  bundle: { name: string; items: { name: string }[]; extras: string[] };
};

/** What's wrong with one kit's German text: the lists line up with the English and every field keeps its numbers. */
export function bundleDeProblems(en: EnglishBundle, de: BundleDe): string[] {
  const problems: string[] = [];
  const same = (field: string, english: string, german: string) => {
    if (!english !== !german) problems.push(`${field}: empty on one side only`);
    const p = numberProblem(english, german);
    if (p) problems.push(`${field}: numbers differ from the English (${p})`);
  };
  same("title", en.title, de.title);
  same("name", en.bundle.name, de.name);
  same("summary", en.summary, de.summary);
  same("evidence", en.evidence, de.evidence);
  same("differences", en.differences, de.differences);
  const lists: [string, readonly string[], readonly string[]][] = [
    ["items", en.bundle.items.map((i) => i.name), de.items],
    ["extras", en.bundle.extras, de.extras],
  ];
  for (const [field, english, german] of lists) {
    if (english.length !== german.length) problems.push(`${field}: ${german.length} German entries for ${english.length} English ones`);
    else english.forEach((e, i) => same(`${field}[${i}]`, e, german[i]));
  }
  return problems;
}

type EnglishPreset = { title: string; audience: string; blurb: string; research: string; items: { pair: string; note?: string }[] };

/** What's wrong with one basket's German text: a German note for exactly the lines with an English one, numbers kept. */
export function presetDeProblems(en: EnglishPreset, de: PresetDe): string[] {
  const problems: string[] = [];
  for (const field of ["title", "audience", "blurb", "research"] as const) {
    const p = numberProblem(en[field], de[field]);
    if (p) problems.push(`${field}: numbers differ from the English (${p})`);
  }
  const notes = new Map(en.items.filter((i) => i.note).map((i) => [i.pair, i.note!]));
  for (const [pair, note] of notes) {
    if (!de.notes[pair]) problems.push(`notes.${pair}: the English line has a note, the German has none`);
    else {
      const p = numberProblem(note, de.notes[pair]);
      if (p) problems.push(`notes.${pair}: numbers differ from the English (${p})`);
    }
  }
  for (const pair of Object.keys(de.notes)) if (!notes.has(pair)) problems.push(`notes.${pair}: no English note on this line`);
  return problems;
}

/**
 * The numbers in a text, written one way: "1,234.5" (English) and "1.234,5" (German) both read "1234.5", "88%" and
 * "88 %" both "88". Each number keeps its digits as written, so 0.10 and 0.1 differ, as they would on a pack.
 */
export function numbersIn(text: string, lang: "en" | "de"): string[] {
  const out: string[] = [];
  for (const [token] of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    if (lang === "en") {
      out.push(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(token) ? token.replace(/,/g, "") : token.replace(/,/g, "."));
    } else {
      out.push(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(token) ? token.replace(/\./g, "").replace(",", ".") : token.replace(/,/g, "."));
    }
  }
  return out.sort();
}

/** Null when both texts carry the same numbers, else what differs. */
export function numberProblem(english: string, german: string): string | null {
  const en = numbersIn(english, "en");
  const de = numbersIn(german, "de");
  if (en.join("|") === de.join("|")) return null;
  const missing = en.filter((n) => !de.includes(n));
  const extra = de.filter((n) => !en.includes(n));
  const parts = [missing.length ? `missing ${missing.join(", ")}` : "", extra.length ? `added ${extra.join(", ")}` : ""].filter(Boolean);
  return parts.join(", ") || `the same numbers a different number of times (${en.join(", ")} against ${de.join(", ")})`;
}

type EnglishPair = {
  summary: string;
  evidence: string;
  differences: string;
  why?: string;
  aspects: { aspect: string; brand: string; alternative: string }[];
  brand: { key_ingredients: { name: string; amount: string }[] };
  alternative: { key_ingredients: { name: string; amount: string }[] };
};

/** What's wrong with one swap's German text, as lines for the build's error list. */
export function pairDeProblems(en: EnglishPair, de: PairDe): string[] {
  const problems: string[] = [];
  const same = (field: string, english: string, german: string) => {
    const p = numberProblem(english, german);
    if (p) problems.push(`${field}: numbers differ from the English (${p})`);
  };
  same("summary", en.summary, de.summary);
  same("evidence", en.evidence, de.evidence);
  if (!!en.why !== !!de.why) problems.push(en.why ? "why: the English has one, the German doesn't" : "why: the English has none");
  if (en.why && de.why) same("why", en.why, de.why);

  const sentences = splitSentences(en.differences);
  if (sentences.length !== de.differences.length) {
    problems.push(`differences: ${de.differences.length} German sentences for ${sentences.length} English ones (they line up one to one)`);
  } else {
    sentences.forEach((s, i) => same(`differences[${i}]`, s, de.differences[i]));
  }

  if (en.aspects.length !== de.aspects.length) {
    problems.push(`aspects: ${de.aspects.length} German rows for ${en.aspects.length} English ones`);
  } else {
    en.aspects.forEach((a, i) => {
      same(`aspects[${i}].aspect`, a.aspect, de.aspects[i].aspect);
      same(`aspects[${i}].brand`, a.brand, de.aspects[i].brand);
      same(`aspects[${i}].alternative`, a.alternative, de.aspects[i].alternative);
    });
  }

  for (const side of ["brand", "alternative"] as const) {
    const english = en[side].key_ingredients;
    const german = de.ingredients?.[side] ?? [];
    if (english.length !== german.length) {
      problems.push(`ingredients.${side}: ${german.length} German rows for ${english.length} English ones`);
      continue;
    }
    english.forEach((k, i) => {
      same(`ingredients.${side}[${i}].name`, k.name, german[i].name);
      same(`ingredients.${side}[${i}].amount`, k.amount, german[i].amount);
      if (!k.amount !== !german[i].amount) problems.push(`ingredients.${side}[${i}].amount: empty on one side only`);
    });
  }
  return problems;
}

export function claimDeProblems(en: { title: string; finding: string; caveat: string }, de: ClaimDe): string[] {
  const problems: string[] = [];
  for (const field of ["title", "finding", "caveat"] as const) {
    if (!en[field] !== !de[field]) problems.push(`${field}: empty on one side only`);
    const p = numberProblem(en[field], de[field]);
    if (p) problems.push(`${field}: numbers differ from the English (${p})`);
  }
  return problems;
}

export function shelfLifeDeProblems(
  en: { label: string; unopened: string; opened: string; storage: string; note: string },
  de: ShelfLifeDe,
): string[] {
  const problems: string[] = [];
  for (const field of ["label", "unopened", "opened", "storage", "note"] as const) {
    if (!en[field] !== !de[field]) problems.push(`${field}: empty on one side only`);
    const p = numberProblem(en[field], de[field]);
    if (p) problems.push(`${field}: numbers differ from the English (${p})`);
  }
  return problems;
}
