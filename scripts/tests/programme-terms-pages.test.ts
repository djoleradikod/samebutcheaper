/**
 * The pages of the last `npm run build` follow each programme's terms (src/lib/programme-terms.ts): a swap whose price
 * is withheld says "See the price at <store>" and shows no saving, a swap with both prices withheld shows no money at
 * all, and a swap with a store whose terms bar "dupe" comparisons never uses the word. Which swaps those are comes from
 * the built catalogue, so the registry alone decides. Skips without a build.
 *
 *   npx tsx --test scripts/tests/programme-terms-pages.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { prefixFor } from "../../src/lib/country-url";
import { dupeWordAllowed } from "../../src/lib/programme-terms";
import type { Catalog, Pair } from "../../src/lib/types";
import { pageText } from "./i18n-page-text";

const ROOT = join(import.meta.dirname, "..", "..");
const catalog = catalogJson as unknown as Catalog;
const APP = join(ROOT, ".next/server/app");

/** The English page of a swap in its own country, when the build wrote one. */
function page(p: Pair) {
  const seg = prefixFor(p.market);
  if (!seg) return null;
  const file = join(APP, "country", seg, "compare", `${p.slug}.html`);
  return existsSync(file) ? pageText(readFileSync(file, "utf8")) : null;
}

const english = catalog.pairs.filter((p) => p.market === "US" || p.market === "GB");
const built = existsSync(join(APP, "country"));
const MONEY = /[$£€]\s?\d|\d\s?[$£€]/;

const anyWithheld = english.some((p) => p.withheld);
// Prices are withheld only in a build where a programme's rules are on: once joined, or with PROGRAMME_TERMS_ON.
const skipWithheld = !built ? "no build" : !anyWithheld ? "no programme's price rules are on in this build (PROGRAMME_TERMS_ON=all npm run build)" : false;

test("a withheld swap page sends the shopper to the store for the price and shows no saving", { skip: skipWithheld }, () => {
  const withheld = english.filter((p) => p.withheld);
  let read = 0;
  for (const p of withheld) {
    const text = page(p);
    if (!text) continue;
    read++;
    assert.match(text, /See the price at /, p.slug);
    assert.match(text, /Last checked by us: /, p.slug);
    assert.doesNotMatch(text, /\b0% cheaper|−0%|Save [$£€]0\b|cheaper by [$£€]?0\b/, p.slug);
    // Outside the evidence (which may quote a magazine's dated test price: a source, not a price of ours), the price
    // we recorded for a withheld side appears nowhere. (Other swaps' cards further down show their own prices.)
    const quoted = [p.evidence, ...JSON.stringify(p.evidence_claims ?? []).split(/(?<=\.)\s/)].join("\n");
    const ours = text.split("\n").filter((l) => !l.split(/(?<=\.)\s/).some((s) => s.length > 30 && quoted.includes(s.replace(/^Where the evidence stops: /, ""))));
    for (const side of ["brand", "alternative"] as const) {
      if (!p.withheld?.[side]) continue;
      const price = new RegExp(`[$£€]${p[side].price.toFixed(2).replace(".", "\\.")}(?!\\d)`);
      assert.deepEqual(ours.filter((l) => price.test(l)), [], `${p.slug}: the ${side}'s recorded price is on the page`);
    }
  }
  assert.ok(read > 0, "some withheld pages were built");
});

test("a swap with a store whose terms bar dupe comparisons never says dupe", { skip: built ? false : "no build" }, () => {
  const barred = english.filter((p) => !dupeWordAllowed([p.brand, p.alternative], p.market));
  for (const p of barred) {
    const text = page(p);
    if (text) assert.doesNotMatch(text, /\bdupes?\b/i, p.slug);
  }
});

test("a priced swap page still shows its prices", { skip: built ? false : "no build" }, () => {
  const priced = english.find((p) => !p.withheld && page(p));
  assert.ok(priced, "a priced English swap page");
  assert.match(page(priced)!, MONEY);
  assert.doesNotMatch(page(priced)!, /See the price at /);
});
