/**
 * Reading a pasted shopping list or receipt into product lines, and the share link and yearly count of the result.
 *
 *   npx tsx --test scripts/tests/receipt-parse.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_LINES, MAX_TEXT, parseReceipt, words, type ParsedLine } from "../../src/lib/receipt/parse";
import { countSwap, parseShare, shareValue, SHARE_MAX, type Countable } from "../../src/lib/receipt/total";
import { NO_CHOICES, packSaving, withChoice } from "../../src/lib/yearly";
import { normaliseQuery } from "../../src/lib/wanted";

type Item = Extract<ParsedLine, { kind: "item" }>;
const one = (line: string) => parseReceipt(line)[0];
const item = (line: string) => {
  const p = one(line);
  assert.equal(p?.kind, "item", `${line} should be a product line`);
  return p as Item;
};

test("prices, quantities, sizes, codes and tax letters come off; brand, product and strength stay", () => {
  const cases: [string, string][] = [
    ["NUROFEN 200MG 16S          £2.00 A", "NUROFEN 200mg"],
    ["2 x HEINZ TOM KETCHUP 460G   3.00", "HEINZ TOM KETCHUP"],
    ["FAIRY ORIGINAL W/UP 320ML  1.25", "FAIRY ORIGINAL W/UP"],
    ["TYLENOL EX STR CPLT 500MG 225CT 13.97 X", "TYLENOL EX STR CPLT 500mg"],
    ["PERSIL COLOR GEL 20WL 4,95 A", "PERSIL COLOR GEL"],
    ["Coca-Cola 1,25L 1,49 A", "Coca-Cola"],
    ["HEINEKEN 0.0 12 x 330ml £11.00", "HEINEKEN 0.0"],
    ["0049000028911 COKE ZERO 12PK 6.98", "COKE ZERO"],
    ["Clarityn Allergy 30s", "Clarityn Allergy"],
    ["- Pampers Baby Dry Gr. 5", "Pampers Baby Dry Gr. 5"],
    ["ASPIRIN 500MG 80 ST", "ASPIRIN 500mg"],
    ["VITAMIN C 1000MG", "VITAMIN C 1000mg"],
  ];
  for (const [line, query] of cases) assert.equal(item(line).query, query, line);
});

test("strengths and pack sizes are read apart, in one written form", () => {
  assert.deepEqual(item("NUROFEN 200 MG 16S").strengths, ["200mg"]);
  assert.deepEqual(item("NUROFEN 200MG 16S").sizes, [{ amount: 16, unit: "count" }]);
  assert.deepEqual(item("HEINZ TOM KETCHUP 460G").sizes, [{ amount: 460, unit: "g" }]);
  assert.deepEqual(item("Coca-Cola 1,25L").sizes, [{ amount: 1250, unit: "ml" }]);
  assert.deepEqual(item("HEINEKEN 0.0 12 x 330ml").sizes, [{ amount: 3960, unit: "ml" }]);
  assert.deepEqual(item("TIDE ORIGINAL LIQ 132 FL OZ").sizes, [{ amount: 132, unit: "oz" }]);
  assert.deepEqual(item("NUROFEN FOR CHILDREN 100MG/5ML").strengths, ["100mg"]);
  assert.deepEqual(item("OTRIVEN 0,1% NASENSPRAY").strengths, ["0.1%"]);
});

test("abbreviations, umlauts, plurals and sizes of nappy read the same on a receipt and in the catalogue", () => {
  assert.deepEqual(words("TYLENOL EX STR CPLT"), ["tylenol", "extra", "strength", "tablet"]);
  assert.deepEqual(words("Tylenol Extra Strength Caplets"), ["tylenol", "extra", "strength", "tablet"]);
  assert.deepEqual(words("Hellmann's Real Mayonnaise"), ["hellmann", "real", "mayo"]);
  assert.deepEqual(words("HELLMANNS REAL MAYO"), ["hellmann", "real", "mayo"]);
  assert.deepEqual(words("Pampers Baby-Dry size 4"), words("PAMPERS BABY DRY SZ4"));
  assert.deepEqual(words("Pampers Baby Dry Windeln Gr. 5"), ["pamper", "baby", "dry", "windeln", "size5"]);
  assert.deepEqual(words("Fairy Washing Up Liquid"), words("FAIRY W/UP LIQ"));
  assert.deepEqual(words("Weißer Riese"), ["weisser", "riese"]);
  assert.deepEqual(words("Klarspüler"), ["klarspuler"]);
  assert.deepEqual(words("Nurofen 200mg Tabletten"), words("NUROFEN 200MG TABS"));
});

test("totals, VAT, payments, loyalty, deposits, dates, weighed items and headings are not products", () => {
  const noise = [
    "SUBTOTAL 18.75",
    "TOTAL £10.90",
    "VAT 20% 1.20",
    "TAX 1  2.81",
    "BALANCE DUE 45.02",
    "VISA ************1234",
    "Kartenzahlung girocard",
    "Summe EUR 12,34",
    "MwSt 19% 1,23",
    "Pfand 0,25",
    "Clubcard Price Saving -£0.50",
    "Nectar points 120",
    "Lidl Plus Rabatt -0,30",
    "Payback Punkte 12",
    "0.456 kg @ £1.20/kg",
    "BANANAS 2.27 LB @ 0.58/LB",
    "13/11/2026 14:32",
    "THANK YOU FOR SHOPPING",
    "TESCO STORES LTD",
    "REWE Markt GmbH",
    "Tel. 030 1234567",
    "DAIRY",
    "Einkaufsliste:",
    "*** 12 ITEMS ***",
    "1.99",
    "-0.50",
  ];
  for (const line of noise) assert.equal(one(line)?.kind, "noise", line);
});

test("a whole receipt: products in order, noise counted, empty lines skipped", () => {
  const text = ["TESCO STORES LTD", "", "NUROFEN 200MG 16S  £2.00", "BANANAS LOOSE", "  ", "SUBTOTAL 3.10", "VISA ****1234"].join("\n");
  const parsed = parseReceipt(text);
  assert.deepEqual(
    parsed.map((p) => [p.kind, p.index]),
    [["noise", 0], ["item", 2], ["item", 3], ["noise", 5], ["noise", 6]],
  );
});

test("long pastes are cut to what we read, and a line is never kept whole past 120 characters", () => {
  const many = Array.from({ length: MAX_LINES + 50 }, (_, i) => `PRODUCT NUMBER ${String.fromCharCode(65 + (i % 26))}XYZ`).join("\n");
  assert.ok(parseReceipt(many).length <= MAX_LINES);
  const huge = "A".repeat(MAX_TEXT * 2);
  const parsed = parseReceipt(`${huge}\nNUROFEN`);
  assert.ok(parsed.every((p) => p.text.length <= 120));
});

test("what a miss would count holds no price, quantity, code or card number", () => {
  const lines = ["2 x WARBURTONS TOASTIE 800G £1.65 A", "0049000028911 COKE ZERO 12PK 6.98", "ZZ UNKNOWN BRAND 12345678 £3.00"];
  for (const line of lines) {
    const q = normaliseQuery(item(line).query);
    assert.ok(q, line);
    assert.doesNotMatch(q!, /£|\d[.,]\d\d|\d{5,}/, `${line} -> ${q}`);
  }
  assert.equal(normaliseQuery(item("2 x WARBURTONS TOASTIE 800G £1.65 A").query), "warburtons toastie");
});

// ---------------------------------------------------------------------------------------------------------------------

const PRICES = { brandPrice: 2, brandSize: 16, altPrice: 0.5, altSize: 16 };
const swap = (slug: string, kind: "yearly" | "once" | "per-amount" = "yearly"): Countable => ({
  slug,
  savings: packSaving(PRICES),
  currency: "GBP",
  yearly: { kind, prices: PRICES },
});

test("the yearly count follows yearly.ts: monthly assumed until chosen, a one-off once, per-amount not at all", () => {
  assert.deepEqual(countSwap(swap("a"), NO_CHOICES), { how: "yearly", amount: 18, often: "1m", chosen: false });
  assert.deepEqual(countSwap(swap("a"), withChoice(NO_CHOICES, "a", "1w")), { how: "yearly", amount: 78, often: "1w", chosen: true });
  // The last choice made anywhere stands in, still as an assumption.
  assert.deepEqual(countSwap(swap("b"), withChoice(NO_CHOICES, "a", "2m")), { how: "yearly", amount: 9, often: "2m", chosen: false });
  assert.deepEqual(countSwap(swap("c", "once"), NO_CHOICES), { how: "once", amount: 1.5 });
  assert.deepEqual(countSwap(swap("d", "per-amount"), NO_CHOICES), { how: "per-amount" });
});

test("a frequency from a shared link counts as chosen, until the viewer picks their own", () => {
  assert.deepEqual(countSwap(swap("a"), NO_CHOICES, "3m"), { how: "yearly", amount: 6, often: "3m", chosen: true });
  assert.deepEqual(countSwap(swap("a"), withChoice(NO_CHOICES, "a", "1y"), "3m"), { how: "yearly", amount: 1.5, often: "1y", chosen: true });
});

test("the share link carries slugs and frequencies only, and reads back what exists", () => {
  const value = shareValue([
    { slug: "nurofen-vs-tesco-health-ibuprofen-200mg-gb", often: "1m" },
    { slug: "pg-tips-original-vs-sainsburys-red-label-tea-bags-gb", often: null },
  ]);
  assert.equal(value, "nurofen-vs-tesco-health-ibuprofen-200mg-gb.1m~pg-tips-original-vs-sainsburys-red-label-tea-bags-gb");
  const known = new Set(["nurofen-vs-tesco-health-ibuprofen-200mg-gb", "pg-tips-original-vs-sainsburys-red-label-tea-bags-gb"]);
  const exists = (s: string) => known.has(s);
  assert.deepEqual(parseShare(value, exists), [
    { slug: "nurofen-vs-tesco-health-ibuprofen-200mg-gb", often: "1m" },
    { slug: "pg-tips-original-vs-sainsburys-red-label-tea-bags-gb", often: null },
  ]);
  // Unknown slugs, bad frequencies, repeats and anything that isn't a slug are dropped.
  assert.deepEqual(
    parseShare("nurofen-vs-tesco-health-ibuprofen-200mg-gb.9x~nurofen-vs-tesco-health-ibuprofen-200mg-gb~no-such-swap~<script>~", exists),
    [{ slug: "nurofen-vs-tesco-health-ibuprofen-200mg-gb", often: null }],
  );
  assert.deepEqual(parseShare(null, exists), []);
  const lots = Array.from({ length: SHARE_MAX + 10 }, (_, i) => `s${i}`);
  assert.equal(parseShare(lots.join("~"), () => true).length, SHARE_MAX);
});
