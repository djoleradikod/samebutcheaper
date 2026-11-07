/**
 * Rules on the swap page that read prose from the catalogue.
 *
 *   npx tsx --test scripts/qa/compare-rules.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { comparison, hasProof, nutrientVerdict, onFileIntro, sideNamed, sortDifferences } from "../../src/lib/compare";
import type { Pair } from "../../src/lib/types";

const side = (brand: string, product: string) => ({
  brand,
  product,
  size: 400,
  unit: "g",
  price: 1,
  ppu: 0.0025,
  retailer: "other",
  url: "https://example.com/p",
  key_ingredients: [],
  photo: null,
  nutrition: null,
});

const pair = (over: Record<string, unknown> = {}) =>
  ({
    slug: "baxters-soup-vs-tesco-soup-gb",
    category: "food-pantry",
    match_type: "equivalent_spec",
    currency: "GBP",
    savingsPct: 70,
    brand: side("Baxters", "Baxters Soup"),
    alternative: side("Tesco", "Tesco Soup"),
    summary: "Two soups, one cheaper.",
    evidence: "Read on both shop pages.",
    differences: "",
    aspects: [],
    sources: ["https://www.which.co.uk/reviews/soup", "https://world.openfoodfacts.org/product/1"],
    nutritionSource: null,
    ...over,
  }) as unknown as Pair;

const testRow = (p: Pair) => comparison(p).rows.find((r) => r.kind === "test");

test("the soup record's filler leaves the section, and its caveats survive", () => {
  const { points, caveats } = sortDifferences(
    "Prices are from October 2026. The brand didn't score better here. This is one panel's taste result.",
  );
  assert.deepEqual(points, []);
  assert.deepEqual(caveats, ["Prices are from October 2026.", "This is one panel's taste result."]);
});

test("concrete differences stay, whichever side they favour", () => {
  const text = [
    "The Co-op pack is bigger, 550g against 460g.",
    "Nescafé scored one point higher.",
    "Both labels list tomato and vinegar, but the order differs.",
    "Inactive ingredients may differ.",
    "Anker gives an 18-month warranty and Apple gives 1 year.",
  ].join(" ");
  assert.equal(sortDifferences(text).points.length, 5);
  assert.deepEqual(sortDifferences(text).caveats, []);
});

test("notes about the record move beside the evidence instead of disappearing", () => {
  for (const s of [
    "No taste test covers this pair.",
    "We have no cooking or taste test for this pair.",
    "We did not compare sheet size.",
    "Prices exclude VAT.",
    "The photo shows a refill pouch.",
    "Neither page shows USB-IF certification.",
    "Ask your pediatrician before switching.",
    "A one-point gap is close to a tie.",
    "The labels show no ingredient difference.",
    "The Signature Select record gives no percentage.",
    "Only Dulcolax's 10-tablet pack was checked.",
  ]) {
    assert.deepEqual(sortDifferences(s), { points: [], caveats: [s] }, s);
  }
});

test("a sentence saying nothing happened is dropped", () => {
  for (const s of ["The scores are level, so the brand wasn't better here.", "Same actives and strengths.", "The dose and active are the same."]) {
    assert.deepEqual(sortDifferences(s), { points: [], caveats: [] }, s);
  }
});

test("a name only counts when it clearly means one side", () => {
  const p = pair();
  assert.equal(sideNamed(p, "Tesco's soup"), "alternative");
  assert.equal(sideNamed(p, "Baxters"), "brand");
  assert.equal(sideNamed(p, "the soup"), null);
  assert.equal(sideNamed(p, "Heinz"), null);
});

test("a Which? panel gives a row with the test's name, both scores and the source", () => {
  const row = testRow(
    pair({
      evidence:
        "Which? tomato soup test, published 12 October 2026, rated by 77 people in August 2026. Tesco 78%, 59p for 400g. Baxters 58%, £2.05 for 400g.",
    }),
  );
  assert.equal(row?.aspect, "Which? tomato soup test");
  assert.equal(row?.brand, "58%");
  assert.equal(row?.alternative, "78%");
  assert.equal(row?.verdict, "alt_better");
  assert.equal(row?.detail, "October 2026, 77 people");
  assert.equal(row?.source, "https://www.which.co.uk/reviews/soup");
});

test("a percentage in a product's name isn't read as its score", () => {
  const p = pair({
    slug: "hotel-chocolat-classic-vs-tesco-finest-gb",
    brand: side("Hotel Chocolat", "Classic 70%"),
    alternative: side("Tesco Finest", "Belgian 70%"),
    evidence:
      "Which? hot chocolate test, published 5 January 2026, a panel of 78. Tesco Finest Belgian 70% scored 70%, Great Value, £5.75 for 200g. Hotel Chocolat Classic 70% scored 60%, £10.95 for 250g.",
  });
  assert.equal(testRow(p)?.alternative, "70%");
  assert.equal(testRow(p)?.brand, "60%");
});

test("one side's score alone gets no row", () => {
  const p = pair({
    evidence: "Which? washing-up liquid test, tested April 2026, page checked July 2026. Tesco 78%, a Best Buy, £1.",
  });
  assert.equal(testRow(p), undefined);
});

test("no test in the record gets no row, and the intro says so", () => {
  const p = pair();
  assert.equal(testRow(p), undefined);
  assert.match(onFileIntro(comparison(p)), /^All we have on file/);
});

test("German grades read lower as better and keep each grade with its name", () => {
  const p = pair({
    slug: "whiskas-knackits-vs-netto-attica-de",
    brand: side("Whiskas", "Knackits"),
    alternative: side("Attica", "Knuspermenue"),
    summary: "In Stiftung Warentest 5/2023 the Netto food scored 1.3 at about 7 cents a day, and the Whiskas got 1.8 at 18 cents.",
    sources: ["https://www.test.de/katzenfutter", "https://www.t-online.de/x"],
  });
  const row = testRow(p);
  assert.equal(row?.aspect, "Stiftung Warentest 5/2023");
  assert.equal(row?.brand, "1.8");
  assert.equal(row?.alternative, "1.3");
  assert.equal(row?.verdict, "alt_better");
  assert.equal(row?.source, "https://www.test.de/katzenfutter");
});

test("a brand with the better grade wins the row", () => {
  const p = pair({
    slug: "alnatura-oel-vs-dmbio-oel-de",
    brand: side("Alnatura", "Olivenoel"),
    alternative: side("dmBio", "Olivenoel"),
    summary: "Both are organic oils in Stiftung Warentest 2/2026. Alnatura scored better at 2.3 against 2.6, and dmBio cost a third less.",
  });
  assert.equal(testRow(p)?.verdict, "brand_better");
  assert.equal(testRow(p)?.brand, "2.3");
});

test("grades in words give a row without a number", () => {
  const p = pair({
    slug: "sebamed-dusche-vs-aveo-dusche-de",
    brand: side("Sebamed", "Dusche"),
    alternative: side("Aveo", "Dusche"),
    summary: "Öko-Test rated both very good in April 2025, and the Aveo cost about an eighth as much per ml.",
  });
  assert.equal(testRow(p)?.brand, "Very good");
  assert.equal(testRow(p)?.verdict, "same");
});

test("a researched test row keeps its own values and picks up the link and date", () => {
  const p = pair({
    evidence: "Auto Express, 13 October 2026, cut wire. It gave around GBP 79.99 for Baxters.",
    sources: ["https://www.autoexpress.co.uk/best", "https://shop.example.com/"],
    aspects: [{ aspect: "Auto Express score", brand: "3.5 of 5", alternative: "5 of 5", verdict: "alt_better" }],
  });
  const row = testRow(p);
  assert.equal(row?.brand, "3.5 of 5");
  assert.equal(row?.detail, "October 2026");
  assert.equal(row?.source, "https://www.autoexpress.co.uk/best");
});

test("a shopper rating isn't a test", () => {
  const p = pair({ aspects: [{ aspect: "Shopper rating", brand: "4.0/5", alternative: "4.4/5", verdict: "alt_better" }] });
  assert.equal(testRow(p), undefined);
});

test("nutrient verdicts name the higher side and make no other claim", () => {
  assert.equal(nutrientVerdict(61, 58, 10, "Baxters", "Tesco"), "About the same");
  assert.equal(nutrientVerdict(1.4, 0.2, 0.3, "Baxters", "Tesco"), "Baxters higher");
  assert.equal(nutrientVerdict(0.1, 1, 0.5, "Baxters", "Tesco"), "Tesco higher");
  assert.equal(nutrientVerdict(100, 91, 1, "Baxters", "Tesco"), "About the same");
});

const record = (over: Record<string, unknown> = {}) => ({
  code: "1",
  page: "https://world.openfoodfacts.org/product/1",
  name: "x",
  modified: "2026-01-01",
  kcal: 60,
  fat: 2,
  saturates: null,
  sugars: 5,
  salt: 0.5,
  protein: 1,
  fibre: 1,
  ingredients: "Tomatoes, water",
  ...over,
});

const source = { source: "Open Food Facts", license: "ODbL 1.0", licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/", dump: "2026-11-06" };

test("nutrition shows only what both sides have, and only when both sides have a record", () => {
  const both = pair({
    brand: { ...side("Baxters", "Soup"), nutrition: record({ saturates: 1 }) },
    alternative: { ...side("Tesco", "Soup"), nutrition: record({ page: "https://world.openfoodfacts.org/product/2" }) },
    nutritionSource: source,
  });
  const group = comparison(both).nutrition;
  assert.deepEqual(
    group?.rows.map((r) => r.aspect),
    ["Energy", "Fat", "Sugars", "Salt", "Protein", "Fibre", "Ingredients"],
  );
  assert.equal(group?.records.length, 2);
  assert.match(onFileIntro(comparison(both)), /nutrition and ingredients/);
  const one = pair({ brand: { ...side("Baxters", "Soup"), nutrition: record() }, nutritionSource: source });
  assert.equal(comparison(one).nutrition, null);
});

test("a safety warning stays in the differences even when it reads like a caveat", () => {
  for (const s of [
    "Both contain permethrin, which is TOXIC TO CATS, so never use either on cats.",
    "Check the label: not suitable for children under 12.",
  ]) {
    assert.deepEqual(sortDifferences(s), { points: [s], caveats: [] }, s);
  }
});

test("a swap with only pack and price on file has no proof", () => {
  assert.equal(hasProof(comparison(pair({}))), false);
});

test("records too far apart on energy lose their figures", () => {
  const p = pair({
    brand: { ...side("Baxters", "Soup"), nutrition: record({ kcal: 200 }) },
    alternative: { ...side("Tesco", "Soup"), nutrition: record({ kcal: 400 }) },
    nutritionSource: source,
  });
  assert.deepEqual(
    comparison(p).nutrition?.rows.map((r) => r.aspect),
    ["Ingredients"],
  );
});
