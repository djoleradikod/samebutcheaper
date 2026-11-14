/**
 * The German dictionary against the English one, key by key: nothing missing or empty, nothing left in English (real
 * cognates are allowed by name), the same {placeholders}, and every argument the English text shows shown by the
 * German too. Then every German text, the dictionaries and the records alike, against the glossary's words to avoid
 * and German typography (no-break space before %, German quotes, one ellipsis character).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { en } from "../../src/lib/i18n/en";
import { de } from "../../src/lib/i18n/de";
import glossary from "../../data/i18n/de/glossary.json";
import * as dsModule from "../../src/lib/i18n/de/datenschutz";
import { allParagraphs } from "../../src/lib/privacy-facts";
import * as trustPages from "../../src/lib/i18n/de/trust-pages";
import { retention } from "../../src/lib/maintenance";

const ROOT = join(import.meta.dirname, "..", "..");

type Leaf = { key: string; en: unknown; de: unknown };

function leaves(a: unknown, b: unknown, at = ""): Leaf[] {
  if (a && typeof a === "object" && !Array.isArray(a)) {
    return Object.keys(a as object).flatMap((k) => leaves((a as Record<string, unknown>)[k], (b as Record<string, unknown> | undefined)?.[k], at ? `${at}.${k}` : k));
  }
  return [{ key: at, en: a, de: b }];
}

const ALL = leaves(en, de);

/** German words that are the English ones too. Each is a real German word, not a leftover. */
const COGNATES = new Set([
  "Details",
  "Link",
  "Baby",
  "Beauty",
  "Auto",
  "Filter",
  "Set",
  "Impressum",
  "[Test] ",
  "(optional)",
  "Pantry",
]);

/**
 * Keys whose German leaves out an argument the English shows, on purpose: German needs no count to agree with
 * ("deshalb fehlt er in der Summe" whatever the number), or names the thing another way.
 */
const DROPS_ARG = new Set([
  "pageCheckout.someUnchecked", // the count only picks "it" or "them" in English
  "picker.name", // the German name replaces the English one
  "kitPage.sticky", // "1 Händler" is written out
]);

/** Functions whose answer is only their arguments and words both languages share ("Barcode 701", "701: 702."). */
const SAME_ANSWER = new Set(["faq.actives", "faq.claimSentence", "calculator.number", "pageKitWhere.storeIn", "report.barcode", "seo.leadNoPrice", "terms.verdict"]);

const placeholders = (s: string) => [...s.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();

test("every German string is there, is not empty, and keeps the English placeholders", () => {
  const problems: string[] = [];
  for (const { key, en: e, de: d } of ALL) {
    if (typeof e !== "string") continue;
    if (typeof d !== "string") {
      problems.push(`${key}: missing`);
      continue;
    }
    if (e && !d) problems.push(`${key}: empty`);
    if (e && d === e && !COGNATES.has(e)) problems.push(`${key}: same as the English ("${e}")`);
    const pe = placeholders(e);
    const pd = placeholders(d);
    if (pe.join() !== pd.join()) problems.push(`${key}: placeholders ${pe.join()} in English, ${pd.join()} in German`);
  }
  assert.deepEqual(problems, []);
});

/** Arguments that print as themselves in both languages: numbers under 1000 (no thousands separator) work as strings too. */
const ARGS = [701, 702, 703, 704, 705, 706, 707];

function call(fn: unknown, n: number): string | null {
  try {
    const out = (fn as (...a: unknown[]) => unknown)(...ARGS.slice(0, n));
    return typeof out === "string" ? out : null;
  } catch {
    return null;
  }
}

test("every German function answers, keeps the placeholders, and shows each argument the English shows", () => {
  const problems: string[] = [];
  let checked = 0;
  for (const { key, en: e, de: d } of ALL) {
    if (typeof e !== "function") continue;
    if (typeof d !== "function") {
      problems.push(`${key}: missing`);
      continue;
    }
    const n = Math.max(e.length, (d as (...a: unknown[]) => unknown).length);
    const eo = call(e, n);
    const dout = call(d, n);
    if (eo === null || dout === null) continue;
    checked++;
    if (eo && !dout) problems.push(`${key}: empty`);
    if (eo && eo === dout && !COGNATES.has(eo) && !SAME_ANSWER.has(key)) problems.push(`${key}: same as the English ("${eo}")`);
    if (placeholders(eo).join() !== placeholders(dout).join()) problems.push(`${key}: placeholders differ`);
    if (DROPS_ARG.has(key)) continue;
    for (const a of ARGS.slice(0, n)) {
      if (eo.includes(String(a)) && !dout.includes(String(a))) problems.push(`${key}: the English shows argument ${a - 700}, the German doesn't ("${dout}")`);
    }
  }
  assert.ok(checked > 150, `only ${checked} functions could be called`);
  assert.deepEqual(problems, []);
});

/** Every German text a visitor can read: the dictionaries' strings and functions' answers, and the records' string values. */
function germanTexts(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const { key, de: d } of ALL) {
    if (typeof d === "string") out.push({ where: key, text: d });
    if (typeof d === "function") {
      const s = call(d, (d as (...a: unknown[]) => unknown).length);
      if (s) out.push({ where: key, text: s });
    }
  }
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".json") ? [join(dir, e.name)] : []));
  const values = (v: unknown, where: string): void => {
    if (typeof v === "string") out.push({ where, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => values(x, `${where}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) values(x, `${where}.${k}`);
  };
  for (const f of files(join(ROOT, "data/i18n/de"))) {
    if (f.endsWith("glossary.json")) continue;
    values(JSON.parse(readFileSync(f, "utf8")), f.slice(ROOT.length + 1));
  }
  for (const photos of [true, false]) {
    for (const consentStores of [[], ["amazon"], ["amazon", "awin"]]) {
      const facts = { keep: retention({}), photos, backupDays: 14, notice: null, consentStores };
      allParagraphs(dsModule.policy, facts).forEach((text, i) => out.push({ where: `datenschutz[${i}]`, text: text.replace(/`[^`]+`/g, "") }));
    }
  }
  // The German trust pages (/de/disclosure, /de/about, /de/how-we-verify), outside the dictionary.
  for (const [name, section] of Object.entries(trustPages)) {
    const walk = (v: unknown, where: string): void => {
      if (typeof v === "function") walk(call(v, v.length), where);
      else values(v, where);
    };
    for (const [k, v] of Object.entries(section)) walk(v, `${name}.${k}`);
  }
  const offline = readFileSync(join(ROOT, "public/offline-de.html"), "utf8");
  out.push({ where: "public/offline-de.html", text: offline.slice(offline.indexOf("<body")).replace(/<[^>]+>/g, " ") });
  return out;
}

