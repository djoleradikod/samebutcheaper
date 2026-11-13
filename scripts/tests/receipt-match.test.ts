/**
 * Matching receipt lines to the swaps a shopper's country lists, against the real catalogue. A wrong match costs
 * more trust than a miss, so near misses (the right brand, another product) must come out as nothing on file.
 *
 *   npm run catalog && npx tsx --test scripts/tests/receipt-match.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { forCountry, localFor } from "../../src/lib/localize";
import { buildIndex, matchLine, matchReceipt, toCandidate, type Index, type LineMatch } from "../../src/lib/receipt/match";
import { parseReceipt, words, type ParsedLine } from "../../src/lib/receipt/parse";
import type { Catalog, Pair } from "../../src/lib/types";

const { pairs } = catalog as unknown as Catalog;
const bySlug = new Map(pairs.map((p) => [p.slug, p]));
const indexes = new Map<string, Index>();
function indexFor(country: string) {
  let index = indexes.get(country);
  if (!index) indexes.set(country, (index = buildIndex(forCountry(pairs, localFor(country)).map(toCandidate))));
  return index;
}

function match(country: string, line: string): LineMatch {
  const parsed = parseReceipt(line)[0];
  assert.equal(parsed?.kind, "item", `${line} should read as a product line`);
  return matchLine(parsed as Extract<ParsedLine, { kind: "item" }>, indexFor(country));
}

/** A swap for this brand-name product: the slug's own product, whichever cheaper option has the biggest saving. */
function isProduct(slug: string, product: RegExp) {
  const p = bySlug.get(slug);
  return Boolean(p && product.test(p.brand.product));
}

type Case = [country: string, line: string, want: LineMatch["status"], product?: RegExp];

