/**
 * Product codes on records (src/lib/gtin.ts): check digits, the schema refusing a bad code, one code per pack, and
 * the feed matcher using a PZN and leaving per-amount sides alone.
 *
 *   npx tsx --test scripts/tests/gtin.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { gtin14, gtinConflicts, isGtin, isPzn, pricedPerAmount, pznFromLicence } from "../../src/lib/gtin";
import { normalizeUnit, pairSchema } from "../../src/lib/schema";
import { FeedMatcher } from "../prices/feeds/match";
import type { FeedRow } from "../prices/feeds/row";
import { recordsFromPairFile } from "../prices/records";

test("GTIN check digits: EAN-13, UPC-A, EAN-8 and GTIN-14, nothing else", () => {
  assert.ok(isGtin("4104420234710"), "Alnatura olive oil, EAN-13");
  assert.ok(isGtin("030000010402"), "Quaker oats, UPC-A");
  assert.ok(isGtin("0030000010402"), "the same UPC-A written as EAN-13");
  assert.ok(isGtin("20005689"), "EAN-8");
  assert.ok(isGtin("00012345678905"), "GTIN-14");
  assert.ok(!isGtin("4104420234711"), "one digit off");
  assert.ok(!isGtin("01346604"), "an Open Food Facts internal code, not a barcode");
  assert.ok(!isGtin("1234567890"), "10 digits");
  assert.ok(!isGtin("41044202347a0"));
  assert.equal(gtin14("030000010402"), gtin14("0030000010402"));
});

test("PZN: 8 digits with the mod-11 check, read from a licence number", () => {
  assert.ok(isPzn("02195485"));
  assert.ok(isPzn("17502496"), "the PZN in a Shop Apotheke address");
  assert.ok(!isPzn("02195486"));
  assert.ok(!isPzn("2195485"), "7 digits must be written with the leading 0");
  assert.equal(pznFromLicence("PZN 02195485"), "02195485");
  assert.equal(pznFromLicence("PZN 2195485"), "02195485");
  assert.equal(pznFromLicence("PL 00063/0375"), null);
  assert.equal(pznFromLicence("PZN 02195486"), null);
});

const base = {
  slug: "test-brand-vs-test-own",
  market: "US",
  category: "otc-medicine",
  subcategory: "Pain relief",
  title: "Test",
  match_type: "identical_active",
  confidence: "high",
  summary: "Same active ingredient.",
  evidence: "Both labels read 200 mg.",
  sources: ["https://example.org/a", "https://example.org/b"],
  price_checked: "2026-11",
};
const side = (over: Record<string, unknown>) => ({ brand: "B", product: "B 100 tablets", size: 100, unit: "tablet", price: 5, retailer: "walmart", url: "https://example.org/p", ...over });

test("the schema fails a record with a wrong check digit instead of dropping the code", () => {
  const ok = pairSchema.safeParse({ ...base, brand: side({ gtin: "0030000010402" }), alternative: side({ price: 2, gtin: null }) });
  assert.ok(ok.success);
  const bad = pairSchema.safeParse({ ...base, brand: side({ gtin: "0030000010403" }), alternative: side({ price: 2 }) });
  assert.ok(!bad.success);
  assert.match(bad.error!.issues[0].message, /check digit/);
  const pzn = pairSchema.safeParse({ ...base, brand: side({ pzn: "02195486" }), alternative: side({ price: 2 }) });
  assert.ok(!pzn.success, "a PZN with a wrong check digit fails too");
});

test("one barcode is one pack: a code on two sizes of the same unit is an error", () => {
  const found = gtinConflicts(
    [
      { where: "a brand", gtin: "3182550702447", product: "Royal Canin Kitten, 4 kg", size: 4, unit: "kg" },
      { where: "b brand", gtin: "3182550702447", product: "Royal Canin Kitten, 2 kg", size: 2, unit: "kg" },
      // The same roll counted in sheets on one record and in square metres on another is fine.
      { where: "c brand", gtin: "0030000010402", product: "Roll", size: 400, unit: "sheets" },
      { where: "d brand", gtin: "030000010402", product: "Roll", size: 19.36, unit: "square metre" },
      { where: "e brand", gtin: "030000010402", product: "Roll", size: 400, unit: "sheet" },
      // A side priced per wash names the product, not a pack.
      { where: "f brand", gtin: "4104420234710", product: "Persil, price per wash", size: 1, unit: "wash" },
      { where: "g brand", gtin: "4104420234710", product: "Persil 20 washes", size: 20, unit: "wash" },
    ],
    normalizeUnit,
  );
  assert.equal(found.length, 1);
  assert.match(found[0], /3182550702447.*a brand \(4 kg\).*b brand \(2 kg\)/);
  assert.ok(pricedPerAmount("Lenor Universalwaschmittel, price per wash"));
  assert.ok(pricedPerAmount("4Paws Softbrocken, cost per day (mid-range)"));
  assert.ok(!pricedPerAmount("Nurofen For Children 100ml"));
});

const row = (over: Partial<FeedRow>): FeedRow => ({
  retailer: "aponeo",
  market: "DE",
  name: "",
  brand: null,
  gtins: [],
  skus: [],
  price: 1,
  currency: "EUR",
  packText: null,
  inStock: true,
  deepLink: null,
  productUrl: null,
  imageUrl: null,
  updated: null,
  merchant: null,
  ...over,
});

test("feeds: a pharmacy row matches by the PZN the record's licence number gives; per-amount sides are never matched", () => {
  const pairs = [
    {
      slug: "formigran-vs-naratriptan-de",
      market: "DE",
      price_checked: "2026-11",
      brand: { brand: "Formigran", product: "Formigran 2 Tabletten", size: 2, unit: "tablet", price: 7.5, retailer: "aponeo", url: "https://www.aponeo.de/formigran", license_id: "PZN 02195485" },
      alternative: { brand: "Heumann", product: "Naratriptan Heumann 2 Tabletten", size: 2, unit: "tablet", price: 4.2, retailer: "aponeo", url: "https://www.aponeo.de/naratriptan", license_id: "PZN 09542263" },
    },
    {
      slug: "persil-vs-denkmit-de",
      market: "DE",
      price_checked: "2026-11",
      brand: { brand: "Persil", product: "Persil Megaperls, price per wash", size: 1, unit: "wash", price: 0.3, retailer: "aponeo", url: "https://www.aponeo.de/persil", gtin: "5410091757830" },
      alternative: { brand: "Denkmit", product: "Denkmit, price per wash", size: 1, unit: "wash", price: 0.1, retailer: "aponeo", url: "https://www.aponeo.de/denkmit" },
    },
  ];
  const records = recordsFromPairFile("/data/pairs/de.json", JSON.stringify(pairs));
  assert.equal(records[0].sides[0].pzn, "02195485");
  const m = new FeedMatcher(records, { retailer: "aponeo", market: "DE" });
  assert.equal(m.sideCount, 2, "the two per-wash sides are left out");
  m.add(row({ name: "Formigran", skus: ["PZN 02195485"], price: 7.2 }));
  m.add(row({ name: "Naratriptan", skus: ["9542263"], price: 4.1 }));
  m.add(row({ name: "Persil 20 WL", gtins: ["5410091757830"], price: 5.99 }));
  const found = m.result().matches.map((x) => `${x.record.slug}:${x.side.side}:${x.by}:${x.row.price}`).sort();
  assert.deepEqual(found, ["formigran-vs-naratriptan-de:alternative:id:4.1", "formigran-vs-naratriptan-de:brand:id:7.2"]);
});
