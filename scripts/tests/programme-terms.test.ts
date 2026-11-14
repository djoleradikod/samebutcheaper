/**
 * Affiliate programme terms (data/sellers/programmes.json `terms`, src/lib/programme-terms.ts, scripts/programme-terms.ts).
 * Every rule comes from the registry: the tests read which stores carry which rule from it, so a programme added or
 * dropped there needs no change here. The clauses behind each rule are in docs/research/R11-programme-terms.md.
 *
 *   npx tsx --test scripts/tests/programme-terms.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { NETWORK_TERMS, PROGRAMME_REGISTRY, registrySchema, TERM_RULES, termsSchema, type ProgrammeTerms } from "../../src/lib/programmes";
import {
  barredPath,
  disclosureFor,
  dupeWordAllowed,
  emailAllowed,
  historyBarred,
  kitMailable,
  pairMailable,
  photoBarred,
  priceNoticeFor,
  priceWithheld,
  rulesFor,
  termsOff,
} from "../../src/lib/programme-terms";
import { applyProgrammeTerms, withoutPrices } from "../programme-terms";
import { quotesPrice, withholdPair, withoutSavings, withoutStorePrices } from "../../src/lib/price-expiry";
import { linkStoreName } from "../../src/lib/affiliate";
import type { CatalogueView } from "../../src/lib/catalog-data";
import { buildIssue } from "../../src/lib/letter";
import type { Catalog, Pair } from "../../src/lib/types";

const catalog = catalogJson as unknown as Catalog;
const ON = new Set<string>();
const DAY = "2026-11-14";

/** Every store with a terms block, with a market its programme pays for. */
const withTerms = Object.entries(PROGRAMME_REGISTRY)
  .filter(([, e]) => e.terms)
  .map(([store, e]) => ({ store, terms: e.terms!, market: e.markets[0] ?? "US", markets: e.markets }));

/** A side at this store: the registry keys Amazon by its address, every other store by its retailer id. */
const at = (store: string, path = "/p/1") => ({ retailer: store, url: store === "amazon" ? `https://www.amazon.com${path}` : `https://www.${store}.com${path}` });
const plain = { retailer: "other", url: "https://www.example-store.test/p/1" };

