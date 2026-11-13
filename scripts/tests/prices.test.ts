/**
 * The price loop: freshness tiers, the observation log, source adapters (against recorded fixtures, since
 * the container can't reach the sources), the refresh rules and the in-place file rewrite.
 *
 *   npx tsx --test scripts/tests/prices.test.ts
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import {
  ageWarning,
  canLead,
  checkedDate,
  daysBetween,
  freshnessOf,
  freshnessWeight,
  leadFirst,
  tierFor,
} from "../../src/lib/freshness";
import { matchRows, parseState, type BrowseRow } from "../../src/lib/browse";
import { monthStart, priceSeenFor } from "../prices/attach";
import { isChain } from "../prices/chains";
import { decide, packMismatch, type ReviewItem } from "../prices/decide";
import { feedAdapter, gtin14, normalUrl, parseCsv } from "../prices/adapters/feed";
import { manualCandidates } from "../prices/adapters/manual";
import { openPricesAdapter, openPricesPage, openPricesUrl, pickItem, rejectReason, type OpenPricesItem } from "../prices/adapters/open-prices";
import type { AdapterContext, Candidate } from "../prices/adapters/types";
import { editJson, parseWithSpans } from "../prices/json-edit";
import { appendObservations, loadObservations, observationSchema, type Observation } from "../prices/observations";
import { recordsFromBundleFile, recordsFromPairFile, savingPct, type PricedRecord } from "../prices/records";
import { accept, applyEdits, mergeReview, readReview, summarize, type Paths } from "../prices/refresh";
import { blameDays, seedDate } from "../prices/seed";

const TODAY = "2026-11-13";
const FIXTURES = join(import.meta.dirname, "..", "prices", "fixtures");
const nutellaPage = openPricesPage.parse(JSON.parse(readFileSync(join(FIXTURES, "open-prices-4008400401621.json"), "utf8")));

/* ------------------------------------------------------------ test records */

function pairJson(over: { market?: string; brand?: Record<string, unknown>; alternative?: Record<string, unknown>; price_checked?: string; slug?: string } = {}) {
  return {
    slug: over.slug ?? "nutella-vs-ja-de",
    market: over.market ?? "DE",
    price_checked: over.price_checked ?? "2026-10",
    brand: { brand: "Nutella", product: "Nutella, 450 g", size: 450, unit: "g", price: 3.99, retailer: "rewe", url: "https://shop.rewe.de/p/nutella", gtin: "4008400401621", ...over.brand },
    alternative: { brand: "ja!", product: "ja! Nuss-Nougat-Creme, 400 g", size: 400, unit: "g", price: 1.99, retailer: "rewe", url: "https://shop.rewe.de/p/ja", gtin: "4337256609326", ...over.alternative },
  };
}

function record(over: Parameters<typeof pairJson>[0] = {}): PricedRecord {
  return recordsFromPairFile("/data/pairs/test.json", JSON.stringify([pairJson(over)]))[0];
}

function obs(over: Partial<Observation> = {}): Observation {
  return observationSchema.parse({
    record: "nutella-vs-ja-de",
    side: "brand",
    price: 3.99,
    currency: "EUR",
    seen: "2026-10-20",
    source: "rewe",
    url: "https://shop.rewe.de/p/nutella",
    method: "hand",
    logged: "2026-10-20",
    ...over,
  });
}

function cand(over: Partial<Candidate> = {}): Candidate {
  return { record: "nutella-vs-ja-de", side: "brand", price: 3.99, currency: "EUR", seen: "2026-11-10", source: "open-prices", url: "https://prices.openfoodfacts.org/prices/1", method: "open-prices", ...over };
}

/* --------------------------------------------------------------- freshness */

test("tiers: 30 days fresh, 90 recent, 180 ageing, then stale", () => {
  assert.equal(tierFor(0), "fresh");
  assert.equal(tierFor(30), "fresh");
  assert.equal(tierFor(31), "recent");
  assert.equal(tierFor(90), "recent");
  assert.equal(tierFor(91), "ageing");
  assert.equal(tierFor(180), "ageing");
  assert.equal(tierFor(181), "stale");
  assert.equal(daysBetween("2026-11-03", TODAY), 10);
  assert.equal(daysBetween("2026-12-01", TODAY), 0, "a future date counts as today, never negative");
});

test("a record's tier comes from its older side", () => {
  const f = freshnessOf(
    [
      { date: "2026-11-10", precision: "day" },
      { date: "2026-06-01", precision: "month" },
    ],
    TODAY,
  );
  assert.equal(f.tier, "ageing");
  assert.equal(f.date, "2026-06-01");
  assert.equal(f.precision, "month");
  assert.equal(f.days, 165);
});

