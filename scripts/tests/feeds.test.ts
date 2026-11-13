/**
 * Affiliate product feeds: each network's reader against a synthetic fixture written from its documentation (no
 * real feed has been read: none is reachable from here and no account is approved), streaming on a large generated
 * feed, conservative matching, and what a match does through the price pipeline: observation, decision, stock,
 * tracked link, licence buckets, kits, the run record /admin reads, and the readiness check.
 *
 *   npx tsx --test scripts/tests/feeds.test.ts
 */
import assert from "node:assert/strict";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGzip, gzipSync } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { feedClickLink, feedLinkNetwork, feedLinkOr } from "../../src/lib/feed-links";
import { feedReadiness, type FeedRuns } from "../../src/lib/feed-status";
import { outOfStockSides, priceDoubtful, stockNote, type Freshness } from "../../src/lib/freshness";
import { resetAffiliateEnv, tagLink } from "../../src/lib/affiliate-links";
import { collectFeed, feedAdapter, feedRows, parseFeedConfig, type FeedConfig } from "../prices/adapters/feed";
import type { AdapterContext, Candidate } from "../prices/adapters/types";
import { feedInfoFor, priceSeenFor } from "../prices/attach";
import { decide } from "../prices/decide";
import { mergeFeedRuns } from "../prices/feed-runs";
import { parseColumnMaps } from "../prices/feeds/formats";
import { isSearchUrl, storeIdOf } from "../prices/feeds/ids";
import { FeedMatcher, nameWords, samePack } from "../prices/feeds/match";
import { currencyIn, gtinsOf, isoDayOf, parsePack, parsePrice, stockOf, type FeedRow } from "../prices/feeds/row";
import { credentialsOf, csvRecords, jsonItems, openFeed, textOf } from "../prices/feeds/stream";
import { licenceReport } from "../prices/licence";
import { observationSchema, type Observation } from "../prices/observations";
import { recordsFromBundleFile, recordsFromPairFile, type PricedRecord } from "../prices/records";
import { run, type Paths } from "../prices/refresh";

const TODAY = "2026-11-13";
const FIX = join(import.meta.dirname, "..", "prices", "fixtures");
const FEEDS = join(FIX, "feeds");
const ctx: AdapterContext = { today: TODAY, env: {}, sleep: async () => {}, fetch: async () => assert.fail("no network in tests") };

async function rowsOf(spec: string, env: Record<string, string> = {}) {
  const feed = parseFeedConfig(spec).feeds[0];
  assert.ok(feed, `config ${spec}`);
  const out: FeedRow[] = [];
  for await (const r of feedRows(feed, { ...ctx, env }, parseColumnMaps(env.PRICE_FEED_COLUMNS).maps.get(`${feed.retailer}@${feed.market}`))) out.push(r);
  return out;
}