test("the registry parses, and every rule it sets is backed by a quoted clause from a dated, linked page", () => {
  const raw = JSON.parse(readFileSync("data/sellers/programmes.json", "utf8"));
  const parsed = registrySchema.safeParse(raw);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
  assert.ok(withTerms.length > 0);
  const blocks: [string, ProgrammeTerms][] = [...withTerms.map((w): [string, ProgrammeTerms] => [w.store, w.terms]), ...Object.entries(NETWORK_TERMS)];
  for (const [who, t] of blocks) {
    assert.match(t.source, /^https:\/\//, who);
    assert.ok(t.checked <= DAY, `${who}: read on ${t.checked}, after today`);
    for (const rule of TERM_RULES) {
      if (t[rule] === undefined) continue;
      const clause = t.clauses.find((c) => c.rules.includes(rule));
      assert.ok(clause && clause.quote.length > 20, `${who}.${rule} has a quoted clause`);
    }
  }
});

test("a rule without a quoted clause is refused", () => {
  const base = { source: "https://example.com/terms", quote: "Terms.", checked: DAY };
  assert.equal(termsSchema.safeParse({ ...base, priceAlerts: false }).success, false);
  assert.equal(termsSchema.safeParse({ ...base, priceAlerts: false, clauses: [{ rules: ["priceHistory"], section: "1", quote: "No history." }] }).success, false);
  assert.equal(termsSchema.safeParse({ ...base, priceAlerts: false, clauses: [{ rules: ["priceAlerts"], section: "1", quote: "No alerts." }] }).success, true);
  assert.equal(termsSchema.safeParse({ ...base, madeUp: true }).success, false, "no rule the schema doesn't know");
});

test("rules apply only in the markets a programme pays for, and a store without a terms block gets none", () => {
  for (const { store, markets } of withTerms) {
    assert.ok(rulesFor(at(store), markets[0] ?? "US", ON), `${store} has rules`);
    const elsewhere = ["US", "GB", "DE", "CA", "IE", "AU"].find((m) => markets.length && !markets.includes(m));
    if (elsewhere) assert.equal(rulesFor(at(store), elsewhere, ON), null, `${store} outside its markets`);
  }
  const unread = Object.entries(PROGRAMME_REGISTRY).filter(([, e]) => !e.terms && !NETWORK_TERMS[e.network]);
  assert.ok(unread.length > 0);
  for (const [store, e] of unread) assert.equal(rulesFor(at(store), e.markets[0] ?? "US", ON), null, store);
  assert.equal(rulesFor(plain, "US", ON), null);
});

test("a network's terms reach every store on it, under the store's own", () => {
  for (const [network, terms] of Object.entries(NETWORK_TERMS)) {
    const stores = Object.entries(PROGRAMME_REGISTRY).filter(([, e]) => e.network === network);
    for (const [store, e] of stores) {
      const rules = rulesFor(at(store), e.markets[0] ?? "US", ON)!;
      assert.ok(rules, `${store} on ${network}`);
      for (const rule of TERM_RULES) {
        if (terms[rule] === undefined) continue;
        assert.deepEqual(rules[rule], e.terms?.[rule] ?? terms[rule], `${store}.${rule}`);
      }
    }
  }
});

test("PROGRAMME_TERMS_OFF switches a programme's rules off, or all of them", () => {
  assert.deepEqual(termsOff({ PROGRAMME_TERMS_ON: "all" }), new Set());
  assert.deepEqual(termsOff({ PROGRAMME_TERMS_ON: "all", PROGRAMME_TERMS_OFF: " Walmart, amazon " }), new Set(["walmart", "amazon"]));
  assert.equal(termsOff({ PROGRAMME_TERMS_OFF: "all" }), "all");
  // A programme's rules bind its members: off until the build is a member (its affiliate setting or a feed line for
  // the store), or until PROGRAMME_TERMS_ON names it.
  for (const { store } of withTerms) {
    assert.ok((termsOff({}) as Set<string>).has(store), `${store} is off before joining`);
    assert.ok(!(termsOff({ PROGRAMME_TERMS_ON: store }) as Set<string>).has(store), `${store} can be previewed`);
    assert.ok(!(termsOff({ PRICE_FEED_URLS: `impact:${store}@US=https://feed.example/items` }) as Set<string>).has(store), `${store} is on with its feed`);
    assert.ok((termsOff({ PRICE_FEED_URLS: `impact:${store}@US=https://feed.example/items`, PROGRAMME_TERMS_OFF: store }) as Set<string>).has(store));
  }
  for (const { store, market } of withTerms) {
    assert.equal(rulesFor(at(store), market, new Set([store])), null, store);
    assert.equal(rulesFor(at(store), market, "all"), null, store);
    const other = withTerms.find((w) => w.store !== store && w.markets.includes(market));
    if (other) assert.ok(rulesFor(at(other.store), market, new Set([store])), `${other.store} stays on when only ${store} is off`);
  }
});

test("a price rule is met only by the programme's own feed, read within its window; an API rule is never met yet", () => {
  for (const { store, terms, market } of withTerms.filter((w) => w.terms.prices)) {
    const { only, maxAgeHours } = terms.prices!;
    const network = PROGRAMME_REGISTRY[store].network;
    const seen = (feedDay?: string, feedNetwork: string = network) => ({
      date: "2026-11-01",
      precision: "day" as const,
      feed: feedDay ? { network: feedNetwork, seen: feedDay, stock: "in" as const } : undefined,
    });
    const daysOk = Math.floor((maxAgeHours - 1) / 24);
    const okDay = new Date(Date.parse(`${DAY}T00:00:00Z`) - daysOk * 86_400_000).toISOString().slice(0, 10);
    const lateDay = new Date(Date.parse(`${DAY}T00:00:00Z`) - Math.ceil(maxAgeHours / 24) * 86_400_000).toISOString().slice(0, 10);

    const none = priceWithheld(at(store), seen(), market, DAY, ON);
    assert.deepEqual(none, { store, only, date: "2026-11-01", precision: "day" }, `${store}: our own reading is not enough`);
    assert.ok(priceWithheld(at(store), seen(lateDay), market, DAY, ON), `${store}: a feed read ${lateDay} is too old`);
    assert.ok(priceWithheld(at(store), seen(DAY, "some-other-network"), market, DAY, ON), `${store}: another network's feed doesn't count`);
    if (only === "feed") assert.equal(priceWithheld(at(store), seen(okDay), market, DAY, ON), null, `${store}: its feed read ${okDay}`);
    else assert.ok(priceWithheld(at(store), seen(DAY), market, DAY, ON), `${store}: an API rule isn't met by a feed`);

    assert.equal(priceWithheld(at(store), seen(), market, DAY, new Set([store])), null, `${store}: switched off`);
  }
  assert.equal(priceWithheld(plain, { date: "2020-01-01", precision: "month" }, "US", DAY, ON), null, "a store without a rule");
});

test("history, images, notices, barred paths, disclosure and dupe wording follow the registry", () => {
  for (const { store, terms, market } of withTerms) {
    const side = at(store);
    assert.equal(historyBarred(side, market, ON), terms.priceHistory === false, `${store} history`);
    assert.equal(photoBarred(side, market, ON), terms.images === "programme", `${store} images`);
    assert.equal(priceNoticeFor(side, market, ON), terms.priceNotice ?? null, `${store} notice`);
    assert.equal(disclosureFor(side, market, ON), terms.disclosure ?? null, `${store} disclosure`);
    assert.equal(dupeWordAllowed([side, plain], market, ON), terms.dupeWording !== false, `${store} dupe wording`);
    for (const path of terms.barredPaths ?? []) {
      assert.equal(barredPath(at(store, path), market, ON), true, `${store}${path}`);
      assert.equal(barredPath(at(store, `${path}/refills`), market, ON), true, `${store}${path}/refills`);
      assert.equal(barredPath(at(store, `${path}-free-snacks`), market, ON), false, "a path that only starts the same way");
    }
    assert.equal(barredPath(at(store, "/ip/123"), market, ON), false);
  }
  assert.equal(historyBarred(plain, "US", ON), false);
  assert.equal(disclosureFor(plain, "US", ON), null);
});

test("email: a programme that bars its name in email keeps its swaps and kits out; withheld ones stay out too", () => {
  const noEmail = withTerms.filter((w) => w.terms.email === "none");
  const linksOnly = withTerms.filter((w) => w.terms.email && w.terms.email !== "none");
  for (const { store, market } of noEmail) assert.equal(emailAllowed([plain, at(store)], market, ON), false, store);
  // Our emails link only to our own pages, so a rule against store links in email is met already.
  for (const { store, market } of linksOnly) assert.equal(emailAllowed([plain, at(store)], market, ON), true, store);
  const pair = { market: "US", brand: plain, alternative: plain };
  assert.equal(pairMailable(pair, ON), true);
  assert.equal(pairMailable({ ...pair, withheld: { brand: {} } }, ON), false);
  assert.equal(kitMailable({ market: "US", bundle: plain, components: [plain], withheld: {} }, ON), true);
  for (const { store, market } of noEmail) {
    assert.equal(kitMailable({ market, bundle: plain, components: [plain, at(store)] }, ON), false, store);
    assert.equal(kitMailable({ market, bundle: plain, components: [plain, at(store)] }, new Set([store])), true, `${store} off`);
  }
});

test("the weekly letter carries no withheld swap or kit and nothing from a store that bars email", () => {
  const view = { pairs: catalog.pairs, bundles: catalog.bundles } as unknown as CatalogueView;
  // Everything counts as new, so every mailable record could lead.
  const seen = Object.fromEntries([...catalog.pairs.map((p) => [`p:${p.slug}`, "2026-11-10"]), ...catalog.bundles.map((b) => [`b:${b.slug}`, "2026-11-10"])]);
  const bySlug = new Map(catalog.pairs.map((p) => [p.slug, p]));
  const kitBySlug = new Map(catalog.bundles.map((b) => [b.slug, b]));
  let checked = 0;
  for (const country of ["US", "GB", "DE", "IE", "CA", null]) {
    const issue = buildIssue({ catalogue: view, country, sent: new Set(), seen, now: new Date(`${DAY}T09:00:00Z`) });
    for (const key of issue?.keys ?? []) {
      const [kind, slug] = [key.slice(0, 1), key.slice(2)];
      if (kind === "p") assert.ok(pairMailable(bySlug.get(slug)!), `${country}: ${slug}`);
      else assert.ok(kitMailable(kitBySlug.get(slug)!), `${country}: ${slug}`);
      checked++;
    }
  }
  assert.ok(checked > 0, "some letters were built");
  // The built catalogue has withheld records only when a programme's rules are on for the build (joined, or
  // PROGRAMME_TERMS_ON); the loop above holds either way.
});

test("the build pass withholds a price, zeroes every saving built on it and drops history and photos", () => {
  const ruled = withTerms.find((w) => w.terms.prices && w.terms.priceHistory === false && w.terms.images === "programme");
  assert.ok(ruled, "a programme with price, history and image rules in the registry");
  const free = (p: Pair) => !p.withheld && !rulesFor(p.brand, p.market, ON) && !rulesFor(p.alternative, p.market, ON);
  const original = structuredClone(catalog.pairs.find((p) => p.market === ruled.market && free(p))) as Pair;
  assert.ok(original, "a priced swap to start from");
  const photoSrc = "/photos/test-only.webp";
  const pair: Pair = structuredClone(original);
  pair.brand = { ...pair.brand, ...at(ruled.store), photo: { ...(pair.brand.photo ?? { alt: "x" }), src: photoSrc } } as Pair["brand"];
  pair.prices.brand = { ...pair.prices.brand, feed: undefined, history: [{ date: "2026-01-01", precision: "day", price: 1, method: "test", source: "test" }] };
  pair.savingsPct = 40;
  pair.score = 9;
  const credits = [{ src: photoSrc }, { src: "/photos/elsewhere.webp" }] as unknown as Catalog["credits"];
  const parts = { pairs: [pair], bundles: [], presets: [], credits };
  const { errors, counts } = applyProgrammeTerms(parts, DAY, ON);
  assert.deepEqual(errors, []);
  assert.equal(pair.withheld?.brand?.store, ruled.store);
  assert.equal(pair.savingsPct, 0);
  assert.equal(pair.savingsPerPack, 0);
  assert.equal(pair.score, 0);
  assert.deepEqual(pair.prices.brand.history, []);
  assert.equal(pair.brand.photo, null);
  assert.deepEqual(parts.credits.map((c) => c.src), [], "a photo no page shows leaves the credits");
  assert.deepEqual(counts, { pairs: 1, bundles: 0, presets: 0, photos: 1, histories: 1, limitedPairs: 0, limitedBundles: 0, quotes: 0 });

  // Switched off, the same swap is left as it was.
  const before: Pair = structuredClone(pair);
  before.withheld = undefined;
  before.savingsPct = 40;
  before.brand.photo = { ...(original.brand.photo ?? { alt: "x" }), src: photoSrc } as Pair["brand"]["photo"];
  const copy = structuredClone(before);
  applyProgrammeTerms({ pairs: [copy], bundles: [], presets: [], credits: [] }, DAY, new Set([ruled.store]));
  assert.deepEqual(copy, before);
});

test("a withheld record's prose loses the prices it quotes and keeps the rest", () => {
  assert.equal(withoutPrices("Both list sucralose. No taste test covers this pair."), "Both list sucralose. No taste test covers this pair.");
  assert.equal(
    withoutPrices("Regular prices at Walmart on 30 October 2026: Hershey's 8 oz at $5.97. Per ounce that is 74.6 cents. Open Facts lists cocoa on both."),
    "Open Facts lists cocoa on both.",
  );
  assert.equal(withoutPrices("It has the same 0.454% stannous fluoride, and four tubes cost $16.43 instead of $23.49."), "It has the same 0.454% stannous fluoride.");
  assert.equal(withoutPrices("Around GBP 4.75 for 2.5 litres (0.19p per ml).", "Left out."), "Left out.");
  for (const p of catalog.pairs.filter((p) => p.withheld)) {
    for (const text of [p.evidence, p.why ?? "", p.differences ?? ""]) assert.equal(withoutPrices(text), text, p.slug);
    assert.ok(p.evidence.length > 0, p.slug);
  }
});

test("cents signs count as prices, a cut never splits brackets, and a withheld summary states no saving", () => {
  assert.equal(withoutPrices("Same surfactants. It works out at 85.1¢/fl oz."), "Same surfactants.");
  assert.equal(
    withoutPrices("Both are 2-in-1 pods (membership needed; third-party Walmart sellers charge about $32). Same enzymes."),
    "Same enzymes.",
    "no cut inside the brackets",
  );
  assert.equal(withoutPrices("Same pods (big box; sold online), and a tub costs $12."), "Same pods (big box; sold online).");
  assert.equal(withoutSavings("Same 10 mg loratadine. It costs 62% less per tablet."), "Same 10 mg loratadine.");
  assert.equal(withoutSavings("62% less per tablet.", "Left out."), "Left out.");
  assert.equal(withoutSavings("Same 0.5% salicylic acid."), "Same 0.5% salicylic acid.", "a strength is not a saving");

  const pair = structuredClone(catalog.pairs.find((p) => !p.withheld)!) as Pair;
  pair.summary = "Same active ingredient; 40% less per dose. About $3.20 cheaper a pack.";
  withholdPair(pair, { brand: { store: "test", only: "feed", date: DAY, precision: "day" } });
  assert.equal(pair.summary, "Same active ingredient.");

  for (const r of [...catalog.pairs, ...catalog.bundles].filter((r) => r.withheld)) {
    assert.ok(!quotesPrice(r.summary) && !/% less/i.test(r.summary), `${r.slug}: a withheld record's summary states no price or saving`);
  }
});

test("a priced record's passing quote of a withheld store's price goes, and nothing else of its prose", () => {
  assert.equal(
    withoutStorePrices("Both are pasture-raised. Vital Farms was $6.67 at Walmart Supercenter, so the gap is smaller there. Sprouts sells a dozen for $5.99.", ["Walmart"]),
    "Both are pasture-raised. Sprouts sells a dozen for $5.99.",
  );
  assert.equal(withoutStorePrices("Walmart.ca listed it at $5.97.", ["Walmart"]), "Walmart.ca listed it at $5.97.", "walmart.ca is another programme");
  assert.equal(withoutStorePrices("Walmart sells it for $5.97.", []), "Walmart sells it for $5.97.");

  const ruled = withTerms.find((w) => w.terms.prices && w.store !== "amazon");
  assert.ok(ruled);
  const free = (p: Pair) => !rulesFor(p.brand, p.market, ON) && !rulesFor(p.alternative, p.market, ON);
  const other = structuredClone(catalog.pairs.find((p) => p.market === ruled.market && free(p))) as Pair;
  const withheldOne = structuredClone(other);
  withheldOne.slug = "test-withheld";
  withheldOne.brand = { ...withheldOne.brand, ...at(ruled.store) } as Pair["brand"];
  withheldOne.prices.brand = { ...withheldOne.prices.brand, feed: undefined };
  const name = linkStoreName(withheldOne.brand);
  other.evidence = `Same active. It was $9.99 at ${name}. Our own check found $4.00 at the other store.`;
  const { counts } = applyProgrammeTerms({ pairs: [other, withheldOne], bundles: [], presets: [], credits: [] }, DAY, ON);
  assert.equal(other.withheld, undefined);
  assert.equal(other.evidence, "Same active. Our own check found $4.00 at the other store.");
  assert.equal(counts.quotes, 1);
});

test("a link to a path the terms bar fails the build", () => {
  const barred = withTerms.find((w) => w.terms.barredPaths?.length);
  if (!barred) return;
  const pair: Pair = structuredClone(catalog.pairs.find((p) => p.market === barred.market)!) as Pair;
  pair.alternative = { ...pair.alternative, ...at(barred.store, barred.terms.barredPaths![0]) } as Pair["alternative"];
  const { errors } = applyProgrammeTerms({ pairs: [pair], bundles: [], presets: [], credits: [] }, DAY, ON);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /affiliate terms bar/);
});
// Run with the same PROGRAMME_TERMS_ON / PROGRAMME_TERMS_OFF and affiliate settings the catalogue was built with.