test("ranking: fresh and recent keep their score, ageing and stale lose it progressively, stale never leads", () => {
  assert.equal(freshnessWeight(10), 1);
  assert.equal(freshnessWeight(90), 1);
  const ageing = [100, 135, 180].map(freshnessWeight);
  assert.ok(ageing[0] < 1 && ageing[1] < ageing[0] && ageing[2] < ageing[1]);
  assert.equal(Math.round(freshnessWeight(180) * 100), 75);
  assert.ok(freshnessWeight(181) <= 0.5, "stale starts at half or less");
  assert.ok(freshnessWeight(400) < freshnessWeight(200));
  assert.equal(freshnessWeight(5000), 0.1, "floor");
  // Every stale score sits under every ageing one for the same saving.
  assert.ok(freshnessWeight(181) < freshnessWeight(180));
  assert.equal(canLead("ageing"), true);
  assert.equal(canLead("stale"), false);
  const rows = [{ slug: "a", stale: true }, { slug: "b" }, { slug: "c", stale: false }];
  assert.deepEqual([...rows].sort(leadFirst).map((r) => r.slug), ["b", "c", "a"]);
});

test("biggest savings: a stale price sorts behind current ones of its photo group, whatever its saving", () => {
  const row = (slug: string, pct: number, stale?: boolean): BrowseRow => ({
    slug, aisle: "food-pantry", shelf: "Spreads", match: "same_kind", market: "DE", photo: true, tier: 0, rated: true, pct, unit: 1, checked: "2026-11", ...(stale ? { stale } : {}),
  });
  const rows = [row("old-huge", 90, true), row("new-small", 10), row("new-big", 50)];
  for (const sort of ["", "sort=unit", "sort=newest"]) {
    assert.notEqual(matchRows(rows, parseState(sort), { market: "all", hideMedicine: false })[0].slug, "old-huge", sort || "default sort");
  }
  assert.deepEqual(matchRows(rows, parseState(""), { market: "all", hideMedicine: false }).map((r) => r.slug), ["new-big", "new-small", "old-huge"]);
});

test("dates read as a day, or a month when that's all we know", () => {
  assert.equal(checkedDate("2026-11-03", "day"), "3 Nov 2026");
  assert.equal(checkedDate("2026-06-01", "month"), "June 2026");
  assert.equal(ageWarning("fresh"), null);
  assert.equal(ageWarning("recent"), null);
  assert.match(ageWarning("ageing")!, /over 3 months ago, so check the price at the store/);
  assert.match(ageWarning("stale")!, /over 6 months ago/);
});

/* --------------------------------------------------------------------- log */

test("observation schema: strict fields, ISO days, known methods and currencies", () => {
  assert.ok(observationSchema.safeParse(obs()).success);
  assert.equal(observationSchema.safeParse({ ...obs(), seen: "2026-11" }).success, false);
  assert.equal(observationSchema.safeParse({ ...obs(), method: "scrape" }).success, false);
  assert.equal(observationSchema.safeParse({ ...obs(), currency: "CHF" }).success, false);
  assert.equal(observationSchema.safeParse({ ...obs(), side: "both" }).success, false);
  assert.equal(observationSchema.safeParse({ ...obs(), extra: 1 }).success, false);
  assert.equal(observationSchema.safeParse({ ...obs(), price: 0 }).success, false);
  assert.ok(observationSchema.safeParse({ ...obs(), side: "item-3" }).success);
});

test("log: appends one line per new observation, skips repeats, reports bad lines", () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-obs-"));
  const first = appendObservations([obs(), obs({ side: "alternative", price: 1.99 })], [], dir);
  assert.equal(first.length, 2);
  const again = appendObservations([obs(), obs({ seen: "2026-11-01", logged: "2026-11-01" })], loadObservations(dir).observations, dir);
  assert.equal(again.length, 1, "the repeat isn't written");
  writeFileSync(join(dir, "bad.jsonl"), '{"record":"x"}\nnot json\n');
  const loaded = loadObservations(dir);
  assert.equal(loaded.observations.length, 3);
  assert.equal(loaded.errors.length, 2);
  assert.equal(readFileSync(join(dir, "2026-10.jsonl"), "utf8").trim().split("\n").length, 2);
});

test("attach: the date is the latest observation at the record's current price", () => {
  const log = [obs({ seen: "2026-09-01", price: 3.79 }), obs({ seen: "2026-10-20" }), obs({ seen: "2026-11-02" })];
  const r = priceSeenFor(log, 3.99, "2026-10");
  assert.equal(r.seen.date, "2026-11-02");
  assert.equal(r.seen.precision, "day");
  assert.equal(r.problem, null);
  assert.deepEqual(
    r.seen.history.map((p) => p.price),
    [3.79, 3.99, 3.99],
  );
});

test("attach: with no observation at that price the record's month stands in, and the build is told", () => {
  const none = priceSeenFor([], 3.99, "2026-10");
  assert.deepEqual([none.seen.date, none.seen.precision], ["2026-10-01", "month"]);
  assert.match(none.problem!, /no price observation/);
  const other = priceSeenFor([obs({ price: 4.29 })], 3.99, "2026-10");
  assert.match(other.problem!, /no observation at that price/);
  const later = priceSeenFor([obs(), obs({ seen: "2026-11-05", price: 4.29 })], 3.99, "2026-10");
  assert.match(later.problem!, /4.29 was seen later/);
  assert.equal(monthStart("2026-03"), "2026-03-01");
});

