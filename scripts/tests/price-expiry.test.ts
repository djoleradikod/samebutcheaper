/**
 * Time-limited prices (src/lib/programme-terms.ts priceLimit, src/lib/price-expiry.ts, src/lib/price-clock.ts): a
 * price a programme allows for 24 hours after its feed was read shows for that long, then is withheld by itself, with
 * no build. No feed exists yet, so these use made-up feed readings and a fake clock; nothing here fetches anything.
 *
 *   npx tsx --test scripts/tests/price-expiry.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { PROGRAMME_REGISTRY } from "../../src/lib/programmes";
import { feedStores, priceLimit, priceWithheld, readAt, rulesFor, termsOff } from "../../src/lib/programme-terms";
import { EXPIRY_MARGIN_MS, expireCatalog, expiryMoments, nextExpiry } from "../../src/lib/price-expiry";
import { catalogNow, priceClock, resetPriceClock, setPriceClock } from "../../src/lib/price-clock";
import { applyProgrammeTerms } from "../programme-terms";
import type { Catalog, Pair, Preset } from "../../src/lib/types";

const catalog = catalogJson as unknown as Catalog;
const ON = new Set<string>();
const HOUR = 3_600_000;

/** A store whose programme allows prices only from its own feed, for a number of hours. */
const [store, entry] = Object.entries(PROGRAMME_REGISTRY).find(([, e]) => e.terms?.prices?.only === "feed")!;
const maxAge = entry.terms!.prices!.maxAgeHours;
const market = entry.markets[0];
const side = { retailer: store, url: `https://www.${store}.com/ip/1` };
const READ = "2026-11-14T05:20:00.000Z";
const read = Date.parse(READ);
const iso = (ms: number) => new Date(ms).toISOString();
const seen = (at: string | null = READ, network: string = entry.network) => ({
  date: at?.slice(0, 10) ?? "2026-11-01",
  precision: "day" as const,
  history: [],
  feed: { network, seen: (at ?? READ).slice(0, 10), stock: "in" as const, ...(at ? { at } : {}) },
});

test("a feed price shows until its reading is maxAgeHours old, counted from the hour it was read", () => {
  assert.ok(maxAge > 0);
  const r = priceLimit(side, seen(), market, iso(read + HOUR), ON);
  assert.ok(r && "limited" in r, "shown, with a limit");
  assert.equal(r.limited.until, iso(read + maxAge * HOUR));
  assert.equal(r.limited.store, store);
  assert.ok(priceWithheld(side, seen(), market, iso(read + maxAge * HOUR), ON), "withheld once the window closes");
  assert.equal(priceWithheld(side, seen(), market, iso(read + maxAge * HOUR - 1), ON), null, "still shown a moment before");
  // A reading logged before readings kept their hour counts from the start of its day: never younger than it was.
  assert.equal(readAt({ seen: "2026-11-14" }), Date.parse("2026-11-14T00:00:00Z"));
  const dayOnly = priceLimit(side, seen(null), market, iso(read), ON);
  assert.ok(dayOnly && "limited" in dayOnly);
  assert.equal(dayOnly.limited.until, iso(Date.parse("2026-11-14T00:00:00Z") + maxAge * HOUR));
  // Another network's feed, or our own reading, never meets the rule.
  assert.ok(priceWithheld(side, seen(READ, "some-other-network"), market, iso(read), ON));
  assert.ok(priceWithheld(side, { date: "2026-11-14", precision: "day" }, market, iso(read), ON));
  // A store with no price rule: no limit at all.
  assert.equal(priceLimit({ retailer: "other", url: "https://shop.example/p" }, seen(), market, iso(read), ON), null);
});

test("a price from the programme's own feed switches its rules on, even with no affiliate setting in the build", () => {
  assert.ok((termsOff({}) as Set<string>).has(store), "off before joining");
  const fed = feedStores([{ side, seen: seen() }]);
  assert.deepEqual([...fed], [store]);
  assert.ok(!(termsOff({}, fed) as Set<string>).has(store), "on once its feed priced a side");
  assert.ok((termsOff({ PROGRAMME_TERMS_OFF: store }, fed) as Set<string>).has(store), "PROGRAMME_TERMS_OFF still wins");
  assert.deepEqual([...feedStores([{ side, seen: seen(READ, "some-other-network") }])], [], "another network's feed proves nothing");
  assert.ok(rulesFor(side, market, termsOff({}, fed)), "rules apply");
});

/** A priced swap in the store's market, moved to the store on its cheaper side and priced from its feed. */
function fedPair(slug: string, readAtIso: string, savingsPct: number): Pair {
  const free = catalog.pairs.find((p) => p.market === market && !p.withheld && !rulesFor(p.brand, p.market, ON) && !rulesFor(p.alternative, p.market, ON))!;
  const p = structuredClone(free) as Pair;
  p.slug = slug;
  p.alternative = { ...p.alternative, ...side } as Pair["alternative"];
  p.prices.alternative = { ...seen(readAtIso), history: [] };
  p.savingsPct = savingsPct;
  p.savingsPerPack = 1.5;
  p.score = savingsPct;
  p.evidence = `Same active ingredient. The store listed it at $4.97 on 14 November.`;
  return p;
}