async function* chunked(text: string, size: number) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect<T>(it: AsyncIterable<T>) {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

/* ----------------------------------------------------------- small parsers */

test("prices, currencies, barcodes, dates and stock words from any network", () => {
  assert.equal(parsePrice("12.99"), 12.99);
  assert.equal(parsePrice("12,99"), 12.99);
  assert.equal(parsePrice("1.299,00 EUR"), 1299);
  assert.equal(parsePrice("$1,299.00"), 1299);
  assert.equal(parsePrice("15.00 USD"), 15);
  assert.equal(parsePrice("0"), null);
  assert.equal(parsePrice(""), null);
  assert.equal(currencyIn("15.00 usd"), "USD");
  assert.deepEqual(gtinsOf("0300450000019", "abc", "123", "300450000019 4006381333931"), ["0300450000019", "300450000019", "4006381333931"]);
  assert.equal(isoDayOf("2026-11-12 04:10:00"), "2026-11-12");
  assert.equal(isoDayOf("11/12/2026 03:15:42"), "2026-11-12");
  assert.equal(isoDayOf("12.11.2026"), "2026-11-12");
  assert.equal(isoDayOf("garbage"), null);
  for (const s of ["1", "true", "InStock", "in stock", "in-stock", "ja", "auf Lager"]) assert.equal(stockOf(s), true, s);
  for (const s of ["0", "OutOfStock", "out of stock", "out-of-stock", "sold out", "nein", "ausverkauft"]) assert.equal(stockOf(s), false, s);
  assert.equal(stockOf(""), null, "a feed that doesn't say never takes a record out of the lead");
  assert.equal(stockOf("PreOrder"), null);
});

test("packs from names and pack columns", () => {
  assert.deepEqual(parsePack("Nutella, 450 g"), { size: 450, unit: "g" });
  assert.deepEqual(parsePack("Cola 1,5 l"), { size: 1.5, unit: "l" });
  assert.deepEqual(parsePack("Soup 4 x 400 g"), { size: 1600, unit: "g" });
  assert.deepEqual(parsePack("Ibuprofen 200 mg, 100 Count"), { size: 100, unit: "count" });
  assert.deepEqual(parsePack("Paracetamol 500 mg 20 Stück"), { size: 20, unit: "count" });
  assert.deepEqual(parsePack("Batteries, pack of 4"), { size: 4, unit: "count" });
  assert.equal(parsePack("Garden Hose"), null);
  assert.equal(parsePack("450 g and 900 g"), null, "two packs: unknown, not a guess");
  assert.ok(samePack({ size: 15, unit: "fl oz" }, { size: 15, unit: "fl oz" }));
  assert.ok(samePack({ size: 1, unit: "kg" }, { size: 1000, unit: "g" }));
  assert.ok(samePack({ size: 100, unit: "tablet" }, { size: 100, unit: "count" }));
  assert.ok(!samePack({ size: 100, unit: "tablet" }, { size: 200, unit: "count" }));
  assert.ok(!samePack({ size: 450, unit: "g" }, { size: 450, unit: "ml" }));
});

test("store numbers come from the URL shapes already in the catalogue", () => {
  assert.deepEqual(storeIdOf("https://www.walmart.com/ip/Equate-Ibuprofen/10315394"), { store: "walmart", id: "10315394" });
  assert.deepEqual(storeIdOf("https://walmart.com/ip/seort/594995460"), { store: "walmart", id: "594995460" });
  assert.deepEqual(storeIdOf("https://www.walmart.ca/en/ip/equate-bisacody/2N9MU335BWGS"), { store: "walmart", id: "2N9MU335BWGS" });
  assert.deepEqual(storeIdOf("https://www.target.com/p/oil-free-acne-wash/-/A-91551186"), { store: "target", id: "91551186" });
  assert.deepEqual(storeIdOf("https://www.zooplus.de/shop/hunde/x/royal_canin_size/medium/1983704?activeVariant=1983704.2"), { store: "zooplus", id: "1983704", variant: "1983704.2" });
  assert.deepEqual(storeIdOf("https://www.zooplus.ie/shop/dogs/dry_dog_food/josera/2473762"), { store: "zooplus", id: "2473762" });
  assert.equal(storeIdOf("https://www.zooplus.de/shop/x/1983704?activeVariant=999.1"), null, "a variant of another product");
  assert.deepEqual(storeIdOf("https://www.shop-apotheke.com/arzneimittel/17502496/paracetamol-adgc-500-mg.htm"), { store: "shopapotheke", id: "17502496" });
  assert.deepEqual(storeIdOf("https://www.shop-apotheke.com/beauty/14017524/cerave.htm"), { store: "shopapotheke", id: "14017524" });
  assert.deepEqual(storeIdOf("https://www.chewy.com/petarmor-plus-flea-tick-spot/dp/181538"), { store: "chewy", id: "181538" });
  assert.deepEqual(storeIdOf("https://www.tesco.com/groceries/en-GB/products/265327225"), { store: "tesco", id: "265327225" });
  assert.deepEqual(storeIdOf("https://www.pollin.de/p/varta-batterie-energy-30-stueck-272634"), { store: "pollin", id: "272634" });
  assert.deepEqual(storeIdOf("https://www.crocus.co.uk/product/_/felco-original-secateurs-model-no-2/classid.200601/"), { store: "crocus", id: "200601" });
  assert.equal(storeIdOf("https://www.target.com/s?searchTerm=ranch"), null);
  assert.equal(storeIdOf("https://www.tesco.com/groceries/en-GB/search?query=ketchup"), null);
  assert.ok(isSearchUrl("https://www.walmart.com/search?q=Heinz+Tomato+ketchup"));
  assert.ok(isSearchUrl("https://www.shop-apotheke.com/search.htm?q=avene"));
  assert.ok(!isSearchUrl("https://www.walmart.com/ip/x/123456"));
});

/* --------------------------------------------------------------- streaming */

test("csv: quotes, doubled quotes, delimiters and new lines inside quotes survive any chunk boundary", async () => {
  const text = 'a,b,c\r\n"x, y","say ""hi""",3\r\n\r\nq,,"multi\nline"\n';
  for (const size of [1, 2, 3, 7, 1000]) {
    const recs = await collect(csvRecords(chunked(text, size)));
    assert.deepEqual(recs, [["a", "b", "c"], ["x, y", 'say "hi"', "3"], ["q", "", "multi\nline"]], `chunk ${size}`);
  }
  assert.deepEqual(await collect(csvRecords(chunked("a|b\n1|2", 1))), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(await collect(csvRecords(chunked("a;b\n1,5;2\n", 2))), [["a", "b"], ["1,5", "2"]]);
});

test("json: items under Items, a root array, or NDJSON, across chunk boundaries, with braces inside strings", async () => {
  const wrapped = JSON.stringify({ "@page": "1", "@nextpageuri": "x", Items: [{ a: "1", b: "{]" }, { a: "2", nested: { x: [1, { y: 2 }] } }], After: [{ a: "no" }] });
  const root = JSON.stringify([{ a: "1" }, { a: "2", s: 'q"[{' }]);
  const nd = '{"a":"1"}\n{"a":"2"}\n';
  for (const size of [1, 5, 1000]) {
    assert.deepEqual((await collect(jsonItems(chunked(wrapped, size)))).map((o) => o.a), ["1", "2"], `wrapped ${size}`);
    assert.deepEqual((await collect(jsonItems(chunked(root, size)))).map((o) => o.a), ["1", "2"], `root ${size}`);
    assert.deepEqual((await collect(jsonItems(chunked(nd, size)))).map((o) => o.a), ["1", "2"], `ndjson ${size}`);
  }
});

test("open: gzip by magic bytes, zip refused, credentials moved into a header and never into a message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-feeds-"));
  const gz = join(dir, "f.csv.gz");
  writeFileSync(gz, gzipSync("a,b\n1,2\n"));
  assert.deepEqual(await collect(csvRecords(textOf(await openFeed(gz, ctx.fetch)))), [["a", "b"], ["1", "2"]]);
  const zip = join(dir, "f.zip");
  writeFileSync(zip, Buffer.from([0x50, 0x4b, 3, 4, 0, 0]));
  await assert.rejects(openFeed(zip, ctx.fetch), /zip compression isn't supported/);
  await assert.rejects(openFeed(join(dir, "missing.csv"), ctx.fetch), /file not found/);
  const c = credentialsOf("https://SID123:tok%2Fen@api.impact.com/Mediapartners/SID123/Catalogs/1/Items");
  assert.equal(c.url, "https://api.impact.com/Mediapartners/SID123/Catalogs/1/Items");
  assert.equal(c.headers.Authorization, `Basic ${Buffer.from("SID123:tok/en").toString("base64")}`);
  let seen: { url: string; headers?: Record<string, string> } | null = null;
  const fetcher: AdapterContext["fetch"] = async (url, init) => {
    seen = { url, headers: init?.headers };
    return { ok: false, status: 401, arrayBuffer: async () => new ArrayBuffer(0) };
  };
  await assert.rejects(openFeed("https://user:SECRET@feeds.example/x.csv", fetcher), (e: Error) => e.message === "HTTP 401");
  assert.equal(seen!.url, "https://feeds.example/x.csv");
  assert.ok(seen!.headers!.Authorization.startsWith("Basic "));
});

