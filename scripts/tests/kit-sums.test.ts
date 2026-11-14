/**
 * The kit box's rows add up (src/components/KitSums.tsx): the kit, less the same amount rebuilt, less any extra delivery,
 * is the saving the hero shows. And a card titled by brand alone also names the product (src/lib/product-detail.ts).
 *
 *   npm run catalog && npx tsx --test scripts/tests/kit-sums.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { kitFor } from "../../src/lib/delivery-abroad";
import { productDetail } from "../../src/lib/product-detail";
import type { Catalog } from "../../src/lib/types";

const { bundles } = catalog as unknown as Catalog;

test("every kit's rows add up to its saving, at home and delivered abroad", () => {
  assert.ok(bundles.length > 0);
  for (const record of bundles) {
    for (const country of [null, "AT", "IE", "FR"]) {
      const b = kitFor(record, country);
      // A rebuild that costs more than the kit shows no saving rather than a negative one, and says so in a caution.
      if (b.bundle.price - b.equivalentTotal - (b.extraDelivery ?? 0) <= 0) {
        assert.equal(b.netSavings, 0, b.slug);
        continue;
      }
      const sum = b.bundle.price - b.equivalentTotal - (b.extraDelivery ?? 0);
      assert.ok(Math.abs(sum - b.netSavings) <= 0.011, `${b.slug} (${country}): ${b.bundle.price} - ${b.equivalentTotal} - ${b.extraDelivery} is not ${b.netSavings}`);
    }
  }
});

test("the product line drops the brand's own words and is empty when the product is only the brand", () => {
  assert.equal(productDetail("Nurofen", "Nurofen Pain Relief Soft Capsules 200mg 16s"), "Pain Relief Soft Capsules 200mg 16s");
  assert.equal(productDetail("Nurofen", "NUROFEN Junior Fieber- und Schmerzsaft"), "Junior Fieber- und Schmerzsaft");
  assert.equal(productDetail("Tylenol", "Children's Tylenol Pain + Fever"), "Children's Tylenol Pain + Fever");
  assert.equal(productDetail("Persil", "Persil"), null);
  assert.equal(productDetail("Fairy", "Fairy, "), null);
});

test("three Nurofen swaps in one market no longer read the same on their cards", () => {
  const nurofen = (catalog as unknown as Catalog).pairs.filter((p) => p.market === "GB" && p.brand.brand === "Nurofen");
  assert.ok(nurofen.length >= 2);
  const lines = nurofen.map((p) => productDetail(p.brand.brand, p.brand.product));
  assert.equal(new Set(lines).size, lines.length);
});
