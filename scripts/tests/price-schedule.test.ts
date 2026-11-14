/**
 * When the deploy runs daily (scripts/ci/price-schedule.mjs, read by .github/workflows/deploy.yml) and the TypeScript
 * rule the site uses (src/lib/programme-terms.ts dailyStores) say the same thing. Made-up feed lines; nothing fetched.
 *
 *   npx tsx --test scripts/tests/price-schedule.test.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dailyStores as scheduleStores, feedLineStores as scheduleLines } from "../ci/price-schedule.mjs";
import { dailyStores, feedLineStores, joined, priceRuleOf } from "../../src/lib/programme-terms";
import { PROGRAMME_REGISTRY } from "../../src/lib/programmes";

const registry = JSON.parse(readFileSync("data/sellers/programmes.json", "utf8"));
const feedRuled = Object.keys(PROGRAMME_REGISTRY).filter((s) => priceRuleOf(s)?.only === "feed");
const apiRuled = Object.keys(PROGRAMME_REGISTRY).filter((s) => priceRuleOf(s)?.only === "api");
const unruled = ["zooplus", "shopapotheke", "chewy"].filter((s) => PROGRAMME_REGISTRY[s] && !priceRuleOf(s));

const cases: Record<string, string>[] = [
  {},
  { PRICE_FEED_URLS: "" },
  ...unruled.map((s) => ({ PRICE_FEED_URLS: `awin:${s}@DE=https://feed.example/a.csv` })),
  ...feedRuled.map((s) => ({ PRICE_FEED_URLS: `impact:${s}@US=https://SID:TOKEN@api.example/Items` })),
  // No network prefix (Awin by default), two lines, and the comma form.
  ...feedRuled.map((s) => ({ PRICE_FEED_URLS: `zooplus@DE=https://feed.example/z.csv\n${s}@US=https://feed.example/w.csv` })),
  ...feedRuled.map((s) => ({ PRICE_FEED_URLS: `zooplus@DE=https://feed.example/z.csv, impact:${s}@US=https://feed.example/w.csv` })),
  ...apiRuled.map((s) => ({ PRICE_FEED_URLS: `${s}@US=https://feed.example/a.csv` })),
  { PRICE_FEED_URLS: "not a feed line" },
];

test("the workflow's schedule script and the site agree on which feeds need a daily build", () => {
  assert.ok(feedRuled.length > 0, "a programme with a feed price rule in the registry");
  for (const env of cases) {
    assert.deepEqual(scheduleLines(env.PRICE_FEED_URLS), feedLineStores(env.PRICE_FEED_URLS), JSON.stringify(env));
    assert.deepEqual(scheduleStores(registry, env.PRICE_FEED_URLS), dailyStores(env), JSON.stringify(env));
  }
});

test("daily only with a feed for a store whose programme limits a price's age; weekly otherwise", () => {
  assert.deepEqual(dailyStores({}), []);
  for (const s of unruled) assert.deepEqual(dailyStores({ PRICE_FEED_URLS: `awin:${s}@DE=https://feed.example/a.csv` }), [], s);
  // An API rule can't be met by a feed, so a daily build would show nothing more.
  for (const s of apiRuled) assert.deepEqual(dailyStores({ PRICE_FEED_URLS: `${s}@US=https://feed.example/a.csv` }), [], s);
  for (const s of feedRuled) {
    assert.deepEqual(dailyStores({ PRICE_FEED_URLS: `impact:${s}@US=https://feed.example/w` }), [s], s);
    assert.ok(joined(s, { PRICE_FEED_URLS: `${s}@US=https://feed.example/w` }), `${s}: a line without a network prefix joins too`);
  }
});

test("the script prints daily=false with no feeds, and never a feed address", () => {
  const run = (feeds: string) => execFileSync(process.execPath, ["scripts/ci/price-schedule.mjs"], { env: { PATH: process.env.PATH, PRICE_FEED_URLS: feeds } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });
  assert.equal(run(""), "daily=false\nstores=\n");
  const s = feedRuled[0];
  const out = run(`impact:${s}@US=https://SID:SECRET-TOKEN@api.example/Items`);
  assert.equal(out, `daily=true\nstores=${s}\n`);
  assert.doesNotMatch(out, /SECRET|api\.example/);
});