test("seed: the commit day only when it's inside the record's month", () => {
  assert.deepEqual(seedDate("2026-11", "2026-11-03"), { seen: "2026-11-03", precision: "day" });
  assert.deepEqual(seedDate("2026-07", "2026-11-03"), { seen: "2026-07-01", precision: "month" });
  assert.deepEqual(seedDate("2026-07", null), { seen: "2026-07-01", precision: "month" });
  assert.deepEqual(seedDate("2026-07-14", "2026-11-03"), { seen: "2026-07-14", precision: "day" });
  const sha = "a".repeat(40);
  const porcelain = `${sha} 1 1 2\nauthor X\ncommitter-time 1762128000\n\t[\n${sha} 2 2\n\t]\n${"0".repeat(40)} 3 3 1\ncommitter-time 1762128000\n\t{}\n`;
  const days = blameDays(porcelain);
  assert.equal(days.get(1), "2025-11-03");
  assert.equal(days.get(2), "2025-11-03", "a repeat commit reuses its day");
  assert.equal(days.get(3), null, "uncommitted");
});

/* ------------------------------------------------------------------- edits */

test("json edit: one value changes, every byte of formatting around it stays", () => {
  const variants = [JSON.stringify([pairJson()], null, 1), JSON.stringify([pairJson()], null, 2), JSON.stringify([pairJson()], null, 4), JSON.stringify([pairJson()])];
  for (const text of variants) {
    const out = editJson(text, [
      { path: [0, "brand", "price"], value: 4.29 },
      { path: [0, "price_checked"], value: "2026-11" },
    ]);
    assert.equal(out.length, text.length, "same length: 3.99 -> 4.29 and 2026-10 -> 2026-11");
    const diff = [...out].filter((ch, i) => ch !== text[i]).length;
    assert.ok(diff <= 3, `only the changed characters differ (${diff})`);
    assert.equal(JSON.parse(out)[0].brand.price, 4.29);
    assert.equal(JSON.parse(out)[0].alternative.price, 1.99);
  }
});

test("json edit: legacy price_usd, escaped strings, and refusals", () => {
  const text = '[\n  {"slug": "a\\"b", "brand": {"price_usd": 19.97, "x": [1, 2.5e1, true, null]}}\n]\n';
  const out = editJson(text, [{ path: [0, "brand", "price_usd"], value: 18.5 }]);
  assert.equal(out, text.replace("19.97", "18.5"));
  assert.throws(() => editJson(text, [{ path: [0, "brand", "price"], value: 1 }]), /no value/);
  assert.throws(() => editJson(text, [{ path: [0, "brand"], value: 1 }]), /no value/);
  assert.throws(() => parseWithSpans("[1,]"), /parse error/);
});

/* ------------------------------------------------------------- open prices */

const opts = { maxAgeDays: 60 };
const items = nutellaPage.items as OpenPricesItem[];
const [edekaItem, nettoItem, reweItem] = items;

test("open prices fixture: the recorded response parses", () => {
  assert.equal(items.length, 3);
  assert.equal(reweItem.location?.osm_brand, "Rewe");
  assert.equal(openPricesUrl("4008400401621", TODAY, opts), "https://prices.openfoodfacts.org/api/v1/prices?product_code=4008400401621&date__gte=2026-09-14&order_by=-date&size=100");
});

test("open prices: only the record's own chain, market, currency and recent dates", () => {
  const r = record();
  const brand = r.sides[0];
  assert.equal(rejectReason(reweItem, r, brand, TODAY, opts), null, "REWE price for a REWE record");
  assert.match(rejectReason(nettoItem, r, brand, TODAY, opts)!, /not rewe/);
  assert.match(rejectReason(edekaItem, r, brand, TODAY, opts)!, /not rewe/);
  assert.match(rejectReason(reweItem, r, brand, TODAY, { maxAgeDays: 30 })!, /older than 30 days/);
  assert.match(rejectReason(reweItem, record({ market: "IE" }), record({ market: "IE" }).sides[0], TODAY, opts)!, /not IE/);
  assert.match(rejectReason({ ...reweItem, currency: "USD" }, r, brand, TODAY, opts)!, /not EUR/);
  assert.match(rejectReason({ ...reweItem, price_is_discounted: true }, r, brand, TODAY, opts)!, /promotion/);
  assert.match(rejectReason({ ...reweItem, proof_id: null }, r, brand, TODAY, opts)!, /no proof/);
  assert.match(rejectReason({ ...reweItem, duplicate_of: 5 }, r, brand, TODAY, opts)!, /duplicate/);
  assert.match(rejectReason({ ...reweItem, price_per: "KILOGRAM" }, r, brand, TODAY, opts)!, /per kilogram/);
  assert.match(rejectReason({ ...reweItem, date: "2026-11-20" }, r, brand, TODAY, opts)!, /future/);
  assert.match(rejectReason({ ...reweItem, location: { ...reweItem.location, type: "ONLINE" } }, r, brand, TODAY, opts)!, /physical/);
  assert.match(rejectReason(reweItem, r, r.sides[1], TODAY, opts)!, /another barcode/);
  const netto = record({ brand: { retailer: "netto" } });
  assert.equal(rejectReason(nettoItem, netto, netto.sides[0], TODAY, opts), null, "Netto Marken-Discount is Netto");
  const any = record({ brand: { retailer: "other" } });
  assert.deepEqual(
    items.filter((it) => rejectReason(it, any, any.sides[0], TODAY, opts) === null).map((it) => it.id),
    [361933, 358674, 332360],
    "a record that names no chain takes any store in its market",
  );
});