const TEXTS = germanTexts();

test("German text uses the glossary's words, not the ones it says to avoid", () => {
  const terms = (glossary as { terms?: Record<string, { de: string; avoid: string[] }> }).terms ?? {};
  assert.ok(Object.keys(terms).length >= 20, "the glossary names the site's terms");
  const avoid = Object.entries(terms).flatMap(([english, t]) => t.avoid.map((word) => ({ english, use: t.de, word })));
  const problems: string[] = [];
  for (const { where, text: raw } of TEXTS) {
    const text = raw.replace(/Shop[ -]Apotheke/g, "");
    for (const { english, use, word } of avoid) {
      // Whole words only, case as written; a brand that has the word in its name ("Shop Apotheke") is not a term.
      const re = new RegExp(`(?<![\\p{L}\\d-])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "u");
      if (re.test(text)) problems.push(`${where}: "${word}" (for "${english}" the glossary says "${use}")`);
    }
  }
  assert.deepEqual(problems, []);
});

test("German typography: a no-break space before %, German quotes, the ellipsis character", () => {
  const problems: string[] = [];
  for (const { where, text } of TEXTS) {
    if (/\d[ ]?%/.test(text)) problems.push(`${where}: "%" needs a no-break space before it`);
    if (/"[^"]*"/.test(text)) problems.push(`${where}: straight quotes, use „…“`);
    if (/\.\.\./.test(text)) problems.push(`${where}: "..." instead of "…"`);
    if (/[“”]/.test(text.replace(/„[^„“]*“/g, ""))) problems.push(`${where}: an English quote mark`);
  }
  assert.deepEqual(problems, []);
});

test("the German privacy policy names who is responsible only from the LEGAL_ settings, and says what the photo switch does", () => {
  const ds = dsModule.policy;
  assert.match(ds.controller(null).join(" "), /^\[Noch nicht eingetragen: .*LEGAL_NAME, LEGAL_ADDRESS und LEGAL_EMAIL/);
  const notice = { name: "Erika Muster", address: ["Musterstraße 1", "12345 Musterstadt"], email: "kontakt@example.de", phone: null, vatId: null, responsible: null };
  assert.deepEqual(ds.controller(notice), ["Erika Muster", "Musterstraße 1", "12345 Musterstadt", "E-Mail: kontakt@example.de"]);
  const facts = { keep: retention({}), backupDays: 14, notice: null, consentStores: [] };
  const on = ds.collected({ ...facts, photos: true }).find((i) => i.lead === "Fotos.")!.text;
  const off = ds.collected({ ...facts, photos: false }).find((i) => i.lead === "Fotos.")!.text;
  assert.match(on, /Anthropic/);
  assert.match(on, /Kassenbons/, "receipt photos go out too");
  assert.doesNotMatch(off, /Anthropic/);
});
