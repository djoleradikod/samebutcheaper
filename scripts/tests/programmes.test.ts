/**
 * The programme registry (data/sellers/programmes.json): it parses, every claim has a source, and every store in
 * data/sellers and every store a catalogue buy link opens has an entry ("unknown" counts as one).
 *
 *   npx tsx --test scripts/tests/programmes.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import registry from "../../data/sellers/programmes.json";
import delivery from "../../data/sellers/delivery.json";
import footprint from "../../data/sellers/footprint.json";
import { programById } from "../../src/lib/affiliate-programs";
import { clickStore, linkStore, PROGRAMME_REGISTRY, programmeOf, registrySchema, signupOf } from "../../src/lib/programmes";
import { rankProgrammes, reachByStore } from "../revenue/rank-programmes";

const ROOT = join(import.meta.dirname, "..", "..");

test("the registry parses, and every network claim names its source page", () => {
  const parsed = registrySchema.safeParse(registry);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 5)));
  for (const [store, e] of Object.entries(PROGRAMME_REGISTRY)) {
    if (e.network !== "unknown") assert.ok(e.source, `${store}: ${e.network} without a source`);
    if (e.programme) assert.ok(programById(e.programme), `${store}: ${e.programme} isn't in affiliate-programs.ts`);
  }
  assert.equal(programmeOf("pollin").programme, "pollin-de");
  assert.equal(programmeOf("no-such-store").network, "unknown");
  assert.equal(signupOf(programmeOf("walmart")), "https://affiliates.walmart.com/");
});

test("every store in data/sellers has an entry", () => {
  const stores = new Set<string>(Object.keys(delivery.sellers));
  for (const section of ["sellers", "manual", "refused", "ships", "separate"] as const) {
    for (const s of Object.keys((footprint as unknown as Record<string, Record<string, unknown>>)[section] ?? {})) stores.add(s);
  }
  const missing = [...stores].filter((s) => !(s in PROGRAMME_REGISTRY));
  assert.deepEqual(missing, []);
});

test("every store a catalogue buy link opens has an entry", { skip: existsSync(join(ROOT, "src/generated/catalog.json")) ? false : "run npm run catalog first" }, () => {
  type Side = { retailer: string; url: string };
  const catalog = JSON.parse(readFileSync(join(ROOT, "src/generated/catalog.json"), "utf8")) as {
    pairs: { brand: Side; alternative: Side }[];
    bundles: { bundle: Side; components: Side[] }[];
  };
  const sides = [...catalog.pairs.flatMap((p) => [p.brand, p.alternative]), ...catalog.bundles.flatMap((b) => [b.bundle, ...b.components])];
  const missing = [...new Set(sides.map(linkStore))].filter((s) => !(s in PROGRAMME_REGISTRY));
  assert.deepEqual(missing, [], "add these to data/sellers/programmes.json, as unknown if nothing is found");
});

test("link and click stores", () => {
  assert.equal(linkStore({ retailer: "walmart", url: "https://www.walmart.com/ip/1" }), "walmart");
  assert.equal(linkStore({ retailer: "walmart", url: "https://www.amazon.com/dp/B000" }), "amazon");
  assert.equal(linkStore({ retailer: "other", url: "https://us.ugreen.com/products/x" }), "ugreen");
  assert.equal(linkStore({ retailer: "other", url: "https://www.shop-apotheke.com/x" }), "shop-apotheke");
  assert.equal(clickStore("tesco:GB", "tesco.com"), "tesco");
  assert.equal(clickStore("other", "ulta.com"), "ulta");
  assert.equal(clickStore("other", null), "unknown");
});

test("ranking: reach counts only the markets a programme pays for; unknown stores are listed apart", () => {
  const side = (retailer: string, url: string) => ({ retailer, url });
  const catalog = {
    pairs: [
      { slug: "a", market: "US", brand: side("target", "https://www.target.com/p/-/A-1"), alternative: side("walmart", "https://www.walmart.com/ip/1") },
      { slug: "b", market: "CA", brand: side("walmart", "https://www.walmart.ca/en/ip/2"), alternative: side("walmart", "https://www.walmart.ca/en/ip/3") },
      { slug: "c", market: "DE", brand: side("rewe", "https://shop.rewe.de/p/x"), alternative: side("aponeo", "https://www.aponeo.de/y") },
    ],
    bundles: [{ slug: "k", market: "US", bundle: side("target", "https://www.target.com/p/-/A-2"), components: [side("walmart", "https://www.walmart.com/ip/4"), side("walmart", "https://www.walmart.com/ip/5")] }],
  };
  const { ranked, unknown } = rankProgrammes(reachByStore(catalog), new Map([["walmart", 3], ["rewe", 1]]));
  assert.deepEqual(
    ranked.map((g) => [g.key, g.swaps, g.cheaperSides, g.kitPieces, g.clickShare]),
    [["walmart-us", 1, 1, 2, 0.75], ["target", 1, 0, 1, 0], ["aponeo", 1, 1, 0, 0]],
  );
  assert.deepEqual(unknown.map((u) => [u.store, u.swaps]), [["rewe", 1]]);
  assert.equal(rankProgrammes(reachByStore(catalog), null).ranked[0].clickShare, null, "no database: no click share");
});
