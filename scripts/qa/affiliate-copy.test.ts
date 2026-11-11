/** What the pages say about earning has to follow what the links really carry. */
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { affiliateUrl, amazonEarns, linksEarn, mayEarn } from "../../src/lib/affiliate";
import { AFFILIATE_ENV_PATTERN, resetAffiliateEnv } from "../../src/lib/affiliate-links";

// A tag exported in the shell mustn't fail the no-tag test, and the settings are read once and kept, so each
// case starts from a clean environment and a fresh read.
beforeEach(() => {
  for (const n of Object.keys(process.env)) if (AFFILIATE_ENV_PATTERN.test(n) || n === "AFFILIATE_CONFIG") delete process.env[n];
  resetAffiliateEnv();
});
/** Sets affiliate settings the way a build would, then makes the next read pick them up. */
function configure(values: Record<string, string>) {
  Object.assign(process.env, values);
  resetAffiliateEnv();
}

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
  configure({ AMAZON_ASSOCIATE_TAG: "", AMAZON_TAGS: "amazon.de:, ", WALMART_AFFILIATE_TEMPLATE: "" });
  assert.equal(linksEarn(), false);
  assert.equal(amazonEarns(), false);
});

test("a tag for one storefront only earns on that storefront", () => {
  configure({ AMAZON_TAGS: "amazon.de:mine-21" });
  assert.equal(amazonEarns(), true);
  assert.equal(mayEarn(amazon, "DE"), true);
  assert.equal(mayEarn(amazon, "GB"), false);
  assert.ok(affiliateUrl(amazon, "DE").includes("tag=mine-21"));
  assert.ok(!affiliateUrl(amazon, "GB").includes("tag="));
});

test("an Amazon link under another retailer's name still follows its tag", () => {
  const record = { retailer: "costco", url: "https://www.amazon.com/s?k=batteries" } as const;
  assert.equal(mayEarn(record), false);
  configure({ AMAZON_ASSOCIATE_TAG: "mine-20" });
  assert.equal(mayEarn(record), true);
});

test("an entry that isn't an Amazon storefront doesn't bring back Amazon's wording", () => {
  configure({ AMAZON_TAGS: ":mine-21,walmart.com:mine-21" });
  assert.equal(amazonEarns(), false);
  assert.equal(linksEarn(), false);
});

test("a Walmart value that is neither a template nor an Impact tracking link tags nothing, so it earns nothing", () => {
  configure({ WALMART_AFFILIATE_TEMPLATE: "goto.walmart.com/c/1/2/3" });
  assert.equal(linksEarn(), false);
  assert.equal(mayEarn(walmart), false);
  configure({ WALMART_AFFILIATE_TEMPLATE: "https://goto.walmart.com/c/1/2/3?u={url}" });
  assert.equal(linksEarn(), true);
  assert.equal(amazonEarns(), false);
  assert.equal(mayEarn(walmart), true);
});

test("an Impact tracking link works as copied from the dashboard, without a {url} slot", () => {
  configure({ AFF_WALMART_US: "https://goto.walmart.com/c/1/2/3" });
  assert.equal(mayEarn(walmart), true);
  const link = new URL(affiliateUrl(walmart));
  assert.equal(link.hostname, "goto.walmart.com");
  assert.equal(link.searchParams.get("u"), walmart.url);
});
