import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import catalogJson from "../../src/generated/catalog.json";
import type { Pair } from "../../src/lib/types";
import { localFor } from "../../src/lib/localize";
import { COUNTRIES } from "../../src/lib/markets";
import { countriesByToken, currencyToken, listedIn, noteSlotScript, shopperAttributesScript, tagVariants } from "../../src/lib/reserve";

/** Runs a script against a pretend document: its <html> attributes, a cookie, and the element the script sits in. */
function run(script: string, { cookie = "", html = {} as Record<string, string>, c }: { cookie?: string; html?: Record<string, string>; c?: string }) {
  const attrs = { ...html };
  const parent: Record<string, string> = {};
  const element = (store: Record<string, string>) => ({
    setAttribute: (k: string, v: string) => void (store[k] = v),
    getAttribute: (k: string) => store[k] ?? null,
  });
  const document = { cookie, documentElement: element(attrs), currentScript: { parentNode: element(parent) } };
  runInNewContext(c === undefined ? script : `var c=${JSON.stringify(c)};${script}`, { document });
  return { html: attrs, slot: parent };
}

test("every known country gets exactly one currency token, the currency its prices are shown in", () => {
  const groups = countriesByToken();
  const all = Object.values(groups).flat();
  assert.equal(all.length, Object.keys(COUNTRIES).length);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(groups.USD, ["US"]);
  for (const c of ["DE", "IE", "HR"]) assert.equal(currencyToken(c), "EUR");
  assert.equal(currencyToken("CH"), "OTHER");
  assert.equal(currencyToken("GB"), "GBP");
});

test("the layout script names the shopper's country and currency, and nothing for an unknown or missing one", () => {
  const script = shopperAttributesScript();
  assert.deepEqual(run(script, { c: "DE" }).html, { "data-cc": "DE", "data-cur": "EUR" });
  assert.deepEqual(run(script, { c: "CH" }).html, { "data-cc": "CH", "data-cur": "OTHER" });
  assert.deepEqual(run(script, { c: "ZZ" }).html, {});
  assert.deepEqual(run(script, { c: "" }).html, {});
});

test("the note's stand-in takes room exactly where the shopper's view will show the note", () => {
  const pairs = (catalogJson as unknown as { pairs: Pair[] }).pairs;
  const us = pairs.find((p) => p.market === "US" && !localFor("DE").shows(p) && !localFor("DE", true).shows(p))!;
  const wideOnly = pairs.find((p) => !localFor("HR").shows(p) && localFor("HR", true).shows(p));
  assert.ok(us, "a US swap Germany doesn't list");
  const script = noteSlotScript(listedIn(us));
  assert.deepEqual(run(script, { html: { "data-cc": "DE" } }).slot, { "data-on": "" });
  assert.deepEqual(run(script, { html: { "data-cc": "US" } }).slot, {});
  assert.deepEqual(run(script, { html: {} }).slot, {}, "a visitor we can't place reads the record's own view");
  if (wideOnly) {
    const s = noteSlotScript(listedIn(wideOnly));
    assert.deepEqual(run(s, { html: { "data-cc": "HR" } }).slot, { "data-on": "" });
    assert.deepEqual(run(s, { html: { "data-cc": "HR" }, cookie: "sbc_others=1" }).slot, {}, "other countries' swaps shown");
  }
  // listedIn agrees with localize for every country.
  for (const c of Object.keys(COUNTRIES)) assert.equal(listedIn(us).strict.includes(c), localFor(c).shows(us), c);
});

test("each record's market tag has a variant for every kind of shopper who gets one, and none for its own market", () => {
  const de = tagVariants("DE");
  assert.deepEqual(de.map((v) => v.token).sort(), ["CAD", "GBP", "OTHER", "USD", "same"].sort());
  assert.ok(de.every((v) => v.country !== "DE"));
  assert.ok(!tagVariants("US").some((v) => v.token === "same" || v.token === "USD"), "only the US pays in dollars");
  for (const v of tagVariants("GB")) assert.equal(localFor(v.country).converts("GBP"), v.token !== "same", v.country);
});