test("a large gzip feed streams in bounded memory", { timeout: 120_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "sbc-feeds-big-"));
  const path = join(dir, "big.csv.gz");
  const ROWS = 300_000;
  const header = "aw_deep_link,product_name,merchant_product_id,search_price,currency,ean,in_stock,merchant_deep_link,product_short_description\n";
  async function* lines() {
    yield header;
    const filler = "x".repeat(120);
    for (let i = 0; i < ROWS; i++) {
      yield `https://www.awin1.com/pclick.php?p=${i}&a=1&m=2,"Product ${i}, ${(i % 900) + 100} g",SKU${i},${(i % 50) + 0.99},EUR,${String(4000000000000 + i)},1,https://shop.example/p/${i},"${filler} ${i}"\n`;
    }
  }
  await pipeline(Readable.from(lines()), createGzip(), createWriteStream(path));
  const raw = ROWS * 260;
  const feed: FeedConfig = parseFeedConfig(`awin:rewe@DE=${path}`).feeds[0];
  global.gc?.();
  const base = process.memoryUsage().heapUsed;
  let peak = 0;
  let n = 0;
  let lastPrice = 0;
  for await (const row of feedRows(feed, ctx)) {
    n++;
    lastPrice = row.price ?? 0;
    if (n % 20_000 === 0) peak = Math.max(peak, process.memoryUsage().heapUsed - base);
  }
  assert.equal(n, ROWS);
  assert.equal(lastPrice, ((ROWS - 1) % 50) + 0.99);
  // About 78 MB of text; reading it all in would take well over that in heap.
  assert.ok(peak < 60 * 1024 * 1024, `heap grew by ${Math.round(peak / 1e6)} MB on a ~${Math.round(raw / 1e6)} MB feed`);
});

/* --------------------------------------------------------------- networks */

test("awin: Create-a-Feed columns, aw_deep_link as the tracked link, merchant_deep_link as the page", async () => {
  const rows = await rowsOf(`awin:boots@GB=${join(FIX, "awin-feed.synthetic.csv")}`);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0].gtins, ["5000000000012"]);
  assert.equal(rows[0].price, 2.1);
  assert.equal(rows[0].name, "Test Paracetamol Tablets 500mg, 32 pack");
  assert.equal(rows[1].name, 'Test Ibuprofen "Express" 16 pack');
  assert.equal(rows[0].deepLink, "https://www.awin1.com/pclick.php?p=1001&a=0&m=9999");
  assert.equal(rows[0].productUrl, "https://www.test-chemist.example/p/paracetamol-32");
  assert.deepEqual(rows[0].skus, ["TP-32", "1001"]);
  assert.equal(rows[2].inStock, false);
  assert.equal(rows[3].currency, "EUR");
  assert.equal(rows[4].currency, null);
  assert.equal(rows[0].updated, "2026-11-12");
  assert.equal(rows[0].merchant, "9999");
  assert.equal(rows[0].retailer, "boots");
});

test("impact: catalogue items JSON, sale price, stock words, destination inside the tracked link", async () => {
  const rows = await rowsOf(`impact:walmart@US=${join(FEEDS, "impact-catalog-items.synthetic.json")}`);
  assert.equal(rows.length, 4);
  const [ibu, adv, lor] = rows;
  assert.equal(ibu.price, 3.48, "CurrentPrice under OriginalPrice is what a shopper pays");
  assert.equal(ibu.brand, "Test Value");
  assert.deepEqual(ibu.skus, ["10315394"]);
  assert.equal(ibu.productUrl, "https://www.walmart.com/ip/Test-Value-Ibuprofen/10315394");
  assert.equal(feedLinkNetwork(ibu.deepLink!), "impact");
  assert.equal(ibu.inStock, true);
  assert.equal(adv.inStock, false);
  assert.deepEqual(adv.gtins, ["300450000019"]);
  assert.equal(lor.inStock, null, "PreOrder is not a stock answer");
  assert.equal(ibu.updated, null, "items carry no date: the day read stands in");
});

