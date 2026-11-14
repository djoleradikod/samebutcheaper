/**
 * Price watches respect each affiliate programme's terms (data/sellers/programmes.json `terms`, src/lib/watch-terms.ts):
 * Walmart's terms bar price alerts for Walmart products, so a Walmart price is never watched. Database runs are in
 * scripts/tests/loops.test.ts.
 *
 *   npx tsx --test scripts/tests/watch-terms.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { PROGRAMME_REGISTRY } from "../../src/lib/programmes";
import { barredSide, watchTerms } from "../../src/lib/watch-terms";
import { pricesOf, watchChange, watchMail } from "../../src/lib/watches";
import type { Catalog } from "../../src/lib/types";

const { pairs } = catalogJson as unknown as Catalog;

test("only programmes whose own terms page the registry cites restrict watches", () => {
  const restricted = Object.entries(PROGRAMME_REGISTRY).filter(([, e]) => e.terms?.priceAlerts === false);
  assert.deepEqual(restricted.map(([store]) => store), ["walmart"]);
  for (const [store, e] of restricted) {
    const host = new URL(e.terms!.source).hostname;
    assert.ok(host.endsWith(`${store}.com`), `${store}: the terms come from the programme's own site, not ${host}`);
    assert.match(e.terms!.quote, /price alert/i);
  }
});

test("a Walmart US price is barred; walmart.ca (another programme) and other stores are not", () => {
  assert.deepEqual(barredSide({ retailer: "walmart", url: "https://www.walmart.com/ip/1" }, "US")?.store, "walmart");
  assert.equal(barredSide({ retailer: "walmart", url: "https://www.walmart.ca/en/ip/1" }, "CA"), null);
  assert.equal(barredSide({ retailer: "target", url: "https://www.target.com/p/1" }, "US"), null);
  assert.equal(barredSide({ retailer: "tesco", url: "https://www.tesco.com/groceries/1" }, "GB"), null);
  // A Walmart page reached through Amazon's address is Amazon's price.
  assert.equal(barredSide({ retailer: "walmart", url: "https://www.amazon.com/dp/B0" }, "US"), null);
  const walmartAlt = pairs.filter((p) => p.market === "US" && p.alternative.retailer === "walmart");
  assert.ok(walmartAlt.length > 0);
  for (const p of walmartAlt) if (!p.alternative.url?.includes("amazon.")) assert.ok(watchTerms(p).alternative, p.slug);
  for (const p of pairs.filter((p) => p.market !== "US")) assert.deepEqual(watchTerms(p), { alternative: null, brand: null }, p.slug);
});

test("with the brand's price barred, a watch follows the cheaper price alone and its email leaves the saving out", () => {
  const pair = pairs.find((p) => watchTerms(p).brand && !watchTerms(p).alternative)!;
  assert.ok(pair, "a US swap with only the brand at Walmart");
  const before = pricesOf(pair);
  assert.equal(watchChange(before, { ...before, savingsPct: 1 }, { saving: false }), null, "a saving drop alone writes nothing");
  assert.ok(watchChange(before, { ...before, savingsPct: 1 }), "it would, without the bar");
  const now = { ...before, altPpu: before.altPpu * 1.2 };
  const change = watchChange(before, now, { saving: false })!;
  const mail = watchMail(
    { to: "a@example.com", token: "t".repeat(43), watchId: 1, title: pair.title, slug: pair.slug, country: "US", before, change, pair },
    { siteUrl: "https://samebutcheaper.test", contactEmail: "hello@samebutcheaper.test" },
  );
  assert.match(mail.text, /20%/);
  assert.ok(!mail.text.includes(`cheaper than ${pair.brand.brand}`), mail.text);
  assert.ok(mail.headers["List-Unsubscribe"], "still carries the list headers");
});