function partsAt(now: number) {
  const pairs = [fedPair("fed-fresh", READ, 40), fedPair("fed-old", iso(read - (maxAge + 1) * HOUR), 30)];
  const plain = structuredClone(catalog.pairs.find((p) => p.market === market && !p.withheld && !rulesFor(p.alternative, p.market, ON) && !rulesFor(p.brand, p.market, ON))!) as Pair;
  plain.slug = "plain";
  plain.score = 20;
  pairs.push(plain);
  const preset = { slug: "basket", score: 50, savings: 9, savingsPct: 30, lines: [{ pair: "fed-fresh" }, { pair: "plain" }] } as unknown as Preset;
  const parts = { pairs, bundles: [], presets: [preset], credits: [] };
  const result = applyProgrammeTerms(parts, iso(now), ON);
  pairs.sort((a, b) => b.score - a.score);
  return { ...parts, ...result };
}

test("the build shows a fresh feed price with its limit and withholds one read too long ago", () => {
  const { pairs, counts, presets } = partsAt(read + 2 * HOUR);
  const fresh = pairs.find((p) => p.slug === "fed-fresh")!;
  const old = pairs.find((p) => p.slug === "fed-old")!;
  assert.equal(fresh.withheld, undefined);
  assert.equal(fresh.savingsPct, 40, "the saving stays while the price shows");
  assert.equal(fresh.limited?.alternative?.until, iso(read + maxAge * HOUR));
  assert.match(fresh.evidence, /\$4\.97/);
  assert.equal(old.withheld?.alternative?.store, store);
  assert.equal(old.limited, undefined);
  assert.equal(old.savingsPct, 0);
  assert.deepEqual(counts.limitedPairs, 1);
  assert.equal(presets[0].withheld, undefined, "a basket keeps its totals while every line shows");
});

test("when the window closes the catalogue withholds the price by itself, and not a moment before", () => {
  const { pairs, bundles, presets } = partsAt(read + 2 * HOUR);
  const built = { generatedAt: iso(read + 2 * HOUR), pairs, bundles, presets } as unknown as Catalog;
  const closes = read + maxAge * HOUR - EXPIRY_MARGIN_MS;
  assert.deepEqual(expiryMoments(built), [closes]);
  assert.equal(nextExpiry(built, read), closes);
  assert.equal(nextExpiry(built, closes), null);

  assert.equal(expireCatalog(built, closes - 1), built, "nothing changes before the moment");
  const later = expireCatalog(built, closes);
  assert.notEqual(later, built);
  const fresh = later.pairs.find((p) => p.slug === "fed-fresh")!;
  assert.equal(fresh.withheld?.alternative?.store, store);
  assert.equal(fresh.limited, undefined);
  assert.equal(fresh.savingsPct, 0);
  assert.equal(fresh.savingsPerPack, 0);
  assert.equal(fresh.score, 0);
  assert.doesNotMatch(fresh.evidence, /\$/, "the prose loses its price sentences");
  assert.equal(later.pairs.at(-1)!.score, 0, "re-ranked: a withheld swap never leads");
  assert.deepEqual(later.presets[0].withheld, ["fed-fresh"], "its basket shows no totals");
  assert.equal(later.presets[0].savings, 0);
  // The built catalogue is never changed: a server holds both.
  assert.equal(built.pairs.find((p) => p.slug === "fed-fresh")!.savingsPct, 40);
});

test("the price clock: unset reads the catalogue as built; moved past a moment, everything reads it withheld", () => {
  const { pairs, bundles, presets } = partsAt(read + 2 * HOUR);
  const built = { generatedAt: iso(read), pairs, bundles, presets } as unknown as Catalog;
  const closes = read + maxAge * HOUR - EXPIRY_MARGIN_MS;
  resetPriceClock();
  try {
    assert.equal(priceClock(), undefined);
    assert.equal(catalogNow(built), built);
    setPriceClock(closes - 60_000);
    assert.equal(catalogNow(built), built, "before the moment: as built");
    setPriceClock(closes + 60_000);
    const view = catalogNow(built);
    assert.ok(view.pairs.find((p) => p.slug === "fed-fresh")!.withheld);
    assert.equal(catalogNow(built), view, "the same view until the clock moves again");
    setPriceClock(read);
    assert.equal(priceClock(), closes + 60_000, "the clock never goes back");
  } finally {
    resetPriceClock();
  }
});

test("the built catalogue: every limited side is shown, has a window still open at build time, and a withheld side has none", () => {
  for (const r of [...catalog.pairs, ...catalog.bundles]) {
    for (const [key, l] of Object.entries(r.limited ?? {})) {
      assert.ok(l && Date.parse(l.until) > Date.parse(catalog.generatedAt) - 60_000, `${r.slug} ${key}`);
      assert.ok(!r.withheld?.[key as "brand"], `${r.slug} ${key} is shown`);
    }
  }
});
