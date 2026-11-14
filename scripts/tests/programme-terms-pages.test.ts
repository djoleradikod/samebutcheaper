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
import { getT } from "../../src/lib/i18n";
import { pageText } from "./i18n-page-text";

const ROOT = join(import.meta.dirname, "..", "..");
const catalog = catalogJson as unknown as Catalog;
const APP = join(ROOT, ".next/server/app");

/** The English page of a swap in its own country, when the build wrote one. */
function page(p: Pair) {
  return built_(p.market, "compare", p.slug);
}

/** Any built page of a record in its own country: compare, bundle, basket or dupe. */
function built_(market: string, kind: string, slug: string) {
  const seg = prefixFor(market);
  if (!seg) return null;
  const file = join(APP, "country", seg, kind, `${slug}.html`);
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

test("a swap whose prices are all withheld doesn't say when its prices were checked as if they showed", { skip: skipWithheld }, () => {
  const both = english.filter((p) => p.withheld?.brand && p.withheld?.alternative);
  for (const p of both) {
    const text = page(p);
    if (!text) continue;
    assert.doesNotMatch(text, /^Prices checked /m, p.slug);
    assert.match(text, /Store prices withheld here\. Last checked by us: /, p.slug);
  }
});

test("a withheld swap page shows no delivery-fee line for the withheld side", { skip: skipWithheld }, () => {
  for (const p of english.filter((p) => p.withheld?.brand && p.withheld?.alternative)) {
    const text = page(p);
    if (text) assert.doesNotMatch(text, /free delivery|delivery fee|free shipping|shipping fee/i, p.slug);
  }
});

test("a withheld kit still says how close a match it is and what differs, safety notes included", { skip: skipWithheld }, () => {
  let read = 0;
  for (const b of catalog.bundles.filter((b) => b.withheld && (b.market === "US" || b.market === "GB"))) {
    const text = built_(b.market, "bundle", b.slug);
    if (!text) continue;
    read++;
    assert.match(text, /^Match: /m, b.slug);
    if (b.differences) assert.ok(text.includes(b.differences.slice(0, 60)), `${b.slug}: what differs is on the page`);
  }
  assert.ok(read > 0, "some withheld kit pages were built");
});

test("a withheld basket names each line's products and its match", { skip: skipWithheld }, () => {
  const pairs = new Map(catalog.pairs.map((p) => [p.slug, p]));
  let read = 0;
  for (const preset of catalog.presets.filter((x) => x.withheld?.length && (x.market === "US" || x.market === "GB"))) {
    const text = built_(preset.market, "basket", preset.slug);
    if (!text) continue;
    read++;
    for (const l of preset.lines) {
      const pair = pairs.get(l.pair)!;
      assert.ok(text.toLowerCase().includes(pair.alternative.product.toLowerCase().slice(0, 20)), `${preset.slug}: ${l.pair}'s product`);
      assert.ok(text.includes(getT("en")("cards.matchShortPlain", pair.match_type)), `${preset.slug}: ${l.pair}'s match`);
    }
  }
  assert.ok(read > 0, "some withheld basket pages were built");
});