test("impact: the API is paged, asked as JSON with Basic auth, page after page until a short one", async () => {
  const asked: { url: string; headers?: Record<string, string> }[] = [];
  const page = (n: number) => JSON.stringify({ Items: Array.from({ length: n }, (_, i) => ({ Name: `P${i}`, CurrentPrice: "1.00", Url: "https://goto.walmart.com/c/1/2/3" })) });
  const fetcher: AdapterContext["fetch"] = async (url, init) => {
    asked.push({ url, headers: init?.headers });
    const p = Number(new URL(url).searchParams.get("Page"));
    const body = new TextEncoder().encode(page(p < 3 ? 2 : 1));
    return { ok: true, status: 200, arrayBuffer: async () => body.buffer as ArrayBuffer };
  };
  const feed = parseFeedConfig("impact:walmart@US=https://SID:TOKEN@api.impact.com/Mediapartners/SID/Catalogs/5001/Items?PageSize=2").feeds[0];
  const rows = await collect(feedRows(feed, { ...ctx, fetch: fetcher }));
  assert.equal(rows.length, 5);
  assert.deepEqual(asked.map((a) => new URL(a.url).searchParams.get("Page")), ["1", "2", "3"]);
  assert.ok(asked.every((a) => a.headers?.Accept === "application/json" && a.headers?.Authorization?.startsWith("Basic ") && !a.url.includes("TOKEN")));
});

test("cj: Google-style columns, price with its currency, sale price, tracked click hosts", async () => {
  const rows = await rowsOf(`cj:cvs@US=${join(FEEDS, "cj-product-feed.synthetic.csv")}`);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].price, 4.99);
  assert.equal(rows[0].currency, "USD");
  assert.deepEqual(rows[0].gtins, ["0300450000019"]);
  assert.equal(rows[0].productUrl, "https://www.test-pharmacy.example/p/ibu-100");
  assert.equal(feedLinkNetwork(rows[1].deepLink!), "cj");
  assert.equal(rows[1].inStock, false);
  assert.equal(rows[2].updated, "2026-07-01");
  assert.equal(rows[0].merchant, "Test Pharmacy");
});

test("rakuten: pipe-delimited by position, HDR date for every row, TRL skipped, quoted pipes", async () => {
  const rows = await rowsOf(`rakuten:target@US=${join(FEEDS, "rakuten-product-catalog.synthetic.txt")}`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Test Value Ibuprofen Tablets 200 mg, 100 Count");
  assert.equal(rows[0].price, 5.99);
  assert.deepEqual(rows[0].gtins, ["300450000019"]);
  assert.equal(rows[0].brand, "Test Value");
  assert.equal(rows[0].inStock, true);
  assert.equal(rows[1].inStock, false);
  assert.equal(rows[0].updated, "2026-11-12");
  assert.equal(rows[0].productUrl, "https://www.test-outfitters.example/ibu");
  assert.equal(feedLinkNetwork(rows[0].deepLink!), "rakuten");
});

test("flexoffers: assumed JSON fields, sale price, tracked link", async () => {
  const rows = await rowsOf(`flexoffers:tesco@GB=${join(FEEDS, "flexoffers-products.synthetic.json")}`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 0.99);
  assert.equal(rows[0].productUrl, "https://www.tesco.com/groceries/en-GB/products/265327225");
  assert.equal(feedLinkNetwork(rows[0].deepLink!), "flexoffers");
  assert.equal(rows[1].inStock, false);
});

test("generic: a network nobody named, read through a column map alone", async () => {
  const map = "rewe@DE: name=Artikelname; brand=Marke; gtin=EAN; sku=Artikelnummer; price=Preis; currency=Waehrung; stock=Verfuegbar; link=Partnerlink; url=Produktseite; updated=Stand";
  const rows = await rowsOf(`generic:rewe@DE=${join(FEEDS, "generic-semicolon.synthetic.csv")}`, { PRICE_FEED_COLUMNS: map });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "Test Nuss-Nougat-Creme; 400 g");
  assert.equal(rows[0].price, 1.99);
  assert.equal(rows[1].price, 4.29);
  assert.equal(rows[1].inStock, false);
  assert.equal(rows[0].updated, "2026-11-12");
  // A generic feed without a map names what it needs instead of guessing.
  const feed = parseFeedConfig(`csv:rewe@DE=${join(FEEDS, "generic-semicolon.synthetic.csv")}`).feeds[0];
  const out = await collectFeed(feed, [], ctx);
  assert.match(out.stats.error!, /no column named for name, price, link/);
});

test("config: every network, Awin URLs with commas in them, never a URL in a label, column maps checked", () => {
  const awin = "https://productdata.awin.com/datafeed/download/apikey/SECRET/language/de/fid/1/columns/aw_deep_link,product_name,search_price/format/csv/compression/gzip/";
  const { feeds, problems } = parseFeedConfig(
    `awin:zooplus@DE=${awin}\nimpact:walmart@US=https://a:b@api.impact.com/x, cj:cvs@US=/c.csv, rakuten:target@US=/r.txt\nflexoffers:tesco@GB=/f.json, csv:rewe@DE=/g.csv\nboots@GB=/old.csv\nnope:boots@GB=/x\nwalmart@XX=/a\nother@GB=/b`,
  );
  assert.deepEqual(
    feeds.map((f) => f.label),
    ["awin:zooplus@DE", "impact:walmart@US", "cj:cvs@US", "rakuten:target@US", "flexoffers:tesco@GB", "generic:rewe@DE", "awin:boots@GB"],
  );
  assert.equal(feeds[0].location, awin, "the commas inside an Awin column list stay in the URL");
  assert.equal(problems.length, 3);
  assert.ok(!JSON.stringify([feeds.map((f) => f.label), problems]).includes("SECRET"));
  const maps = parseColumnMaps("tesco@GB: price=Sale Price|Price; link=Tracking URL\nbad line\nrewe@DE: colour=Red");
  assert.deepEqual(maps.maps.get("tesco@GB"), { price: ["Sale Price", "Price"], link: ["Tracking URL"] });
  assert.equal(maps.problems.length, 2);
});

