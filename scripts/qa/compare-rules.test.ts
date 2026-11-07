/**
 * Rules on the swap page that read prose from the catalogue.
 *
 *   npx tsx --test scripts/qa/compare-rules.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { atStore, linkStoreName, mayEarn, storeName, storeSplit } from "../../src/lib/affiliate";
import { matchSentence } from "../../src/lib/categories";
import { comparison, hasProof, ingredientListLabel, nutrientVerdict, onFileIntro, sideNamed, sortDifferences } from "../../src/lib/compare";
import { withCelsius } from "../../src/lib/format";
import { differentSalts } from "../../src/lib/ingredient-key";
import { normAmount } from "../../src/lib/lookup/text";
import { jsonLdText } from "../../src/lib/site";
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

const withRows = (brand: [string, string][], alternative: [string, string][], over: Record<string, unknown> = {}) => {
  const rows = (list: [string, string][]) => list.map(([name, amount]) => ({ name, amount }));
  return pair({
    brand: { ...side("Baxters", "Soup"), key_ingredients: rows(brand) },
    alternative: { ...side("Tesco", "Soup"), key_ingredients: rows(alternative) },
    ...over,
  });
};
const verdicts = (p: Pair) => comparison(p).ingredients.map((r) => r.verdict);

test("spec rows with a value on one side only are no proof", () => {
  const p = withRows([["FSC, up to 220 C", ""]], [["Non-stick on both sides", ""]]);
  assert.deepEqual(verdicts(p), ["unknown", "unknown"]);
  assert.equal(hasProof(comparison(p)), false);
  assert.match(onFileIntro(comparison(p)), /Nothing here compares/);
});

test("a spec row both sides state is proof, whether it matches or not", () => {
  assert.equal(hasProof(comparison(withRows([["Read speed", "150 MB/s"]], [["Read speed", "100 MB/s"]]))), true);
  assert.equal(hasProof(comparison(withRows([["USB-C 3.2 Gen 1", "128 GB"]], [["USB-C 3.2 Gen 1", "128 GB"]]))), true);
});

test("a stated value against a missing one proves nothing", () => {
  assert.deepEqual(verdicts(withRows([["Zinc", "10 mg"]], [["Zinc", "amount not shown on listing"]])), ["unknown"]);
  assert.deepEqual(verdicts(withRows([["Speed", "130 MB/s"]], [["Speed", "not stated"]])), ["unknown"]);
  assert.deepEqual(verdicts(withRows([["Vinegar", "5%"]], [["Vinegar", ""]])), ["unknown"]);
  assert.equal(hasProof(comparison(withRows([["Zinc", "not stated"]], [["Zinc", "not stated"]]))), false);
});

test("a name on both sides with no amount on either counts as listed by both", () => {
  assert.deepEqual(verdicts(withRows([["Sucralose", ""]], [["Sucralose", ""]])), ["same"]);
});

test("amounts compare as numbers", () => {
  assert.deepEqual(verdicts(withRows([["Imidacloprid", "8.8%"]], [["Imidacloprid", "8.80%"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1,000 mg"]], [["Vitamin C", "1000 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Folate", "667 mcg DFE"]], [["Folate", "680 mcg DFE"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Chlorine", "8.8%"]], [["Chlorine", "88%"]])), ["different"]);
});

test("a caplet and a tablet count as one dose unit, and a capsule doesn't", () => {
  assert.deepEqual(verdicts(withRows([["Calcium", "400 mg per 2 caplets"]], [["Calcium", "400 mg per 2 tablets"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Calcium", "400 mg per 2 capsules"]], [["Calcium", "400 mg per 2 tablets"]])), ["different"]);
});

test("grade and salt words don't split one ingredient into two rows", () => {
  const usp = comparison(withRows([["Bisacodyl", "5 mg"]], [["Bisacodyl USP", "5 mg"]]));
  assert.deepEqual(
    usp.ingredients.map((r) => [r.aspect, r.verdict]),
    [["Bisacodyl", "same"]],
  );
  assert.deepEqual(verdicts(withRows([["Paracetamol", "500 mg"]], [["Acetaminophen", "500 mg"]])), ["same"]);
});

test("different forms of an active stay two rows", () => {
  assert.deepEqual(verdicts(withRows([["Omeprazole magnesium", "20.6 mg"]], [["Omeprazole", "20 mg"]])), ["unknown", "unknown"]);
});

test("a decimal comma is a decimal, so 1,5% isn't 15%", () => {
  assert.deepEqual(verdicts(withRows([["Salicylic acid", "1,5%"]], [["Salicylic acid", "15%"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Salicylic acid", "1,5%"]], [["Salicylic acid", "1.5%"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Salicylic acid", "0,50%"]], [["Salicylic acid", "0.5%"]])), ["same"]);
});

test("a three-digit group is thousands, in either notation", () => {
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1.000 mg"]], [["Vitamin C", "1 mg"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1,000 mg"]], [["Vitamin C", "1.000 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1,000 mg"]], [["Vitamin C", "1000 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1.000 mg"]], [["Vitamin C", "1000 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1,000 mg"]], [["Vitamin C", "1 mg"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Vitamin C", "1.000,5 mg"]], [["Vitamin C", "1000.5 mg"]])), ["same"]);
});

test("a small decimal with three places stays a decimal", () => {
  assert.deepEqual(verdicts(withRows([["Thymol", "0.060%"]], [["Thymol", "0.06%"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Stannous fluoride", "0.454%"]], [["Stannous fluoride", "454%"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Ketotifen", "8.80%"]], [["Ketotifen", "8.8%"]])), ["same"]);
});

test("a lookup doesn't read 1.000 mg as 1 mg, and 5.0 mg is still 5 mg", () => {
  assert.notEqual(normAmount("1.000 mg"), normAmount("1 mg"));
  assert.equal(normAmount("5.0 mg"), normAmount("5 mg"));
  assert.equal(normAmount("5.00 mg"), normAmount("5 mg"));
});

test("two different salts at one amount stay two rows", () => {
  const rows = comparison(withRows([["Creatine monohydrate", "5 g"]], [["Creatine HCl", "5 g"]])).ingredients;
  assert.deepEqual(
    rows.map((r) => [r.aspect, r.brand, r.alternative, r.verdict]),
    [
      ["Creatine monohydrate", "5 g", "Not listed", "unknown"],
      ["Creatine HCl", "Not listed", "5 g", "unknown"],
    ],
  );
  assert.deepEqual(verdicts(withRows([["Calcium (as calcium citrate)", "400 mg"]], [["Calcium (as calcium carbonate)", "400 mg"]])), ["unknown", "unknown"]);
  assert.deepEqual(verdicts(withRows([["Omeprazole (as magnesium)", "20 mg"]], [["Omeprazole (as sodium)", "20 mg"]])), ["unknown", "unknown"]);
});

test("spellings of one salt, or a salt on one side only, stay one row", () => {
  assert.deepEqual(verdicts(withRows([["Cetirizine HCl", "10 mg"]], [["Cetirizine hydrochloride", "10 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Cetirizine HCl", "10 mg"]], [["Cetirizine", "10 mg"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Creatine monohydrate", "5 g"]], [["Creatine monohydrate (micronized)", "5 g"]])), ["same"]);
  assert.equal(differentSalts("Calcium (as calcium citrate)", "Calcium (as calcium citrate)"), false);
});

test("a value that says it isn't stated counts as missing, wherever the words sit", () => {
  for (const missing of ["capacity not stated", "not stated", "Not listed on the page", "strength not stated on the page", "amount not shown on listing", "None listed", "No class stated", "isn't stated"]) {
    assert.deepEqual(verdicts(withRows([["Capacity", missing]], [["Capacity", "2800 mAh"]])), ["unknown"], missing);
    const row = comparison(pair({ aspects: [{ aspect: "Capacity", brand: missing, alternative: "2800 mAh", verdict: "different" }] })).rows.find((r) => r.aspect === "Capacity");
    assert.equal(row?.verdict, "unknown", missing);
  }
});

test("a real value with an aside about something else stays a value", () => {
  assert.deepEqual(verdicts(withRows([["Cable", "6 ft cable (rating not stated)"]], [["Cable", "2 m cable"]])), ["different"]);
  assert.deepEqual(verdicts(withRows([["Carbonate", "listed 1st (% not disclosed)"]], [["Carbonate", "listed 1st (% not disclosed)"]])), ["same"]);
  assert.deepEqual(verdicts(withRows([["Dyes", "Uncoated, no dyes listed"]], [["Dyes", "Coated"]])), ["different"]);
});

test("a verdict that one side won stays when the other side says it's not stated", () => {
  const row = comparison(pair({ aspects: [{ aspect: "Guarantee", brand: "10 years", alternative: "Guarantee not stated", verdict: "brand_better" }] })).rows.find((r) => r.aspect === "Guarantee");
  assert.equal(row?.verdict, "brand_better");
});

test("a row that only restates the pack size isn't proof", () => {
  for (const aspect of ["Pack", "Bag size", "Bottle size", "Can size", "Length per roll", "pack count"]) {
    const c = comparison(pair({ aspects: [{ aspect, brand: "15", alternative: "40", verdict: "different" }] }));
    assert.equal(hasProof(c), false, aspect);
  }
  for (const aspect of ["Length", "Brush sizes", "Cable in the box"]) {
    const c = comparison(pair({ aspects: [{ aspect, brand: "a", alternative: "b", verdict: "different" }] }));
    assert.equal(hasProof(c), true, aspect);
  }
});

test("an Amazon link is named as Amazon, whichever retailer the record names", () => {
  assert.equal(linkStoreName({ retailer: "costco", url: "https://www.amazon.com/s?k=duracell" }), "Amazon");
  assert.equal(linkStoreName({ retailer: "walmart", url: "https://www.walmart.com/ip/1" }), "Walmart");
  assert.equal(linkStoreName({ retailer: "other", url: "https://www.uline.com/p/1" }), "uline.com");
});

test("a group of swaps promises no more than its weakest one shows", () => {
  assert.equal(matchSentence(["identical_active"]), "Each has the same active ingredients.");
  assert.equal(matchSentence(["identical_active", "equivalent_spec"]), "Each has the same active ingredients, or comparable specs or tests.");
  const kindOnly = matchSentence(["same_kind", "same_kind"]);
  assert.match(kindOnly, /same kind of product/);
  assert.doesNotMatch(kindOnly, /same (active|formula|ingredients)/);
  assert.equal(matchSentence(["same_kind", "equivalent_spec"]), "Some have comparable specs or tests, and the rest are only the same kind of product. Each swap says which.");
  assert.equal(matchSentence([]), "");
});

test("a name the ingredient key drops still gets its own row", () => {
  assert.deepEqual(verdicts(withRows([["Sodium", "100 mg"]], [["Sodium", "100 mg"]])), ["same"]);
  assert.equal(comparison(withRows([["Sodium", "100 mg"]], [["Potassium", "100 mg"]])).ingredients.length, 2);
});

test("ingredient lists ignore case and punctuation", () => {
  assert.equal(ingredientListLabel("WATER, WHEAT. SALT", "water, wheat, salt", "identical_formula"), "Same list");
  assert.equal(ingredientListLabel("Wasser, Zitronen - saftkonzentrat", "Wasser, Zitronensaftkonzentrat.", "identical_formula"), "Same list");
});

test("a same-formula pair whose records still differ is sent to the pack, and only that label says so", () => {
  assert.equal(ingredientListLabel("Salz, Trennmittel Natriumferrocyanid", "Salz, Trennmittel: E535", "identical_formula"), "Records worded differently, check the pack");
  assert.equal(ingredientListLabel("Salz, Trennmittel Natriumferrocyanid", "Salz, Trennmittel: E535", "equivalent_spec"), "Lists differ");
});

test("a store with no name of ours goes by its web address", () => {
  assert.equal(storeName("other", "https://www.uline.com/p/1"), "uline.com");
  assert.equal(storeName("tesco", "https://www.tesco.com/p/1"), "Tesco");
  assert.equal(atStore("other", "https://www.uline.com/p/1"), "at uline.com");
  assert.equal(atStore("amazon", "https://www.amazon.de/p/1"), "on Amazon");
  assert.equal(atStore("other"), "at the store");
});

test("the store split keeps two unnamed shops apart and merges the same one", () => {
  const split = storeSplit([
    { store: storeName("other", "https://www.logitech.com/a"), cost: 20 },
    { store: storeName("other", "https://us.ugreen.com/b"), cost: 5 },
    { store: storeName("other", "https://www.logitech.com/c"), cost: 10 },
    { store: storeName("walmart", "https://www.walmart.com/d"), cost: 12 },
  ]);
  assert.deepEqual(split, [
    { label: "logitech.com", total: 30 },
    { label: "Walmart", total: 12 },
    { label: "us.ugreen.com", total: 5 },
  ]);
});

test("a line set to zero leaves the store split", () => {
  const split = storeSplit([
    { store: "Tesco", cost: 0 },
    { store: "Asda", cost: 4 },
  ]);
  assert.deepEqual(split, [{ label: "Asda", total: 4 }]);
  assert.deepEqual(storeSplit([{ store: "Tesco", cost: 0 }]), []);
});

test("any Amazon link counts as earning, whichever retailer the record names", () => {
  assert.equal(mayEarn({ retailer: "other", url: "https://www.amazon.co.uk/dp/1" }), true);
  assert.equal(mayEarn({ retailer: "apple", url: "https://www.amazon.com/dp/1" }), true);
  assert.equal(mayEarn({ retailer: "walmart", url: "https://www.walmart.com/ip/1" }), true);
  assert.equal(mayEarn({ retailer: "other", url: "https://www.uline.com/p/1" }), false);
  assert.equal(mayEarn({ retailer: "other", url: "not a url" }), false);
});

test("withCelsius adds Celsius to Fahrenheit figures", () => {
  assert.equal(withCelsius("Store below 85 F."), "Store below 29 °C (85 °F).");
  assert.equal(withCelsius("Keep at 50 to 70 F."), "Keep at 10 to 21 °C (50 to 70 °F).");
});

test("withCelsius leaves a figure alone when it already has its Celsius or isn't a temperature", () => {
  assert.equal(withCelsius("below 85 F (29 C)"), "below 85 F (29 C)");
  assert.equal(withCelsius("50 to 70 F (10 to 21 C)"), "50 to 70 F (10 to 21 C)");
  assert.equal(withCelsius("Size 5 F and FSC paper"), "Size 5 F and FSC paper");
});

test("JSON-LD text can't close its script tag", () => {
  const text = jsonLdText({ name: "</script><script>alert(1)</script>" });
  assert.equal(text.includes("<"), false);
  assert.equal(JSON.parse(text).name, "</script><script>alert(1)</script>");
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
