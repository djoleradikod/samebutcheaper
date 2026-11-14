/**
 * Launch checks for affiliate programme terms (src/lib/readiness-terms.ts): PROGRAMME_TERMS_OFF, the daily price
 * refresh a 24-hour price rule needs, and terms that bar something the site still does. Fake clock, no network.
 *
 *   npx tsx --test scripts/tests/readiness-terms.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { termsBuildFacts, termsChecks, type TermsBuild } from "../../src/lib/readiness-terms";
import type { Catalog } from "../../src/lib/types";

const catalog = catalogJson as unknown as Catalog;
const NOW = Date.parse("2026-11-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const build = (over: Partial<TermsBuild> = {}): TermsBuild => ({ generatedAt: hoursAgo(1), termsOff: null, fedStores: [], dupeSwaps: {}, served: true, ...over });
const check = (id: string, env: Record<string, string>, b?: TermsBuild, aff: Record<string, string> = {}) => termsChecks(env, aff, b, NOW).find((c) => c.id === id)!;
const WALMART = { AFF_WALMART_US: "https://goto.walmart.com/c/1/2/3" };
const WALMART_FEED = { PRICE_FEED_URLS: "impact:walmart@US=https://SID:TOKEN@api.example/Items" };

test("PROGRAMME_TERMS_OFF warns, whether set here or when the catalogue was built", () => {
  assert.equal(check("programme-terms-off", {}, build()).ok, true);
  const here = check("programme-terms-off", { PROGRAMME_TERMS_OFF: "walmart" }, build());
  assert.equal(here.ok, false);
  assert.equal(here.level, "recommended");
  assert.equal(check("programme-terms-off", {}, build({ termsOff: "all" })).ok, false);
});

test("nothing joined with a price-age rule: the daily refresh isn't needed", () => {
  const c = check("daily-prices", { AWIN_PUBLISHER_ID: "1", AFF_SHOPAPOTHEKE: "1" }, build());
  assert.equal(c.ok, true);
  assert.equal(c.level, "optional");
});

test("a joined 24-hour programme with no feed, or a running build over a day old, fails the launch", () => {
  const noFeed = check("daily-prices", {}, build(), WALMART);
  assert.equal(noFeed.ok, false);
  assert.equal(noFeed.level, "blocker");
  assert.match(noFeed.detail, /no feed/);

  // On the command line (not the served build) a feed line is enough.
  assert.equal(check("daily-prices", WALMART_FEED, build({ served: false })).ok, true);
  // The running site: fed and built an hour ago passes; built 30 hours ago means the daily deploy isn't running.
  assert.equal(check("daily-prices", {}, build({ fedStores: ["walmart"] }), WALMART).ok, true);
  const stale = check("daily-prices", {}, build({ fedStores: ["walmart"], generatedAt: hoursAgo(30) }), WALMART);
  assert.equal(stale.ok, false);
  assert.match(stale.detail, /30 hours old/);
  // Joined and the feed line set, but the running build priced nothing from it.
  assert.equal(check("daily-prices", WALMART_FEED, build(), WALMART).ok, false);
  // A price from the store's own feed proves membership even without its AFF_ setting.
  assert.equal(check("daily-prices", {}, build({ fedStores: ["walmart"], generatedAt: hoursAgo(40) })).ok, false);
});

test("a programme whose prices come only from its API: withheld for good, said but not blocking", () => {
  const c = check("daily-prices", {}, build(), { AMAZON_ASSOCIATE_TAG: "sbc-20" });
  assert.equal(c.ok, true);
  assert.equal(c.level, "recommended");
  assert.match(c.detail, /API/);
});

test("a joined programme's terms that bar something the site does are reported, not acted on", () => {
  const facts = termsBuildFacts(catalog, false);
  assert.ok((facts.dupeSwaps.walmart ?? 0) > 0, "Walmart swaps are listed under /dupe/");
  assert.equal(check("terms-conflicts", {}, facts).ok, true, "not joined: nothing to report");
  const c = check("terms-conflicts", {}, facts, WALMART);
  assert.equal(c.ok, false);
  assert.equal(c.level, "recommended");
  assert.match(c.detail, new RegExp(`"dupe".*${facts.dupeSwaps.walmart} swaps`));
});