test("open prices: the latest day wins, the median on a tie", () => {
  assert.equal(pickItem(items)?.id, 361933);
  const sameDay = [1.0, 2.0, 9.0].map((price, i) => ({ ...reweItem, id: i, price }));
  assert.equal(pickItem(sameDay)?.price, 2.0);
  assert.equal(pickItem([]), null);
});

test("open prices adapter: asks once per barcode, credits ODbL, carries the pack", async () => {
  const asked: string[] = [];
  const ctx: AdapterContext = {
    today: TODAY,
    env: {},
    sleep: async () => {},
    fetch: async (url) => {
      asked.push(url);
      const body = url.includes("4008400401621") ? readFileSync(join(FIXTURES, "open-prices-4008400401621.json")) : Buffer.from('{"items":[],"total":0}');
      return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer };
    },
  };
  const { candidates, notes } = await openPricesAdapter.collect([record(), record({ slug: "nutella-2-de" })], ctx);
  assert.equal(asked.length, 2, "two barcodes, two requests, though two records share one");
  assert.equal(candidates.length, 2);
  const c = candidates[0];
  assert.equal(c.price, 3.99);
  assert.equal(c.seen, "2026-09-18");
  assert.equal(c.url, "https://prices.openfoodfacts.org/prices/332360");
  assert.match(c.attribution!, /ODbL/);
  assert.deepEqual(c.pack, { size: 450, unit: "g" });
  assert.match(notes[0], /2 barcode/);
});

test("open prices adapter: a failing host is a note, not a crash", async () => {
  const ctx: AdapterContext = { today: TODAY, env: {}, sleep: async () => {}, fetch: async () => ({ ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }) };
  const { candidates, notes } = await openPricesAdapter.collect([record()], ctx);
  assert.equal(candidates.length, 0);
  assert.ok(notes.some((n) => /HTTP 503/.test(n)));
});

test("chains: store names fold to the retailer id", () => {
  assert.ok(isChain("Rewe", "rewe"));
  assert.ok(isChain("REWE City", "rewe"));
  assert.ok(isChain("Sainsbury's Local", "sainsburys"));
  assert.ok(isChain("Marks & Spencer", "marksandspencer"));
  assert.ok(isChain("Müller", "mueller"));
  assert.ok(!isChain("Rewel Market", "rewe"), "a prefix of a word isn't the chain");
  assert.ok(!isChain(null, "rewe"));
  assert.ok(!isChain("Tesco", "asda"));
});

/* -------------------------------------------------------------------- feed */

const gbRecords = () => [
  record({
    slug: "nurofen-vs-test-ibuprofen-gb",
    market: "GB",
    brand: { brand: "Nurofen", product: "Nurofen 16", size: 16, unit: "tablet", price: 2.0, retailer: "boots", url: "https://www.test-chemist.example/p/nurofen", gtin: null },
    alternative: { brand: "Test", product: "Test Ibuprofen 16", size: 16, unit: "tablet", price: 1.45, retailer: "boots", url: "https://test-chemist.example/p/ibuprofen-16/", gtin: null },
  }),
  record({
    slug: "panadol-vs-test-paracetamol-gb",
    market: "GB",
    brand: { brand: "Panadol", product: "Panadol 32", size: 32, unit: "tablet", price: 4.0, retailer: "superdrug", url: "https://example.com/panadol", gtin: "5000000000017" },
    alternative: { brand: "Test", product: "Test Paracetamol 32", size: 32, unit: "tablet", price: 2.0, retailer: "boots", url: "https://example.com/x", gtin: "5000000000017" },
  }),
  record({
    slug: "zirtek-vs-test-cetirizine-gb",
    market: "GB",
    brand: { brand: "Zirtek", product: "Zirtek 30", size: 30, unit: "tablet", price: 6.0, retailer: "boots", url: "https://example.com/zirtek", gtin: "00012345678905" },
    alternative: { brand: "Test", product: "Test Loratadine", size: 30, unit: "tablet", price: 2.5, retailer: "boots", url: "https://example.com/lor", gtin: "5000000000024" },
  }),
];

