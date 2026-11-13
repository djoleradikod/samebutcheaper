/**
 * Matching against SYNTHETIC store feeds built from the real catalogue (scripts/prices/fixtures/make-feed-fixtures.ts):
 * a decoy per side (same brand and words, twice the pack, other barcode and number) and unrelated rows must never
 * match, and every store whose records carry barcodes or store numbers must get matches. The per-store table is
 * `npx tsx scripts/prices/feed-report.ts`. Reads the real catalogue, writes nothing.
 *
 *   npx tsx --test scripts/tests/feeds-match.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchRates, rateTable } from "../prices/feed-report";

test("synthetic store feeds from real records: no wrong match, decoys never taken, every store with numbers matched", async () => {
  const rates = await matchRates();
  assert.equal(rates.length, 9);
  for (const r of rates) {
    assert.deepEqual(r.wrong, [], `${r.store}: wrong matches`);
    if (r.withGtin + r.withNumber > 0) assert.ok(r.gtin + r.id > 0, `${r.store}: nothing matched automatically`);
    assert.ok(r.gtin + r.id + r.name + r.none === r.sides, `${r.store}: every side is counted once`);
  }
  assert.match(rateTable(rates), /0 wrong\.$/);
});