/* ---------------------------------------------------------------- matching */

function pair(slug: string, market: string, brand: Record<string, unknown>, alternative: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { slug, market, price_checked: "2026-10", ...extra, brand: { size: 100, unit: "tablet", ...brand }, alternative: { size: 100, unit: "tablet", ...alternative } };
}

const US_PAIRS = [
  pair(
    "testvil-vs-test-value-ibuprofen",
    "US",
    { brand: "Testvil", product: "Testvil Ibuprofen Tablets 200 mg, 100 Count", price: 11.97, retailer: "walmart", url: "https://www.walmart.com/search?q=testvil", gtin: "300450000019" },
    { brand: "Test Value", product: "Test Value Ibuprofen Tablets 200 mg", price: 3.98, retailer: "walmart", url: "https://www.walmart.com/ip/Test-Value-Ibuprofen/10315394", gtin: "300450000026" },
  ),
  pair(
    "claritest-vs-test-value-loratadine",
    "US",
    { brand: "Claritest", product: "Claritest 10 mg", size: 30, price: 19.99, retailer: "target", url: "https://www.target.com/p/-/A-1234567" },
    { brand: "Test Value", product: "Test Value Loratadine 10 mg", size: 30, price: 4.12, retailer: "walmart", url: "https://www.walmart.com/search?q=loratadine" },
  ),
];

function usRecords() {
  return recordsFromPairFile("/data/pairs/us.json", JSON.stringify(US_PAIRS));
}

const row = (over: Partial<FeedRow>): FeedRow => ({
  retailer: "walmart",
  market: "US",
  name: "",
  brand: null,
  gtins: [],
  skus: [],
  price: 1,
  currency: "USD",
  packText: null,
  inStock: true,
  deepLink: null,
  productUrl: null,
  imageUrl: null,
  updated: null,
  merchant: null,
  ...over,
});

test("matching: barcode, then store number, then name for review; only that store and market", async () => {
  const records = usRecords();
  const m = new FeedMatcher(records, { retailer: "walmart", market: "US" });
  for await (const r of feedRows(parseFeedConfig(`impact:walmart@US=${join(FEEDS, "impact-catalog-items.synthetic.json")}`).feeds[0], ctx)) m.add(r);
  const found = m.result().matches.map((x) => `${x.record.slug}:${x.side.side}:${x.by}`).sort();
  assert.deepEqual(found, [
    "claritest-vs-test-value-loratadine:alternative:name",
    "testvil-vs-test-value-ibuprofen:alternative:id",
    "testvil-vs-test-value-ibuprofen:brand:gtin",
  ]);
  assert.equal(new FeedMatcher(records, { retailer: "walmart", market: "CA" }).sideCount, 0, "another market's records are never matched");
  assert.equal(new FeedMatcher(records, { retailer: "target", market: "US" }).sideCount, 1);
});

test("matching refuses what it can't be sure of: rows that disagree, two name fits, a contradicting barcode, a variant-less zooplus link, another pack", () => {
  const records = usRecords();
  const m = new FeedMatcher(records, { retailer: "walmart", market: "US" });
  m.add(row({ gtins: ["0300450000019"], price: 11.97 }));
  m.add(row({ gtins: ["300450000019"], price: 13.5 }));
  m.add(row({ skus: ["10315394"], gtins: ["9999999999994"], price: 3.98 }));
  m.add(row({ name: "Test Value Loratadine 10 mg, 30 Count", brand: "Test Value", price: 4 }));
  m.add(row({ name: "Test Value Loratadine Tablets 10 mg 30 count", brand: "Test Value", price: 4.5 }));
  m.add(row({ name: "Test Value Loratadine 10 mg, 60 Count", brand: "Test Value", price: 7 }));
  const { matches, ambiguous } = m.result();
  assert.deepEqual(matches, []);
  assert.equal(ambiguous.length, 2);
  assert.match(m.conflicts.join(), /another barcode/);

  const zoo = recordsFromPairFile(
    "/z.json",
    JSON.stringify([
      pair(
        "royal-vs-concept-de",
        "DE",
        { brand: "Royal", product: "Royal Medium", size: 15, unit: "kg", price: 65.99, retailer: "zooplus", url: "https://www.zooplus.de/shop/hunde/royal/1983704?activeVariant=1983704.2" },
        { brand: "Concept", product: "Concept Adult", size: 15, unit: "kg", price: 39.99, retailer: "zooplus", url: "https://www.zooplus.de/shop/hunde/concept/1218920" },
      ),
    ]),
  );
  const z = new FeedMatcher(zoo, { retailer: "zooplus", market: "DE" });
  z.add(row({ retailer: "zooplus", market: "DE", skus: ["1983704"], currency: "EUR", price: 20 }));
  z.add(row({ retailer: "zooplus", market: "DE", productUrl: "https://www.zooplus.de/shop/hunde/concept/1218920?activeVariant=1218920.1", currency: "EUR", price: 9 }));
  assert.deepEqual(z.result().matches, [], "a product number alone covers several pack sizes");
  const z2 = new FeedMatcher(zoo, { retailer: "zooplus", market: "DE" });
  z2.add(row({ retailer: "zooplus", market: "DE", skus: ["1983704.2"], currency: "EUR", price: 64.99 }));
  assert.deepEqual(z2.result().matches.map((x) => `${x.side.side}:${x.by}`), ["brand:id"]);
  assert.deepEqual(nameWords("Test Value Loratadine 10 mg, 30 Count", "Test Value"), ["loratadine"]);
});