// The feed readers, matching and adapter are tested in feeds.test.ts and feeds-match.test.ts. This keeps the cases
// the first Awin reader was written for.
test("awin feed: barcode, then the product page; another currency skipped; out of stock logged as such; no URL in notes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-feed-"));
  const gz = join(dir, "boots.csv.gz");
  writeFileSync(gz, gzipSync(readFileSync(join(FIXTURES, "awin-feed.synthetic.csv"))));
  const base: AdapterContext = { today: TODAY, env: {}, sleep: async () => {}, fetch: async () => assert.fail("no fetch with no feeds") };
  const none = await feedAdapter.collect(gbRecords(), base);
  assert.deepEqual(none.candidates, []);
  assert.match(none.notes.join(), /no feeds configured/);
  const out = await feedAdapter.collect(gbRecords(), { ...base, env: { PRICE_FEED_URLS: `boots@GB=${gz}` } });
  assert.deepEqual(out.candidates.map((c) => [c.record, c.side, c.price, c.method, c.source, c.seen, c.stock]).sort(), [
    ["nurofen-vs-test-ibuprofen-gb", "alternative", 1.5, "feed", "feed:awin", TODAY, "in"],
    ["panadol-vs-test-paracetamol-gb", "alternative", 2.1, "feed", "feed:awin", TODAY, "in"],
    ["zirtek-vs-test-cetirizine-gb", "brand", 3, "feed", "feed:awin", TODAY, "out"],
  ]);
  assert.match(out.notes.join("\n"), /1 matched row\(s\) skipped: in EUR/);
  assert.equal(out.candidates[0].link?.startsWith("https://www.awin1.com/pclick.php"), true);
  const remote = await feedAdapter.collect(gbRecords(), {
    ...base,
    env: { PRICE_FEED_URLS: "boots@GB=https://productdata.awin.com/datafeed/download/apikey/SECRET/fid/1/format/csv" },
    fetch: async () => ({ ok: false, status: 401, arrayBuffer: async () => new ArrayBuffer(0) }),
  });
  assert.equal(remote.candidates.length, 0);
  assert.ok(!remote.notes.join().includes("SECRET"));
  assert.match(remote.notes.join(), /HTTP 401/);
});

test("gtin and URL helpers", () => {
  assert.equal(gtin14("012345678905"), gtin14("0012345678905"));
  assert.equal(normalUrl("https://www.Test-Chemist.example/p/ibuprofen-16?utm_source=awin#x"), "test-chemist.example/p/ibuprofen-16");
});

test("csv: quotes, doubled quotes, commas and CRLF", () => {
  const rows = parseCsv('a,b,c\r\n"x, y","say ""hi""",3\r\n\r\nq,,\n');
  assert.deepEqual(rows, [
    { a: "x, y", b: 'say "hi"', c: "3" },
    { a: "q", b: "", c: "" },
  ]);
  assert.deepEqual(parseCsv("a|b\n1|2\n"), [{ a: "1", b: "2" }]);
});

/* ------------------------------------------------------------------ manual */