const CASES: Case[] = [
  // --- UK: true matches
  ["GB", "HEINZ TOM KETCHUP 460G          3.00", "swap", /^Heinz Tomato Ketchup/],
  ["GB", "FAIRY ORIGINAL W/UP 320ML       1.25", "swap", /^Fairy Original Washing Up Liquid, 320ml/],
  ["GB", "FAIRY MAX POWER ORIGINAL 730ML  3.50", "swap", /^Fairy Max Power Original/],
  ["GB", "PAMPERS BABY DRY SZ4 44S       12.00", "swap", /^Pampers Baby-Dry size 4/],
  ["GB", "HELLMANNS REAL MAYO 430ML       2.75", "swap", /^Hellmann's Real Mayonnaise/],
  ["GB", "PG TIPS 80S                     3.50", "swap", /^PG Tips Original/],
  ["GB", "YORKSHIRE TEA 80 BAGS           3.75", "swap", /^Taylors of Harrogate Yorkshire Tea/],
  ["GB", "DURACELL AAA 12PK               9.00", "swap", /AAA/],
  ["GB", "LEMSIP MAX ALL IN ONE CAPS 16S  4.50", "swap", /^Lemsip Max All in One Capsules/],
  ["GB", "HEINZ CREAM OF TOMATO SOUP 400G 1.60", "swap", /^Heinz Cream of Tomato Soup/],
  // --- UK: unsure, so asked
  ["GB", "NUROFEN 200MG 16S          £2.00 A", "choose", /^Nurofen .*200mg/],
  ["GB", "CLARITIN 10MG 30S", "maybe", /^Clarityn/],
  // --- UK: near misses that must not match
  ["GB", "NUROFEN 400MG 12S", "none"],
  ["GB", "HELLMANNS LIGHT MAYO 430ML", "none"],
  ["GB", "FAIRY NON BIO 23 WASH", "none"],
  ["GB", "PAMPERS BABY DRY SIZE 5", "none"],
  ["GB", "HEINZ SPAGHETTI HOOPS 400G", "none"],
  ["GB", "WARBURTONS TOASTIE 800G", "none"],
  ["GB", "BANANAS LOOSE", "none"],
  ["GB", "TESCO SEMI SKIMMED MILK 2.272L", "own"],
  // --- US: true matches
  ["US", "TYLENOL EX STR CPLT 500MG 225CT 13.97 X", "swap", /^Tylenol Extra Strength Caplets/],
  ["US", "TIDE ORIGINAL LIQ 132OZ        19.97", "swap", /^Tide Original Liquid/],
  ["US", "HEINZ KETCHUP 38OZ              4.48", "swap", /^Heinz Tomato ketchup, 38 oz/i],
  ["US", "CLARITIN 24HR 10MG 70CT        24.97", "swap", /^Claritin 24 Hour/],
  ["US", "JIF CREAMY PB 16OZ              2.98", "swap", /^Jif Creamy Peanut Butter/],
  ["US", "CERAVE MOIST CREAM 16OZ        17.97", "swap", /^CeraVe Moisturizing Cream/],
  ["US", "CHILDRENS TYLENOL CHERRY 4OZ    8.97", "swap", /^Children's Tylenol/],
  // --- US: near misses and own-label
  ["US", "TIDE PODS 42CT                 13.97", "none"],
  ["US", "JIF CRUNCHY 16OZ                2.98", "none"],
  ["US", "TYLENOL PM EX STR 500MG", "none"],
  ["US", "COKE ZERO 12PK                  6.98", "none"],
  ["US", "GV PNT BTR CRMY 16OZ 1.98 N", "own"],
  ["US", "EQUATE IBUPROFEN 200MG 100CT", "own"],
  // --- Germany: true matches
  ["DE", "NUROFEN 400MG 24ST       7,95 A", "swap", /^Nurofen Ibuprofen 400 mg/],
  ["DE", "PERSIL COLOR GEL 20WL    4,95 A", "swap", /^Persil Color Kraft-Gel/],
  ["DE", "PERSIL UNIVERSAL GEL 20WL 4,95 A", "swap", /^Persil Universal Kraft-Gel/],
  ["DE", "ZEWA ULTRA SOFT 4LAG 8 ROL 3,49 B", "swap", /^Zewa Toilettenpapier Ultra Soft/],
  ["DE", "COCA-COLA 1,25L          1,49 A", "swap", /^Coca-Cola Original/],
  ["DE", "BARILLA FUSILLI 500G     1,79 A", "swap", /^Barilla Fusilli/],
  ["DE", "PAMPERS BABY DRY GR. 5   9,95 A", "swap", /^Pampers Baby Dry Windeln Gr\. 5/],
  ["DE", "LOEWENSENF EXTRA SCHARF  1,29 A", "swap", /^Löwensenf Extra/],
  ["DE", "SOMAT 5IN1 KLARSPUELER 750ML", "swap", /^Somat 5in1 Klarspüler/],
  ["DE", "ASPIRIN 500MG 80 ST", "swap", /^Aspirin 500 mg/],
  // --- Germany: near misses and own-label
  ["DE", "COCA COLA ZERO 1,25L", "none"],
  ["DE", "PAMPERS BABY DRY GR. 6", "none"],
  ["DE", "NUROFEN 200MG 24ST", "none"],
  // --- Germany: a brand alone, with two Nurofen products on file (tablets 400 mg, Junior syrup 40 mg/ml)
  ["DE", "NUROFEN                  7,95 A", "choose", /^(?:Nurofen Ibuprofen 400 mg|NUROFEN Junior)/],
  ["DE", "NUROFEN 100ML", "swap", /^NUROFEN Junior/],
  // --- Germany: German pack words with the brand-only rule. "Stück", "Packung" and "Flasche" say nothing about which
  // product it is, so they never turn a question into a swap; a count or a volume they carry still narrows it.
  ["DE", "Nurofen 24 Stück", "swap", /^Nurofen Ibuprofen 400 mg/],
  ["DE", "Nurofen 400 mg 24 Stk.", "swap", /^Nurofen Ibuprofen 400 mg/],
  ["DE", "NUROFEN 100 ML FLASCHE", "swap", /^NUROFEN Junior/],
  ["DE", "Nurofen Packung", "choose", /^(?:Nurofen Ibuprofen 400 mg|NUROFEN Junior)/],
  ["DE", "BEN-U-RON 1000 MG", "choose", /^ben-u-ron 1\.?000 mg (?:Tabletten|Suppositorien)/],
  ["DE", "ben-u-ron 1000 mg 10 Tabletten", "swap", /^ben-u-ron 1\.000 mg Tabletten/],
  ["DE", "ben-u-ron 1000 mg Zäpfchen", "swap", /^ben-u-ron 1000 mg Suppositorien/],
  ["DE", "MILKA ALPENMILCH 100G", "none"],
  ["DE", "JA! H-MILCH 1,5% 1L", "own"],
];

test("at least 30 realistic lines across US, UK and German receipts", () => {
  assert.ok(CASES.length >= 30);
  for (const c of ["US", "GB", "DE"]) assert.ok(CASES.filter(([country]) => country === c).length >= 8, c);
  assert.ok(CASES.filter(([, , want]) => want === "none").length >= 12, "plenty of near misses");
});

for (const [country, line, want, product] of CASES) {
  test(`${country}: ${line.replace(/\s+/g, " ")} -> ${want}`, () => {
    const got = match(country, line);
    assert.equal(got.status, want, JSON.stringify(got));
    if (product && (got.status === "swap" || got.status === "maybe")) {
      assert.ok(isProduct(got.slug, product), `${got.slug} is not ${product}`);
    }
    if (product && got.status === "choose") {
      for (const slug of got.slugs) assert.ok(isProduct(slug, product), `${slug} is not ${product}`);
    }
  });
}

test("a matched swap is listed in the shopper's country, and is the biggest saving for that product", () => {
  for (const [country, line, want] of CASES) {
    if (want !== "swap") continue;
    const got = match(country, line) as Extract<LineMatch, { slug: string }>;
    const local = localFor(country);
    const pair = bySlug.get(got.slug)!;
    assert.ok(local.shows(pair), `${got.slug} isn't listed in ${country}`);
    const same = forCountry(pairs, local).filter((p) => p.brand.brand === pair.brand.brand && p.brand.product === pair.brand.product);
    assert.equal(got.others, same.length - 1);
    assert.equal(Math.max(...same.map((p) => p.savingsPct)), pair.savingsPct);
  }
});

test("a swap is never for a brand the line doesn't name", () => {
  const brandOn = (p: Pair, line: string) => {
    const w = new Set(words(line));
    const brand = words(p.brand.brand);
    return brand.every((b) => w.has(b)) || w.has(brand.join(""));
  };
  for (const [country, line] of CASES) {
    const got = match(country, line);
    if (got.status !== "swap") continue;
    const pair = bySlug.get(got.slug)!;
    // Löwensenf is written out as LOEWENSENF on German tills.
    assert.ok(brandOn(pair, line) || /LOEWENSENF/.test(line), `${line} -> ${pair.brand.brand}`);
  }
});

test("a whole receipt: one swap per product, noise counted, misses kept apart", () => {
  const text = [
    "TESCO STORES LTD",
    "NUROFEN 200MG 16S          £2.00 A",
    "2 x HEINZ TOM KETCHUP 460G £3.00",
    "HEINZ TOMATO KETCHUP 460G  £1.50",
    "FAIRY ORIGINAL W/UP 320ML  £1.25",
    "WARBURTONS TOASTIE 800G    £1.65",
    "Clubcard Price Saving     -£0.50",
    "SUBTOTAL                  £9.90",
    "VISA ************1234",
  ].join("\n");
  const { lines, noise } = matchReceipt(parseReceipt(text), indexFor("GB"));
  assert.equal(noise, 4);
  assert.deepEqual(
    lines.map((l) => l.status),
    ["choose", "swap", "swap", "none"],
    "the ketchup named twice shows once",
  );
});

test("every country can build its index, and a country we can't place falls back without error", () => {
  for (const c of ["US", "GB", "DE", "CA", "IE", "HR", "AU"]) {
    const index = indexFor(c);
    assert.ok(index.groups.length > 0, c);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// A line that names only a brand: a match only when exactly one product fits, otherwise a question listing those that do.

function candidate(slug: string, product: string, size: number, unit: string, amount: string, savingsPct = 40) {
  return toCandidate({
    slug,
    subcategory: "Pain relief",
    savingsPct,
    brand: { brand: "Painex", product, size, unit, key_ingredients: [{ name: "Ibuprofen", amount }] },
    alternative: { brand: "Own Label" },
  });
}
const painex = buildIndex([
  candidate("painex-200-tablets", "Painex Tablets 200mg 16s", 16, "tablet", "200 mg"),
  candidate("painex-200-capsules", "Painex Capsules 200mg 10s", 10, "capsule", "200 mg", 30),
  candidate("painex-400-tablets", "Painex Tablets 400mg 24s", 24, "tablet", "400 mg"),
  candidate("painex-junior", "Painex Junior Syrup 100mg/5ml 100ml", 100, "ml", "100 mg per 5 ml"),
]);
const painexLine = (line: string) => matchLine(parseReceipt(line)[0] as Extract<ParsedLine, { kind: "item" }>, painex);
const slugsOf = (m: LineMatch) => (m.status === "choose" ? [...m.slugs].sort() : []);

test("a bare brand with several products asks which one, listing every product of that brand", () => {
  const got = painexLine("PAINEX");
  assert.equal(got.status, "choose");
  assert.deepEqual(slugsOf(got), ["painex-200-capsules", "painex-200-tablets", "painex-400-tablets", "painex-junior"]);
});

test("a brand and a strength lists only the products of that strength", () => {
  const got = painexLine("PAINEX 200MG");
  assert.equal(got.status, "choose");
  assert.deepEqual(slugsOf(got), ["painex-200-capsules", "painex-200-tablets"]);
});

test("a brand and a strength only one product has is a swap, however many other products the brand has", () => {
  assert.deepEqual(painexLine("PAINEX 400MG"), { status: "swap", slug: "painex-400-tablets", others: 0 });
});

test("a pack size narrows the products of that strength to the one it fits", () => {
  assert.deepEqual(painexLine("PAINEX 200MG 10S"), { status: "swap", slug: "painex-200-capsules", others: 0 });
  // No 32-pack on file: the size rules nothing out, so both 200 mg products are still asked about.
  assert.equal(painexLine("PAINEX 200MG 32S").status, "choose");
});

test("a strength no product has is nothing on file, never a question about the others", () => {
  assert.deepEqual(painexLine("PAINEX 600MG"), { status: "none" });
});

test("a brand with one product on file, named alone, is that swap", () => {
  const one = buildIndex([candidate("painex-400-tablets", "Painex Tablets 400mg 24s", 24, "tablet", "400 mg")]);
  const got = matchLine(parseReceipt("PAINEX")[0] as Extract<ParsedLine, { kind: "item" }>, one);
  assert.deepEqual(got, { status: "swap", slug: "painex-400-tablets", others: 0 });
});

test("a brand alone whose one product is a variant (Junior) is only a did-you-mean, unless the pack size says it", () => {
  const one = buildIndex([candidate("painex-junior", "Painex Junior Syrup 100mg/5ml 100ml", 100, "ml", "100 mg per 5 ml")]);
  const line = (l: string) => matchLine(parseReceipt(l)[0] as Extract<ParsedLine, { kind: "item" }>, one);
  assert.deepEqual(line("PAINEX"), { status: "maybe", slug: "painex-junior", others: 0 });
  assert.deepEqual(line("PAINEX 100ML"), { status: "swap", slug: "painex-junior", others: 0 });
});

test("a brand spelt nearly right is never a swap, even with a strength only one product has", () => {
  assert.notEqual(painexLine("PAINAX 400MG").status, "swap");
  assert.equal(painexLine("PAINAX 200MG").status, "choose");
});

test("German pack words work with the brand-only rule: a count narrows the question, filler words never answer it", () => {
  // "Stück", "Stk." and "Packung" are a count or nothing; "Tabletten" and "Kapseln" are the product's form.
  assert.deepEqual(painexLine("PAINEX 200MG 10 Stück"), { status: "swap", slug: "painex-200-capsules", others: 0 });
  assert.deepEqual(painexLine("Painex 200 mg 10 Stk."), { status: "swap", slug: "painex-200-capsules", others: 0 });
  assert.deepEqual(painexLine("Painex 200 mg 10 Kapseln"), { status: "swap", slug: "painex-200-capsules", others: 0 });
  assert.deepEqual(painexLine("Painex 400 mg Filmtabletten 24 St"), { status: "swap", slug: "painex-400-tablets", others: 0 });
  // No 32-pack on file: still a question, about the 200 mg products only.
  assert.deepEqual(slugsOf(painexLine("PAINEX 200MG 32 Stück")), ["painex-200-capsules", "painex-200-tablets"]);
  // A filler word alone is still the brand alone.
  assert.deepEqual(slugsOf(painexLine("Painex Packung")), ["painex-200-capsules", "painex-200-tablets", "painex-400-tablets", "painex-junior"]);
  assert.deepEqual(slugsOf(painexLine("PAINEX 1 PACKUNG")), slugsOf(painexLine("PAINEX")));
});

test("the same brand-only question on two lines is asked once", () => {
  const { lines } = matchReceipt(parseReceipt("PAINEX 200MG\nPAINEX 200MG\nPAINEX 400MG"), painex);
  assert.deepEqual(lines.map((l) => l.status), ["choose", "swap"]);
});