test("in the built catalogue, every withheld record shows no saving and every priced one passes its programme's rules", () => {
  // The build judges each price at its own moment, a few milliseconds before generatedAt.
  const day = catalog.generatedAt;
  for (const p of catalog.pairs) {
    for (const side of ["brand", "alternative"] as const) {
      const w = priceWithheld(p[side], p.prices[side], p.market, day);
      assert.equal(!!p.withheld?.[side], !!w, `${p.slug} ${side}`);
      if (historyBarred(p[side], p.market)) assert.deepEqual(p.prices[side].history, [], `${p.slug} ${side} history`);
      if (photoBarred(p[side], p.market)) assert.equal(p[side].photo, null, `${p.slug} ${side} photo`);
    }
    if (p.withheld) {
      assert.equal(p.savingsPct, 0, p.slug);
      assert.equal(p.savingsPerPack, 0, p.slug);
      assert.equal(p.score, 0, p.slug);
    }
  }
  for (const b of catalog.bundles) if (b.withheld && Object.keys(b.withheld).length) {
    assert.equal(b.savings, 0, b.slug);
    assert.equal(b.netSavings, 0, b.slug);
    assert.equal(b.netSavingsPct, 0, b.slug);
  }
  const withheldPairs = new Set(catalog.pairs.filter((p) => p.withheld).map((p) => p.slug));
  for (const preset of catalog.presets) {
    const expected = preset.lines.filter((l) => withheldPairs.has(l.pair)).map((l) => l.pair);
    assert.deepEqual(preset.withheld ?? [], expected, preset.slug);
    if (expected.length) assert.equal(preset.savings, 0, preset.slug);
  }
});
