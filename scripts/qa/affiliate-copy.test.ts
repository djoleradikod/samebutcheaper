/** What the pages say about earning has to follow what the links really carry. */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { affiliateUrl, amazonEarns, linksEarn, mayEarn } from "../../src/lib/affiliate";

const NAMES = ["AMAZON_ASSOCIATE_TAG", "AMAZON_TAGS", "WALMART_AFFILIATE_TEMPLATE", "TARGET_AFFILIATE_TEMPLATE"];
// A tag exported in the shell mustn't fail the no-tag test.
beforeEach(() => NAMES.forEach((n) => delete process.env[n]));

const amazon = { retailer: "amazon", asin: "B000000000", url: "https://www.amazon.com/dp/B000000000" } as const;
const walmart = { retailer: "walmart", url: "https://www.walmart.com/ip/1" } as const;

test("with no tag set, no link earns and none is tagged", () => {
  assert.equal(linksEarn(), false);
  assert.equal(amazonEarns(), false);
  assert.equal(mayEarn(amazon), false);
  assert.equal(mayEarn(walmart), false);
  assert.ok(!affiliateUrl(amazon).includes("tag="));
});

test("empty values count as not set", () => {
  process.env.AMAZON_ASSOCIATE_TAG = "";
  process.env.AMAZON_TAGS = "amazon.de:, ";
  process.env.WALMART_AFFILIATE_TEMPLATE = "";
  assert.equal(linksEarn(), false);
  assert.equal(amazonEarns(), false);
});

test("a tag for one storefront only earns on that storefront", () => {
  process.env.AMAZON_TAGS = "amazon.de:mine-21";
  assert.equal(amazonEarns(), true);
  assert.equal(mayEarn(amazon, "DE"), true);
  assert.equal(mayEarn(amazon, "GB"), false);
  assert.ok(affiliateUrl(amazon, "DE").includes("tag=mine-21"));
  assert.ok(!affiliateUrl(amazon, "GB").includes("tag="));
});

test("an Amazon link under another retailer's name still follows its tag", () => {
  const record = { retailer: "costco", url: "https://www.amazon.com/s?k=batteries" } as const;
  assert.equal(mayEarn(record), false);
  process.env.AMAZON_ASSOCIATE_TAG = "mine-20";
  assert.equal(mayEarn(record), true);
});

test("an entry that isn't an Amazon storefront doesn't bring back Amazon's wording", () => {
  process.env.AMAZON_TAGS = ":mine-21,walmart.com:mine-21";
  assert.equal(amazonEarns(), false);
  assert.equal(linksEarn(), false);
});

test("a template without its {url} slot tags nothing, so it earns nothing", () => {
  process.env.WALMART_AFFILIATE_TEMPLATE = "https://goto.walmart.com/c/1/2/3";
  assert.equal(linksEarn(), false);
  assert.equal(mayEarn(walmart), false);
  process.env.WALMART_AFFILIATE_TEMPLATE = "https://goto.walmart.com/c/1/2/3?u={url}";
  assert.equal(linksEarn(), true);
  assert.equal(amazonEarns(), false);
  assert.equal(mayEarn(walmart), true);
});