/* --------------------------------------------------- through the pipeline */

test("adapter: feed:<network> observations with the tracked link, stock carried, name matches flagged for review", async () => {
  const out = await feedAdapter.collect(usRecords(), { ...ctx, env: { PRICE_FEED_URLS: `impact:walmart@US=${join(FEEDS, "impact-catalog-items.synthetic.json")}` } });
  const by = new Map(out.candidates.map((c) => [`${c.record}:${c.side}`, c]));
  const alt = by.get("testvil-vs-test-value-ibuprofen:alternative")!;
  assert.equal(alt.source, "feed:impact");
  assert.equal(alt.method, "feed");
  assert.equal(alt.price, 3.48);
  assert.equal(alt.seen, TODAY);
  assert.equal(alt.url, "https://www.walmart.com/ip/Test-Value-Ibuprofen/10315394");
  assert.match(alt.link!, /^https:\/\/goto\.walmart\.com\/c\//);
  assert.equal(alt.stock, "in");
  assert.equal(by.get("testvil-vs-test-value-ibuprofen:brand")!.stock, "out");
  assert.match(by.get("claritest-vs-test-value-loratadine:alternative")!.needsReview!, /brand, name and pack/);
  assert.equal(out.feedStats![0].rows, 4);
  assert.deepEqual(out.feedStats![0].matched, { gtin: 1, id: 1, name: 1 });
  assert.ok(!out.notes.join().includes("synthetic.json"), "no location in the notes");
});

function feedCand(over: Partial<Candidate>): Candidate {
  return { record: "testvil-vs-test-value-ibuprofen", side: "alternative", price: 3.98, currency: "USD", seen: TODAY, source: "feed:impact", url: "https://www.walmart.com/ip/x/10315394", method: "feed", link: "https://goto.walmart.com/c/1/2/3", stock: "in", ...over };
}

test("decide: out of stock is logged without touching the price; back in stock and new links are reported; name matches always go to review", () => {
  const records = usRecords();
  const out = decide(records, [feedCand({ side: "brand", price: 11.97, stock: "out" })], [], { today: TODAY });
  assert.equal(out.updates.length, 0);
  assert.equal(out.review.length, 0);
  assert.equal(out.observations.length, 1);
  assert.equal(out.observations[0].stock, "out");
  assert.deepEqual(out.feedChanges.map((f) => f.change), ["out-of-stock"]);
  const wasOut = observationSchema.parse({ ...out.observations[0], seen: "2026-11-06", logged: "2026-11-06" });
  const back = decide(records, [feedCand({ side: "brand", price: 11.97 })], [wasOut], { today: TODAY });
  assert.deepEqual(back.feedChanges.map((f) => f.change), ["back-in-stock"], "same link as before: not reported again");
  assert.equal(back.confirmed, 1);
  const moved = decide(records, [feedCand({ price: 3.48 })], [], { today: TODAY });
  assert.equal(moved.updates[0].changes[0].to, 3.48, "a small move from a feed is applied as from any source");
  assert.equal(moved.observations[0].link, "https://goto.walmart.com/c/1/2/3");
  const named = decide(records, [feedCand({ record: "claritest-vs-test-value-loratadine", price: 4.12, needsReview: "matched by brand, name and pack only" })], [], { today: TODAY });
  assert.equal(named.updates.length, 0);
  assert.deepEqual(named.review[0].reasons, ["name-match"]);
  assert.equal(named.observations.length, 0, "not even a confirmation is logged before a person agrees");
});

function o(over: Partial<Observation>): Observation {
  return observationSchema.parse({ record: "r", side: "alternative", price: 3.98, currency: "USD", seen: "2026-11-01", source: "walmart", url: "https://www.walmart.com/ip/x/1", method: "hand", logged: "2026-11-01", ...over });
}

test("attach: the newest feed line gives the link and stock; an out-of-stock line never dates a price; a later hand check wins", () => {
  const feedIn = o({ seen: "2026-11-10", method: "feed", source: "feed:impact", link: "https://goto.walmart.com/c/1/2/3", stock: "in" });
  const feedOut = o({ seen: "2026-11-12", method: "feed", source: "feed:impact", link: "https://goto.walmart.com/c/1/2/3", stock: "out" });
  assert.deepEqual(feedInfoFor([o({}), feedIn], 3.98), { network: "impact", link: "https://goto.walmart.com/c/1/2/3", seen: "2026-11-10", stock: "in" });
  const seen = priceSeenFor([o({}), feedIn, feedOut], 3.98, "2026-11").seen;
  assert.equal(seen.date, "2026-11-10", "dated by the in-stock reading");
  assert.equal(seen.feed!.stock, "out");
  assert.equal(seen.history.length, 2);
  assert.equal(feedInfoFor([feedIn, o({ seen: "2026-11-11" })], 3.98), undefined, "a newer hand check: the record may have moved");
  assert.equal(feedInfoFor([o({ ...feedIn, link: "https://evil.example/c/1/2/3" })], 3.98)!.link, undefined, "only network click hosts");
  assert.equal(feedInfoFor([feedIn], 4.5), undefined, "a feed price the record doesn't show");
  const freshness: Freshness = { tier: "fresh", date: TODAY, precision: "day", days: 0 };
  assert.ok(priceDoubtful(freshness, { alternative: seen }));
  assert.deepEqual(outOfStockSides({ alternative: seen }), [{ side: "alternative", seen: "2026-11-12" }]);
  assert.equal(stockNote(seen, "Test Value", "Walmart"), "Test Value was out of stock at Walmart when its product feed was read on 12 Nov 2026.");
  assert.ok(!priceDoubtful(freshness, { alternative: { ...seen, feed: { ...seen.feed!, stock: "in" } } }));
});

test("links: a feed's tracked link goes out with our click ID, unknown hosts don't, /go keeps its own address", () => {
  resetAffiliateEnv();
  const env = {};
  assert.equal(tagLink("https://www.awin1.com/pclick.php?p=1&a=2&m=3", "abc", env).url, "https://www.awin1.com/pclick.php?p=1&a=2&m=3&clickref=abc");
  assert.equal(tagLink("https://goto.walmart.com/c/1/2/3?u=x", "abc", env).program, "feed:impact");
  assert.match(tagLink("https://goto.walmart.com/c/1/2/3?u=x", "abc", env).url, /subId1=abc/);
  assert.match(feedClickLink("https://click.linksynergy.com/link?id=a&murl=b", "k")!.url, /u1=k/);
  assert.match(feedClickLink("https://www.anrdoezrs.net/click-1-2", "k")!.url, /sid=k/);
  assert.match(feedClickLink("https://track.flexlinkspro.com/g.ashx?foid=1", "k")!.url, /fobs=k/);
  assert.equal(feedLinkNetwork("https://goto.walmart.com/ip/123"), null, "not an Impact click path");
  assert.equal(feedLinkNetwork("http://www.awin1.com/pclick.php"), null, "never plain http");
  assert.equal(feedLinkNetwork("https://awin1.com.evil.example/x"), null);
  assert.equal(feedLinkOr({ feed: { network: "impact", link: "https://goto.walmart.com/c/1/2/3", seen: TODAY, stock: "in" } }, "https://www.walmart.com/ip/x/1"), "https://goto.walmart.com/c/1/2/3");
  assert.equal(feedLinkOr({}, "https://www.walmart.com/ip/x/1"), "https://www.walmart.com/ip/x/1");
});

test("licence: a side priced from a feed counts as licensed, so the barred count falls", () => {
  const records = usRecords();
  const verdicts = { "walmart.com": "barred" as const, "target.com": "barred" as const };
  const before = licenceReport(records, [], verdicts);
  assert.deepEqual(before.swaps.withFeeds, { ok: 0, unclear: 0, barred: 2 });
  const fed = [
    o({ record: "testvil-vs-test-value-ibuprofen", side: "brand", price: 11.97, method: "feed", source: "feed:impact", seen: TODAY, stock: "out" }),
    o({ record: "testvil-vs-test-value-ibuprofen", side: "alternative", price: 3.98, method: "feed", source: "feed:impact", seen: TODAY }),
  ];
  const after = licenceReport(records, fed, verdicts);
  assert.deepEqual(after.swaps.verdicts, { ok: 0, unclear: 0, barred: 2 }, "store terms alone don't change");
  assert.deepEqual(after.swaps.withFeeds, { ok: 1, unclear: 0, barred: 1 });
  assert.deepEqual(after.licensedSides, { impact: 2 });
});

/* ------------------------------------------------------ whole run, on copies */

function tempData(): Paths {
  const dir = mkdtempSync(join(tmpdir(), "sbc-feed-run-"));
  const paths: Paths = { pairDir: join(dir, "pairs"), bundleDir: join(dir, "bundles"), observationsDir: join(dir, "obs"), reviewFile: join(dir, "review.json"), feedRunsFile: join(dir, "feed-runs.json") };
  for (const d of [paths.pairDir, paths.bundleDir, paths.observationsDir]) mkdirSync(d, { recursive: true });
  writeFileSync(join(paths.pairDir, "us.json"), JSON.stringify(US_PAIRS, null, 2) + "\n");
  const kit = {
    slug: "test-kit-us",
    market: "US",
    price_checked: "2026-10",
    bundle: { brand: "Testvil", name: "Testvil Care Kit", price: 20, retailer: "target", url: "https://www.target.com/p/-/A-7654321", items: [{ name: "Ibuprofen", size: 100, unit: "tablet" }] },
    components: [{ brand: "Test Value", product: "Test Value Ibuprofen Tablets 200 mg", size: 100, unit: "tablet", price: 3.98, retailer: "walmart", url: "https://www.walmart.com/ip/Test-Value-Ibuprofen/10315394", replaces: 0 }],
  };
  writeFileSync(join(paths.bundleDir, "kits.json"), JSON.stringify([kit], null, 2) + "\n");
  return paths;
}

test("run: a dry run writes nothing; a real run prices swaps and kits, logs stock and links, and records the run for /admin", async () => {
  const paths = tempData();
  const env = { PRICE_FEED_URLS: `impact:walmart@US=${join(FEEDS, "impact-catalog-items.synthetic.json")}` };
  const before = readFileSync(join(paths.pairDir, "us.json"), "utf8");
  const dry = await run([feedAdapter], { ...ctx, env }, { dryRun: true, paths });
  assert.match(dry.summary, /Dry run: nothing was written/);
  assert.match(dry.summary, /would be updated/);
  assert.match(dry.summary, /### Out of stock/);
  assert.match(dry.summary, /### Sources we may use/);
  assert.equal(readFileSync(join(paths.pairDir, "us.json"), "utf8"), before);
  assert.ok(!existsSync(paths.feedRunsFile) && !existsSync(paths.reviewFile));

  const real = await run([feedAdapter], { ...ctx, env }, { dryRun: false, paths });
  const pairs = JSON.parse(readFileSync(join(paths.pairDir, "us.json"), "utf8"));
  assert.equal(pairs[0].alternative.price, 3.48);
  assert.equal(pairs[0].brand.price, 11.97, "out of stock: price untouched");
  const kits = JSON.parse(readFileSync(join(paths.bundleDir, "kits.json"), "utf8"));
  assert.equal(kits[0].components[0].price, 3.48, "a kit piece is refreshed the same way as a swap side");
  const log = readFileSync(join(paths.observationsDir, "2026-11.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Observation);
  assert.ok(log.every((x) => x.source === "feed:impact" && x.method === "feed"));
  assert.ok(log.some((x) => x.stock === "out" && x.side === "brand"));
  assert.ok(log.some((x) => x.record === "test-kit-us" && x.side === "item-0" && x.link?.startsWith("https://goto.walmart.com/c/")));
  const review = JSON.parse(readFileSync(paths.reviewFile, "utf8"));
  assert.deepEqual(review.items.map((i: { record: string; reasons: string[] }) => `${i.record}:${i.reasons}`), ["claritest-vs-test-value-loratadine:name-match"]);
  const runs = JSON.parse(readFileSync(paths.feedRunsFile, "utf8")) as FeedRuns;
  assert.deepEqual(Object.keys(runs.networks), ["impact"]);
  const imp = runs.networks.impact;
  assert.equal(imp.rows, 4);
  assert.equal(imp.lastRun, TODAY);
  assert.equal(imp.lastObservation, TODAY);
  assert.equal(imp.refreshed, 2, "the swap and the kit");
  assert.equal(imp.review, 1);
  assert.equal(imp.outOfStock, 1);
  assert.ok(!JSON.stringify(runs).includes("synthetic"), "no location in the run record");
  assert.equal(real.licence.swaps.withFeeds.ok >= 1, true);

  // The same run again changes nothing and logs nothing twice.
  const again = await run([feedAdapter], { ...ctx, env }, { dryRun: false, paths });
  assert.equal(again.decision.updates.length, 0);
  assert.equal(again.decision.observations.length, 0);
});

test("feed runs and readiness: configured networks listed, a quiet one flagged after 14 days", () => {
  const empty: FeedRuns = { updated: null, networks: {}, licence: null };
  const none = feedReadiness(empty, TODAY);
  assert.equal(none.ok, false);
  assert.equal(none.level, "optional");
  const stats = [{ label: "awin:zooplus@DE", network: "awin", retailer: "zooplus", market: "DE", sides: 25, rows: 1000, matched: { gtin: 20, id: 3, name: 1 }, usable: 24, outOfStock: 0, error: null }];
  const obs = [o({ record: "a", method: "feed", source: "feed:awin", seen: "2026-10-01" })];
  const runs = mergeFeedRuns(empty, TODAY, stats, { observations: [], review: [] }, obs, null);
  assert.equal(runs.networks.awin.lastObservation, "2026-10-01");
  const quiet = feedReadiness(runs, TODAY);
  assert.equal(quiet.ok, false);
  assert.equal(quiet.level, "recommended");
  assert.match(quiet.detail, /awin \(zooplus@DE\)/);
  assert.match(quiet.detail, /No price in 14 days from awin \(last 2026-10-01\)/);
  const fine = feedReadiness(mergeFeedRuns(empty, TODAY, stats, { observations: [o({ record: "a", method: "feed", source: "feed:awin", seen: TODAY })], review: [] }, [], null), TODAY);
  assert.equal(fine.ok, true);
  // A network dropped from the secret stops counting as configured on the next run.
  const later = mergeFeedRuns(runs, "2026-11-20", [{ ...stats[0], label: "impact:walmart@US", network: "impact" }], { observations: [], review: [] }, [], null);
  assert.doesNotMatch(feedReadiness(later, "2026-11-20").detail, /awin/);
});

test("pair and bundle readers keep brand, ASIN, sources and evidence for matching, moving and licence", () => {
  const [r] = recordsFromPairFile("/p.json", JSON.stringify([pair("a-vs-b", "US", { brand: "A", product: "A", price: 2, retailer: "amazon", url: "https://www.amazon.com/dp/B000000001", asin: "B000000001" }, { brand: "B", product: "B", price: 1, retailer: "walmart", url: "https://www.walmart.com/ip/b/1234567" }, { sources: ["https://prices.openfoodfacts.org/x"], evidence: "e" })]));
  assert.equal(r.sides[0].brand, "A");
  assert.equal(r.sides[0].asin, "B000000001");
  assert.deepEqual(r.sources, ["https://prices.openfoodfacts.org/x"]);
  const [k] = recordsFromBundleFile("/b.json", readFileSync(join(tempData().bundleDir, "kits.json"), "utf8")) as PricedRecord[];
  assert.equal(k.sides[0].brand, "Testvil");
});
