/**
 * English pages keep their visible text, word for word, through the German work: a US swap page and a UK kit page
 * against their text saved from main before it (scripts/tests/fixtures/i18n/, made with i18n-page-text.ts).
 *
 * Reads the prerendered HTML of the last `npm run build`, so it skips without one. To refresh a fixture after an
 * intended English change: npx tsx scripts/tests/i18n-page-text.ts .next/server/app/country/<cc>/<section>/<slug>.html
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pageText } from "./i18n-page-text";

const ROOT = join(import.meta.dirname, "..", "..");
const PAGES = [
  { fixture: "us-compare-claritin-vs-equate-loratadine-10mg.txt", html: "country/us/compare/claritin-vs-equate-loratadine-10mg.html" },
  {
    fixture: "uk-bundle-la-roche-posay-effaclar-breakout-fighting-set-vs-cerave-foaming-cleanser-the-ordinary-gb.txt",
    html: "country/uk/bundle/la-roche-posay-effaclar-breakout-fighting-set-vs-cerave-foaming-cleanser-the-ordinary-gb.html",
  },
  // The pages the German kit, basket and tool work touched, saved from the branch before it.
  {
    fixture: "us-bundle-advil-20ct-300ct-value-bundle-vs-up-and-up-ibuprofen-200mg.txt",
    html: "country/us/bundle/advil-20ct-300ct-value-bundle-vs-up-and-up-ibuprofen-200mg.html",
  },
  { fixture: "us-basket-babys-first-year-us.txt", html: "country/us/basket/babys-first-year-us.html" },
  { fixture: "check.txt", html: "check.html" },
  { fixture: "check-list.txt", html: "check/list.html" },
  { fixture: "my-list.txt", html: "my-list.html" },
  { fixture: "search.txt", html: "search.html" },
];

for (const page of PAGES) {
  const html = join(ROOT, ".next/server/app", page.html);
  test(`the English text of ${page.html} is unchanged`, { skip: existsSync(html) ? false : "no build" }, () => {
    const want = readFileSync(join(ROOT, "scripts/tests/fixtures/i18n", page.fixture), "utf8").trimEnd();
    const got = pageText(readFileSync(html, "utf8"));
    if (got !== want) {
      const a = want.split("\n");
      const b = got.split("\n");
      const at = a.findIndex((line, i) => line !== b[i]);
      assert.fail(`first difference at line ${at + 1}:\n  main: ${a[at]}\n  now:  ${b[at]}`);
    }
  });
}
