/**
 * What a swap saves in a year, which swaps get a yearly figure, and how the shopper's choices are read back.
 *
 *   npx tsx --test scripts/qa/yearly.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { localFor, rate } from "../../src/lib/localize";
import type { Catalog } from "../../src/lib/types";
import {
  DEFAULT_FREQUENCY,
  FREQUENCIES,
  frequencyFor,
  frequencyLabel,
  NO_CHOICES,
  packSaving,
  packsPerYear,
  parseChoices,
  savingKind,
  totalText,
  withChoice,
  yearlySaving,
  type KindInput,
} from "../../src/lib/yearly";

const { pairs } = catalog as unknown as Catalog;
const cents = (n: number) => Math.round(n * 100) / 100;

test("the frequencies are the seven the shopper can pick, in order, with their packs a year", () => {
  assert.deepEqual(
    FREQUENCIES.map((f) => [f.label, f.perYear]),
    [
      ["every week", 52],
      ["every 2 weeks", 26],
      ["every month", 12],
      ["every 2 months", 6],
      ["every 3 months", 4],
      ["twice a year", 2],
      ["once a year", 1],
    ],
  );
  assert.equal(DEFAULT_FREQUENCY, "1m");
  assert.equal(frequencyLabel(DEFAULT_FREQUENCY), "every month");
});

test("same pack size: a year is the price gap times packs a year", () => {
  const prices = { brandPrice: 7.49, brandSize: 24, altPrice: 2.99, altSize: 24 };
  assert.equal(cents(packSaving(prices)), 4.5);
  assert.equal(cents(yearlySaving(prices, "1m")), 54);
  assert.equal(cents(yearlySaving(prices, "1w")), 234);
  assert.equal(cents(yearlySaving(prices, "1y")), 4.5);
});

test("the brand's pack is bigger than the cheaper one's: it counts the brand's amount at the cheaper unit price", () => {
  // 500 ml for 5.00 against 250 ml for 1.50: 500 ml of the cheaper one costs 3.00, so each brand pack saves 2.00.
  const prices = { brandPrice: 5, brandSize: 500, altPrice: 1.5, altSize: 250 };
  assert.equal(cents(packSaving(prices)), 2);
  assert.equal(cents(yearlySaving(prices, "1m")), 24);
  assert.equal(cents(yearlySaving(prices, "2w")), 52);
});

test("the brand's pack is smaller than the cheaper one's", () => {
  const prices = { brandPrice: 3, brandSize: 100, altPrice: 4, altSize: 400 };
  assert.equal(cents(packSaving(prices)), 2);
  assert.equal(cents(yearlySaving(prices, "3m")), 8);
});

test("odd pack sizes: 0.7 oz of ginger against a 1.48 oz jar", () => {
  // 5.99 - 4.99 x 0.7 / 1.48 = 3.62986..., so twelve packs are 43.558... and read $43.56.
  const prices = { brandPrice: 5.99, brandSize: 0.7, altPrice: 4.99, altSize: 1.48 };
  assert.equal(cents(packSaving(prices)), 3.63);
  assert.equal(cents(yearlySaving(prices, "1m")), 43.56);
  // The year comes from the recorded prices, not from a per-pack figure rounded to the cent.
  const tricky = { brandPrice: 1, brandSize: 3, altPrice: 1, altSize: 7 };
  // 1 - 3/7 = 0.571428...: 52 packs are 29.714..., where 52 x 0.57 would say 29.64.
  assert.equal(cents(yearlySaving(tricky, "1w")), 29.71);
});

test("a cheaper side that isn't cheaper never shows a negative saving", () => {
  assert.equal(yearlySaving({ brandPrice: 2, brandSize: 10, altPrice: 3, altSize: 10 }, "1w"), 0);
});

test("every catalogue swap: the yearly figure is exactly packs a year times the recorded prices, within rounding of the per-pack figure", () => {
  for (const p of pairs) {
    const prices = { brandPrice: p.brand.price, brandSize: p.brand.size, altPrice: p.alternative.price, altSize: p.alternative.size };
    const exact = 12 * (p.brand.price - (p.alternative.price / p.alternative.size) * p.brand.size);
    assert.ok(Math.abs(yearlySaving(prices, "1m") - exact) < 1e-9, p.slug);
    // The catalogue rounds its per-pack saving to the cent, so twelve of them can be off by at most 6 cents.
    // A price a store's affiliate terms withhold keeps no saving at all (src/lib/programme-terms.ts).
    if (!p.withheld) assert.ok(Math.abs(yearlySaving(prices, "1m") - 12 * p.savingsPerPack) <= 0.06 + 1e-9, p.slug);
  }
});

test("a converted yearly figure is the same sum converted, and reads about", () => {
  const prices = { brandPrice: 4.5, brandSize: 400, altPrice: 1.1, altSize: 250 };
  const gbp = yearlySaving(prices, "1m");
  const de = localFor("DE");
  assert.equal(de.amount(gbp, "GBP"), gbp * rate("GBP", "EUR"));
  assert.ok(de.converts("GBP"));
  assert.match(de.money(gbp, "GBP"), /^about €\d+\.\d\d$/);
  // A UK shopper sees pounds as they are.
  assert.equal(localFor("GB").money(gbp, "GBP"), `£${gbp.toFixed(2)}`);
});

test("totals: one currency for a known country, marked about when anything converted", () => {
  const gb = localFor("GB");
  assert.equal(totalText([{ amount: 10, currency: "GBP" }, { amount: 5.5, currency: "GBP" }], gb), "£15.50");
  const de = localFor("DE");
  const mixed = totalText([{ amount: 10, currency: "EUR" }, { amount: 10, currency: "GBP" }], de);
  assert.equal(mixed, `about €${(10 + 10 * rate("GBP", "EUR")).toFixed(2)}`);
  assert.equal(totalText([{ amount: 10, currency: "EUR" }], de), "€10.00");
});

test("totals: with no country, each currency keeps its own total rather than adding pounds to dollars", () => {
  const unknown = localFor(null);
  assert.equal(
    totalText([{ amount: 10, currency: "GBP" }, { amount: 2, currency: "USD" }, { amount: 1, currency: "GBP" }], unknown),
    "£11.00 + $2.00",
  );
});

const kind = (category: string, unit: string, size: number, products = ["A", "B"]) => savingKind({ category, unit, size, products } as KindInput);

test("things nobody buys monthly get the one-off saving, not a yearly figure", () => {
  assert.equal(kind("tech-tools", "charger", 1), "once");
  assert.equal(kind("tech-tools", "cable", 1), "once");
  assert.equal(kind("tech-tools", "adapter", 1), "once");
  assert.equal(kind("tech-tools", "stylu", 1), "once");
  assert.equal(kind("tech-tools", "tracker", 4), "once", "four trackers are still bought once");
  assert.equal(kind("tech-tools", "gb", 128), "once", "a 128 GB stick is bought once");
  assert.equal(kind("tech-tools", "pot", 1), "once");
  assert.equal(kind("kitchen", "kettle", 1), "once");
  assert.equal(kind("car", "charger", 1), "once");
  assert.equal(kind("car", "pair", 1), "once");
  assert.equal(kind("garden", "metre", 30), "once", "a 30 m hose");
  assert.equal(kind("tools-diy", "bit", 19), "once", "a set of drill bits");
  assert.equal(kind("tools-diy", "brush", 5), "once", "a set of paintbrushes");
  assert.equal(kind("tools-diy", "tape", 1), "once");
  assert.equal(kind("otc-medicine", "tablet", 1), "once", "a single tablet is not a monthly buy");
  assert.equal(kind("otc-medicine", "7-day kit", 1), "once");
});

test("things you use up get a yearly figure, whatever the pack size", () => {
  assert.equal(kind("otc-medicine", "tablet", 100), "yearly");
  assert.equal(kind("food-pantry", "g", 400), "yearly");
  assert.equal(kind("food-pantry", "l", 1), "yearly", "a litre of milk is a measure");
  assert.equal(kind("food-pantry", "oz", 0.7), "yearly", "a small jar of spice");
  assert.equal(kind("baby", "fl oz", 1), "yearly");
  assert.equal(kind("kitchen", "metre", 60), "yearly", "foil is used up");
  assert.equal(kind("tech-tools", "battery", 24), "yearly");
  assert.equal(kind("tech-tools", "filter", 6), "yearly");
  assert.equal(kind("tools-diy", "glove", 100), "yearly");
  assert.equal(kind("tools-diy", "square metre", 65), "yearly", "paint");
  assert.equal(kind("pet", "dose", 3), "yearly");
});

test("a record priced per wash or per 100 ml has no pack to count", () => {
  assert.equal(kind("household", "wash", 1, ["Persil, price per wash", "Denkmit, price per wash"]), "per-amount");
  assert.equal(kind("beauty-hair", "ml", 100, ["Pantene, price per 100 ml", "Balea, price per 100 ml"]), "per-amount");
  assert.equal(kind("pet", "day", 1, ["Whiskas, cost per day for a 4 kg cat", "Coshida, cost per day"]), "per-amount");
  // A real 100 ml bottle is a pack.
  assert.equal(kind("otc-medicine", "ml", 100, ["Calpol 100ml", "Tesco Health 100ml"]), "yearly");
});

test("every catalogue swap gets a kind, and no charger, cable or single durable item gets a yearly figure", () => {
  for (const p of pairs) {
    const k = savingKind({ category: p.category, unit: p.brand.unit, size: p.brand.size, products: [p.brand.product, p.alternative.product] });
    assert.ok(["yearly", "once", "per-amount"].includes(k), p.slug);
    if (["charger", "cable", "adapter", "keyboard", "kettle", "pot", "tool"].includes(p.brand.unit)) assert.equal(k, "once", p.slug);
    if (/\b(price|cost) per\b/i.test(p.brand.product)) assert.equal(k, "per-amount", p.slug);
  }
  const yearly = pairs.filter((p) => savingKind({ category: p.category, unit: p.brand.unit, size: p.brand.size, products: [p.brand.product, p.alternative.product] }) === "yearly");
  assert.ok(yearly.length > pairs.length * 0.8, "most swaps are things you keep buying");
});

test("stored choices: per swap, with the last choice standing in for the rest", () => {
  assert.deepEqual(frequencyFor(NO_CHOICES, "a"), { often: "1m", chosen: false });
  const one = withChoice(NO_CHOICES, "a", "2w");
  assert.deepEqual(frequencyFor(one, "a"), { often: "2w", chosen: true });
  assert.deepEqual(frequencyFor(one, "b"), { often: "2w", chosen: false }, "the last choice is the default, still marked as not chosen");
  const two = withChoice(one, "b", "3m");
  assert.deepEqual(frequencyFor(two, "a"), { often: "2w", chosen: true });
  assert.deepEqual(frequencyFor(two, "c"), { often: "3m", chosen: false });
  assert.equal(packsPerYear(frequencyFor(two, "b").often), 4);
});

test("stored choices: anything unreadable is no choice, never an error", () => {
  assert.deepEqual(parseChoices(null), NO_CHOICES);
  assert.deepEqual(parseChoices("not json"), NO_CHOICES);
  assert.deepEqual(parseChoices("[]"), { last: null, swaps: {} });
  assert.deepEqual(parseChoices('"1m"'), NO_CHOICES);
  assert.deepEqual(parseChoices('{"last":"daily","swaps":{"a":"1w","b":"often","c":3}}'), { last: null, swaps: { a: "1w" } });
  const round = withChoice(NO_CHOICES, "x", "6m");
  assert.deepEqual(parseChoices(JSON.stringify(round)), round);
});
