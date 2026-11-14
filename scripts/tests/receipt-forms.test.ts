/**
 * Form words on list and receipt lines ("SAFT", "Tabletten", "spray", "syrup") narrow a brand's products in the list
 * check (src/lib/receipt/forms.ts, match.ts), against the real catalogue. Lines without a brand stay as strict as before.
 *
 *   npm run catalog && npx tsx --test scripts/tests/receipt-forms.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { forCountry, localFor } from "../../src/lib/localize";
import { formOf, formsIn } from "../../src/lib/receipt/forms";
import { buildIndex, matchLine, toCandidate, type Index, type LineMatch } from "../../src/lib/receipt/match";
import { parseReceipt, words, type ParsedLine } from "../../src/lib/receipt/parse";
import type { Catalog } from "../../src/lib/types";

const { pairs } = catalog as unknown as Catalog;
const product = new Map(pairs.map((p) => [p.slug, p.brand.product]));
const indexes = new Map<string, Index>();
function match(country: string, line: string): LineMatch {
  let index = indexes.get(country);
  if (!index) indexes.set(country, (index = buildIndex(forCountry(pairs, localFor(country)).map(toCandidate))));
  const parsed = parseReceipt(line)[0];
  assert.equal(parsed?.kind, "item", line);
  return matchLine(parsed as Extract<ParsedLine, { kind: "item" }>, index);
}
const slugsOf = (m: LineMatch) => (m.status === "choose" ? m.slugs : "slug" in m ? [m.slug] : []);

test("form words in German and English, whole and at the end of a compound", () => {
  const form = (w: string) => formOf(words(w)[0]);
  for (const w of ["Saft", "SIRUP", "syrup", "Suspension", "Lösung", "LOESUNG", "liquid", "Hustensaft", "Fiebersaft"]) assert.equal(form(w), "liquid", w);
  for (const w of ["Tabletten", "TABS", "tablets", "Filmtabletten", "caplets", "Dragees"]) assert.equal(form(w), "tablet", w);
  for (const w of ["Kapseln", "capsules", "Weichkapseln", "softgels"]) assert.equal(form(w), "capsule", w);
  for (const w of ["Tropfen", "drops", "Nasentropfen"]) assert.equal(form(w), "drop", w);
  for (const w of ["Salbe", "ointment", "Wundsalbe"]) assert.equal(form(w), "ointment", w);
  for (const w of ["Creme", "cream", "Hautcreme"]) assert.equal(form(w), "cream", w);
  for (const w of ["Spray", "Nasenspray", "Dosierspray"]) assert.equal(form(w), "spray", w);
  for (const w of ["Zäpfchen", "ZAEPFCHEN", "suppositories"]) assert.equal(form(w), "suppository", w);
  for (const w of ["Gel", "Schmerzgel"]) assert.equal(form(w), "gel", w);
  assert.equal(form("Lutschtabletten"), "lozenge");
  assert.equal(form("Brausetabletten"), "effervescent");
  assert.equal(form("Kautabletten"), "chewable");
  // Not forms: words that only end like one.
  for (const w of ["Geflügel", "Nurofen", "Saftig", "spraying"]) assert.equal(form(w), null, w);
  // "Liquid capsules" are capsules.
  assert.deepEqual([...formsIn(words("liquid capsules"))], ["capsule"]);
});

type Case = [country: string, line: string, want: LineMatch["status"], product?: RegExp];

const CASES: Case[] = [
  // The line from the report: the brand and a form narrow Nurofen to the Junior syrup, and the 100 ml pack makes it sure.
  ["DE", "NUROFEN SAFT 100ML", "swap", /^NUROFEN Junior/],
  // Without the pack size it is the Junior syrup still, but Junior went unsaid: a question.
  ["DE", "NUROFEN SAFT", "maybe", /^NUROFEN Junior/],
  ["DE", "Nurofen Fiebersaft", "maybe", /^NUROFEN Junior/],
  ["DE", "Nurofen Tabletten", "swap", /^Nurofen Ibuprofen 400 mg/],
  ["DE", "ben-u-ron Tabletten", "choose", /^ben-u-ron .*Tabletten/],
  ["DE", "ben-u-ron Zäpfchen", "swap", /Suppositorien/],
  ["DE", "BEN-U-RON SAFT", "maybe", /^ben-u-ron Saft/],
  ["DE", "OTRIVEN SPRAY", "choose", /spray/i],
  ["DE", "VOLTAREN GEL", "maybe", /^Voltaren Schmerzgel/],
  ["DE", "PERSIL GEL", "choose", /Kraft-Gel/],
  // A form the brand's products don't come in: nothing on file, never the nearest product.
  ["DE", "Nurofen Zäpfchen", "none"],
  ["DE", "Nurofen Kapseln", "none"],
  ["DE", "Fenistil Tropfen", "none"],
  ["GB", "NUROFEN SYRUP", "maybe", /^Nurofen For Children/],
  ["GB", "NUROFEN FOR CHILDREN SYRUP", "swap", /^Nurofen For Children/],
  ["GB", "NUROFEN CAPSULES", "swap", /Capsules/],
  ["GB", "NUROFEN LIQUID CAPSULES", "swap", /Capsules/],
  ["GB", "NUROFEN TABLETS", "swap", /Tablets/],
  ["GB", "GAVISCON TABLETS", "none"],
  ["GB", "LEMSIP CAPSULES", "choose", /Capsules/],
  ["US", "TYLENOL LIQUID", "maybe", /^Children's Tylenol/],
  ["US", "VOLTAREN GEL", "swap", /^Voltaren Arthritis Pain Gel/],
  ["US", "TIDE POWDER", "none"],
  // No brand on the line: a form word adds nothing, so these stay unmatched.
  ["DE", "IBUPROFEN SAFT", "none"],
  ["DE", "HUSTENSAFT", "none"],
  ["DE", "NASENSPRAY 10ML", "none"],
  ["GB", "COUGH SYRUP", "none"],
  // A brand spelt nearly right with only a form: too little even for a question.
  ["DE", "NUROFN SAFT", "none"],
];

for (const [country, line, want, re] of CASES) {
  test(`${country}: ${line} -> ${want}`, () => {
    const got = match(country, line);
    assert.equal(got.status, want, JSON.stringify(got));
    if (re) for (const slug of slugsOf(got)) assert.match(product.get(slug) ?? "", re, slug);
  });
}