test("manual: good lines become candidates, bad ones are named and skipped", () => {
  const rows = parseCsv(
    [
      "record,side,price,seen,url,currency,method,note",
      "nutella-vs-ja-de,brand,4.19,2026-11-12,https://shop.rewe.de/p/nutella,,,Shelf tag",
      "nutella-vs-ja-de,alternative,2.09,2026-11-12,https://shop.rewe.de/p/ja,GBP,,",
      "nutella-vs-ja-de,kit,2.09,2026-11-12,https://shop.rewe.de/p/ja,,,",
      "nope,brand,1,2026-11-12,https://x.example,,,",
      "nutella-vs-ja-de,brand,4.19,2026-12-01,https://shop.rewe.de/p/nutella,,,",
      "nutella-vs-ja-de,brand,4.19,2026-11-12,,,,",
      "nutella-vs-ja-de,brand,4.19,2026-11-12,https://shop.rewe.de/p/nutella,,scrape,",
    ].join("\n"),
  );
  const { candidates, notes } = manualCandidates(rows, [record()], TODAY);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, "rewe");
  assert.equal(candidates[0].note, "Shelf tag");
  assert.equal(notes.length, 7);
  assert.match(notes.join("\n"), /priced in EUR/);
  assert.match(notes.join("\n"), /isn't a past ISO day/);
  assert.match(notes.join("\n"), /isn't hand or shopper-report/);
});

/* ------------------------------------------------------------------ decide */

test("decide: an unchanged price is logged and moves price_checked to the older side's month", () => {
  const r = record();
  const log = [obs(), obs({ side: "alternative", price: 1.99, seen: "2026-10-21" })];
  const d = decide([r], [cand(), cand({ side: "alternative", price: 1.99, seen: "2026-11-11" })], log, { today: TODAY });
  assert.equal(d.confirmed, 2);
  assert.equal(d.observations.length, 2);
  assert.equal(d.review.length, 0);
  assert.deepEqual(d.updates[0].edits, [{ path: [0, "price_checked"], value: "2026-11" }]);
  assert.equal(d.updates[0].changes.length, 0);
  const one = decide([r], [cand()], log, { today: TODAY });
  assert.equal(one.updates.length, 0, "the other side is still October, so the record's month stays");
});

test("decide: a small move that keeps the saving is applied, with its observation", () => {
  const r = record();
  const d = decide([r], [cand({ price: 4.29 })], [obs(), obs({ side: "alternative", price: 1.99, seen: "2026-11-01" })], { today: TODAY });
  assert.equal(d.review.length, 0);
  assert.deepEqual(d.updates[0].edits, [
    { path: [0, "brand", "price"], value: 4.29 },
    { path: [0, "price_checked"], value: "2026-11" },
  ]);
  assert.equal(d.updates[0].changes[0].changePct, 7.5);
  assert.equal(d.observations.length, 1);
  assert.equal(d.observations[0].price, 4.29);
});

test("decide: a move over the bound goes to review and the record is left alone", () => {
  const r = record();
  const d = decide([r], [cand({ price: 5.49 })], [], { today: TODAY });
  assert.equal(d.updates.length, 0);
  assert.equal(d.observations.length, 0, "a doubtful price isn't logged as seen");
  assert.deepEqual(d.review[0].reasons, ["big-move"]);
  assert.equal(d.review[0].observations[0].price, 5.49);
  assert.equal(decide([r], [cand({ price: 5.38 })], [], { today: TODAY }).updates.length, 1, "34.8% is within the bound");
  assert.equal(decide([r], [cand({ price: 5.49 })], [], { today: TODAY, maxMove: 0.5 }).review.length, 0, "the bound is configurable");
});

test("decide: a swap that would save under 5% is never kept silently", () => {
  // ja! 1.99 per 400 g against Nutella 3.99 per 450 g saves 44%. Nutella down to 2.20 leaves 1.8%.
  const r = record();
  const cheaperBrand = decide([r], [cand({ price: 2.2 })], [], { today: TODAY, maxMove: 0.5 });
  assert.equal(cheaperBrand.updates.length, 0);
  assert.deepEqual(cheaperBrand.review[0].reasons, ["saving-gone"]);
  assert.equal(cheaperBrand.review[0].savingNow, 43.9);
  assert.equal(cheaperBrand.review[0].savingAfter, -1.8);
  // Within the bound on both sides and still under the floor.
  const close = record({ brand: { price: 2.4 }, alternative: { price: 2.0 } });
  assert.ok(savingPct(close) > 5);
  const d = decide([close], [cand({ price: 2.25 }), cand({ side: "alternative", price: 2.05 })], [], { today: TODAY });
  assert.deepEqual(d.review[0].reasons, ["saving-gone"]);
  assert.equal(d.updates.length, 0);
  const summary = summarize(d, [], { written: 0, dryRun: false });
  assert.match(summary, /1 record\(s\) would save under 5%/);
  assert.match(summary, /NOT changed/);
  assert.match(summarize(decide([r], [], [], { today: TODAY }), [], { written: 0, dryRun: true }), /None: every swap/);
});

test("decide: a source's pack that isn't the record's goes to review", () => {
  const r = record({ brand: { size: 400, product: "Nutella, 400 g" } });
  const d = decide([r], [cand({ pack: { size: 450, unit: "g" } })], [], { today: TODAY });
  assert.deepEqual(d.review[0].reasons, ["pack-mismatch"]);
  assert.equal(d.confirmed, 0, "even at the same price");
  assert.equal(packMismatch({ size: 0.45, unit: "kg" }, { size: 450, unit: "g" }), false);
  assert.equal(packMismatch({ size: 30, unit: "tablet" }, { size: 450, unit: "g" }), false, "count against weight: unknown, not a mismatch");
  assert.equal(packMismatch({ size: 16, unit: "fl oz" }, { size: 500, unit: "ml" }), true);
});

test("decide: money checks are repeated, old readings and repeats are ignored, people beat feeds", () => {
  const r = record();
  assert.equal(decide([r], [cand({ currency: "GBP", price: 4.1 })], [], { today: TODAY }).updates.length, 0, "wrong currency");
  assert.equal(decide([r], [cand({ record: "unknown" })], [], { today: TODAY }).updates.length, 0);
  const newer = [obs({ seen: "2026-11-12" })];
  assert.equal(decide([r], [cand({ price: 4.29, seen: "2026-11-10" })], newer, { today: TODAY }).updates.length, 0, "older than what we have");
  const logged = cand({ price: 4.29 });
  const once = decide([r], [logged], [], { today: TODAY });
  assert.equal(decide([r], [logged], once.observations, { today: TODAY }).updates.length, 0, "already logged");
  const both = decide([r], [cand({ price: 4.29, method: "open-prices" }), cand({ price: 4.19, method: "hand", source: "rewe" })], [], { today: TODAY });
  assert.equal(both.updates[0].changes[0].to, 4.19);
});

test("kits: the saving is the pieces scaled to the kit against the kit's price", () => {
  const kit = recordsFromBundleFile(
    "/data/bundles/t.json",
    JSON.stringify([
      {
        slug: "kit-a",
        market: "US",
        price_checked: "2026-11",
        bundle: { brand: "B", name: "Kit", price: 50, retailer: "amazon", url: "https://a.example/k", items: [{ name: "x", size: 100, unit: "ml" }, { name: "y", size: 50, unit: "ml" }] },
        components: [
          { brand: "C", product: "X", size: 200, unit: "ml", price: 20, retailer: "amazon", url: "https://a.example/x", replaces: 0 },
          { brand: "C", product: "Y", size: 50, unit: "ml", price_usd: 10, retailer: "amazon", url: "https://a.example/y", replaces: 1 },
        ],
      },
    ]),
  )[0];
  assert.deepEqual(
    kit.sides.map((s) => s.side),
    ["kit", "item-0", "item-1"],
  );
  assert.equal(kit.sides[2].priceKey, "price_usd");
  assert.equal(savingPct(kit), 60); // 10 + 10 against 50
  const d = decide([kit], [cand({ record: "kit-a", side: "kit", price: 22, currency: "USD" })], [], { today: TODAY });
  assert.ok(d.review[0].reasons.includes("big-move"));
  const fine = decide([kit], [cand({ record: "kit-a", side: "item-1", price: 11, currency: "USD" })], [], { today: TODAY });
  assert.deepEqual(fine.updates[0].edits[0], { path: [0, "components", 1, "price_usd"], value: 11 });
});

/* ----------------------------------------------------------------- writing */

test("refresh: edits for one file are applied together and checked", () => {
  const files = new Map([["/data/pairs/test.json", JSON.stringify([pairJson(), pairJson({ slug: "second-de" })], null, 2) + "\n"]]);
  const records = recordsFromPairFile("/data/pairs/test.json", files.get("/data/pairs/test.json")!);
  const d = decide(records, [cand({ price: 4.29 }), cand({ record: "second-de", side: "alternative", price: 2.09 })], [], { today: TODAY });
  applyEdits(
    d.updates,
    (f) => files.get(f)!,
    (f, t) => files.set(f, t),
  );
  const out = files.get("/data/pairs/test.json")!;
  const parsed = JSON.parse(out);
  assert.equal(parsed[0].brand.price, 4.29);
  assert.equal(parsed[1].alternative.price, 2.09);
  assert.equal(parsed[0].price_checked, "2026-10", "the other side has no observation yet, so the month stays");
  assert.ok(out.endsWith("}\n]\n"), "the file's ending is kept");
});

test("review file: no duplicates, and a newer case for a record replaces its older one", () => {
  const item = (id: string, record: string) => ({ id, record }) as ReviewItem;
  const current = { updated: "2026-11-06", items: [item("a", "x"), item("b", "y")] };
  const merged = mergeReview(current, [item("a", "x"), item("c", "y")], TODAY);
  assert.deepEqual(
    merged.items.map((i) => i.id),
    ["a", "c"],
  );
  assert.equal(merged.updated, TODAY);
  assert.equal(mergeReview(current, [item("a", "x")], TODAY).updated, "2026-11-06");
});

test("the committed log and review file are valid", () => {
  const { observations, errors } = loadObservations();
  assert.deepEqual(errors, []);
  assert.ok(observations.length > 0);
  assert.ok(Array.isArray(readReview().items));
});

/* ------------------------------------------------- accepting a re-sourcing */

/** A temporary copy of the data a review case touches, so the real files are never written. */
function acceptData(pairs: unknown[], items: unknown[]): Paths {
  const dir = mkdtempSync(join(tmpdir(), "sbc-accept-"));
  const paths: Paths = { pairDir: join(dir, "pairs"), bundleDir: join(dir, "bundles"), observationsDir: join(dir, "obs"), reviewFile: join(dir, "review.json"), feedRunsFile: join(dir, "feed-runs.json") };
  for (const d of [paths.pairDir, paths.bundleDir, paths.observationsDir]) mkdirSync(d, { recursive: true });
  writeFileSync(join(paths.pairDir, "de.json"), JSON.stringify(pairs, null, 2) + "\n");
  writeFileSync(paths.reviewFile, JSON.stringify({ updated: TODAY, items }, null, 2) + "\n");
  return paths;
}

const RESOURCED = pairJson({
  slug: "ben-u-ron-vs-paracetamol-de",
  brand: { brand: "ben-u-ron", product: "ben-u-ron 500 mg, 20 tablets", size: 20, unit: "tablet", price: 3.5, retailer: "medikamente-per-klick", url: "https://www.medikamente-per-klick.de/ben-u-ron-00116694", gtin: undefined, asin: null },
  alternative: { brand: "ADGC", product: "Paracetamol ADGC 500 mg, 20 tablets", size: 20, unit: "tablet", price: 0.99, retailer: "shopapotheke", url: "https://www.shop-apotheke.com/arzneimittel/17502496/paracetamol-adgc-500-mg.htm", gtin: undefined, rating: { stars: 4.9, count: 27, source: "https://www.shop-apotheke.com/arzneimittel/17502496/paracetamol-adgc-500-mg.htm" } },
});

function resourcedCase(over: Partial<Observation> = {}) {
  const at = (side: string, price: number, url: string) => obs({ record: "ben-u-ron-vs-paracetamol-de", side, price, seen: TODAY, logged: TODAY, source: "aponeo", url, note: "Re-source check at aponeo", ...over });
  return {
    id: "8988c42bf7",
    created: TODAY,
    record: "ben-u-ron-vs-paracetamol-de",
    kind: "swap",
    market: "DE",
    currency: "EUR",
    reasons: ["big-move"],
    detail: ["ben-u-ron: 3.5 to 4.99 (+42.6%), more than 35%"],
    savingNow: 71.7,
    savingAfter: 72.1,
    changes: [],
    observations: [at("brand", 4.99, "https://www.aponeo.de/00116694-ben-u-ron-500-mg-tabletten.html"), at("alternative", 1.39, "https://www.aponeo.de/17502496-paracetamol-adgc-500-mg-tabletten.html")],
  };
}

test("accept: a reviewed price from another store moves the side's link and store with it", () => {
  const paths = acceptData([RESOURCED], [resourcedCase()]);
  const message = accept("8988c42bf7", TODAY, paths);
  const [rec] = JSON.parse(readFileSync(join(paths.pairDir, "de.json"), "utf8"));
  assert.equal(rec.brand.price, 4.99);
  assert.equal(rec.alternative.price, 1.39);
  assert.equal(rec.brand.url, "https://www.aponeo.de/00116694-ben-u-ron-500-mg-tabletten.html");
  assert.equal(rec.brand.retailer, "aponeo");
  assert.equal(rec.alternative.url, "https://www.aponeo.de/17502496-paracetamol-adgc-500-mg-tabletten.html");
  assert.equal(rec.alternative.retailer, "aponeo");
  assert.equal(rec.price_checked, "2026-11");
  assert.match(message, /Moved: brand moved from medikamente-per-klick\.de to aponeo\.de; alternative moved from shop-apotheke\.com to aponeo\.de/);
  assert.match(message, /still mention shop-apotheke\.com/, "the rating read at the old store is flagged for a person");
  const { observations } = loadObservations(paths.observationsDir);
  assert.equal(observations.length, 2);
  assert.ok(observations.every((o) => o.source === "aponeo" && /Accepted from review 8988c42bf7/.test(o.note ?? "")));
  assert.deepEqual(readReview(paths.reviewFile).items, []);
});

test("accept: a price from the record's own store moves nothing; an unknown store is refused, not guessed", () => {
  const same = acceptData([RESOURCED], [{ ...resourcedCase(), observations: [obs({ record: "ben-u-ron-vs-paracetamol-de", side: "brand", price: 4.2, seen: TODAY, logged: TODAY, source: "medikamente-per-klick", url: "https://www.medikamente-per-klick.de/ben-u-ron-00116694" })] }]);
  const msg = accept("8988c42bf7", TODAY, same);
  const [rec] = JSON.parse(readFileSync(join(same.pairDir, "de.json"), "utf8"));
  assert.equal(rec.brand.price, 4.2);
  assert.equal(rec.brand.retailer, "medikamente-per-klick");
  assert.doesNotMatch(msg, /Moved/);
  const unknown = acceptData([RESOURCED], [resourcedCase({ source: "manual" })]);
  assert.throws(() => accept("8988c42bf7", TODAY, unknown), /isn't a known retailer id/);
  const [untouched] = JSON.parse(readFileSync(join(unknown.pairDir, "de.json"), "utf8"));
  assert.equal(untouched.brand.price, 3.5, "nothing is written when the move is refused");
  const amazon = acceptData(
    [pairJson({ slug: "ben-u-ron-vs-paracetamol-de", brand: { ...RESOURCED.brand, retailer: "amazon", url: "https://www.amazon.de/dp/B000000001", asin: "B000000001" } })],
    [{ ...resourcedCase(), observations: [resourcedCase().observations[0]] }],
  );
  accept("8988c42bf7", TODAY, amazon);
  const [moved] = JSON.parse(readFileSync(join(amazon.pairDir, "de.json"), "utf8"));
  assert.equal(moved.brand.asin, null, "off Amazon, the ASIN goes");
});
