/**
 * The revenue report (scripts/report-revenue.ts): page types, periods, the Awin and Impact commission exports (synthetic
 * fixtures written from the networks' public docs, never a real export), the join to clicks, the untagged ranking,
 * and one run of the CLI against a real Postgres when TEST_DATABASE_URL is set.
 *
 *   npx tsx --test scripts/tests/revenue.test.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import * as schema from "../../src/db/schema";
import { readExport, readExportFolder, type Earning } from "../revenue/exports";
import { buildReport, mergeEarnings, pageTypeOf, periodOf, renderReport, type ClickRow } from "../revenue/report";
import { viaOfClick, withVia } from "../../src/lib/via";
import { parseArgs } from "../report-revenue";
import { ALL_TABLES, testDb } from "./db-support";

const ROOT = join(import.meta.dirname, "..", "..");
const FIXTURES = join(ROOT, "scripts", "revenue", "fixtures");
const SITE = "https://samebutcheaper.test";

test("page type: from our referrer, country prefixes stripped, else from the link", () => {
  const p = (referrer: string | null, side = "alternative", slug = "advil-vs-equate") => pageTypeOf({ referrer, side, slug }, (s) => s.startsWith("kit-"));
  assert.equal(p(`${SITE}/compare/advil-vs-equate`), "swap");
  assert.equal(p(`${SITE}/de/compare/x`), "swap");
  assert.equal(p(`${SITE}/uk/bundle/x`, "item-2"), "kit");
  assert.equal(p(`${SITE}/basket/new-flat-gb`), "basket");
  assert.equal(p(`${SITE}/check/list?x=1`, "search", "lookup"), "listcheck");
  assert.equal(p(`${SITE}/us/check`, "search", "lookup"), "check");
  assert.equal(p(`${SITE}/my-list`), "list");
  assert.equal(p(`${SITE}/`), "other");
  assert.equal(p(null), "swap", "a swap's buy link is only on its swap page");
  assert.equal(p(null, "bigger"), "swap");
  assert.equal(p(null, "item-0", "kit-a"), "kit");
  assert.equal(p(null, "cart-walmart", "kit-a"), "kit");
  assert.equal(p(null, "brand", "kit-a"), "kit", "a kit's own link");
  assert.equal(p(null, "search", "lookup"), "other");
  assert.equal(p("not a url"), "swap");
});

test("page type: a recorded via wins; old rows without one fall back to the referrer and the link", () => {
  const row = (via: string | null, referrer: string | null = `${SITE}/compare/x`) => pageTypeOf({ referrer, side: "alternative", slug: "x", via });
  assert.equal(row("basket"), "basket");
  assert.equal(row("letter", null), "letter");
  assert.equal(row("listcheck"), "listcheck");
  assert.equal(row(null), "swap", "an old row");
  assert.equal(row("nonsense"), "swap", "an unknown value is ignored");
  assert.equal(pageTypeOf({ referrer: null, side: "alternative", slug: "x" }), "swap", "a row from before the column");
});

test("via at click time: the referring page's marker, then the link's, then the referring page", () => {
  const go = `${SITE}/go/x/alternative`;
  assert.equal(viaOfClick(go, `${SITE}/compare/x?via=basket`, ["samebutcheaper.test"]), "basket");
  assert.equal(viaOfClick(go, `${SITE}/de/compare/x?utm_source=newsletter&via=letter`, ["samebutcheaper.test"]), "letter");
  assert.equal(viaOfClick(`${go}?via=kit`, `${SITE}/bundle/k`, ["samebutcheaper.test"]), "kit");
  assert.equal(viaOfClick(go, `${SITE}/uk/compare/x`, ["samebutcheaper.test"]), "swap");
  assert.equal(viaOfClick(go, `${SITE}/check/list`, ["samebutcheaper.test"]), "listcheck");
  assert.equal(viaOfClick(go, null, ["samebutcheaper.test"]), null, "no referrer: the report reads the link");
  // Someone else's page can't claim a marker.
  assert.equal(viaOfClick(go, "https://elsewhere.example/compare/x?via=letter", ["samebutcheaper.test"]), null);
  assert.equal(viaOfClick(go, `${SITE}/compare/x?via=bogus`, ["samebutcheaper.test"]), "swap");
  assert.equal(withVia("/compare/x", "search"), "/compare/x?via=search");
  assert.equal(withVia("/compare/x?a=1#top", "basket"), "/compare/x?a=1&via=basket#top");
});

test("periods: UTC day, and the Monday of the week", () => {
  assert.equal(periodOf(new Date("2026-11-13T23:30:00Z"), "day"), "2026-11-13");
  assert.equal(periodOf(new Date("2026-11-13T10:00:00Z"), "week"), "2026-11-09");
  assert.equal(periodOf(new Date("2026-11-09T00:00:00Z"), "week"), "2026-11-09");
  assert.equal(periodOf(new Date("2026-11-15T23:59:00Z"), "week"), "2026-11-09");
});

test("exports: the Awin and Impact fixtures read into one shape", () => {
  const awin = readExport(readFileSync(join(FIXTURES, "awin-transactions.synthetic.csv"), "utf8"), "awin.csv");
  assert.equal(awin.problem, null);
  assert.equal(awin.earnings.length, 4);
  assert.deepEqual(
    { ...awin.earnings[0], file: undefined },
    { network: "awin", orderId: "900000001", clickId: "clk00000000000000001", advertiser: "Zooplus DE", commission: 1.35, sale: 44.99, currency: "EUR", status: "pending", day: "2026-11-03", file: undefined },
  );
  assert.equal(awin.earnings[2].status, "reversed", "declined is reversed");
  assert.equal(awin.earnings[3].clickId, null);
  const impact = readExport(readFileSync(join(FIXTURES, "impact-actions.synthetic.csv"), "utf8"), "impact.csv");
  assert.equal(impact.problem, null);
  assert.deepEqual(
    impact.earnings.map((e) => [e.network, e.orderId, e.clickId, e.commission, e.currency, e.status, e.day]),
    [
      ["impact", "19816.4507.1001", "clk00000000000000004", 0.96, "USD", "pending", "2026-11-04"],
      ["impact", "19816.4507.1002", "clk00000000000000005", 0.46, "USD", "approved", "2026-11-05"],
      ["impact", "19816.4507.1003", "clk00000000000000004", 0.72, "USD", "reversed", "2026-11-06"],
    ],
  );
  // A dashboard download with spaced headers and a day-first date.
  const ui = readExport("Transaction ID,Advertiser Name,Status,Commission Amount,Sale Amount,Currency,Click Ref,Transaction Date\n77,Boots.com,Approved,\"1,20\",60.00,GBP,abc,13/11/2026\n", "ui.csv");
  assert.deepEqual([ui.earnings[0].commission, ui.earnings[0].status, ui.earnings[0].day, ui.earnings[0].clickId], [1.2, "approved", "2026-11-13", "abc"]);
  assert.match(readExport("Date,Amount\n2026-11-01,3\n", "other.csv").problem!, /neither the Awin nor the Impact/);
  const folder = readExportFolder(FIXTURES);
  assert.equal(folder.files, 2);
  assert.equal(folder.earnings.length, 7);
  assert.equal(readExportFolder(join(FIXTURES, "missing")).files, 0);
});

const click = (over: Partial<ClickRow>): ClickRow => ({
  createdAt: new Date("2026-11-05T12:00:00Z"),
  slug: "advil-vs-equate",
  side: "alternative",
  retailer: "walmart",
  program: null,
  country: "US",
  host: "walmart.com",
  referrer: `${SITE}/compare/advil-vs-equate`,
  clickId: null,
  ...over,
});

test("report: clicks by store, programme, country, page and swap; untagged ranked with the programme to join; earnings per click", () => {
  const clicks = [
    click({ clickId: "clk00000000000000004", program: "walmart-us" }),
    click({ clickId: "clk00000000000000005", program: "walmart-us", createdAt: new Date("2026-11-11T09:00:00Z") }),
    click({ clickId: "a3" }),
    click({ retailer: "tesco", host: "tesco.com", country: "GB", slug: "calpol-vs-tesco", referrer: null, clickId: "a4" }),
    click({ retailer: "tesco", host: "tesco.com", country: "GB", slug: "calpol-vs-tesco", referrer: `${SITE}/uk/basket/new-flat-gb`, clickId: "a5" }),
    click({ retailer: "tesco", host: "tesco.com", country: "GB", slug: "calpol-vs-tesco", side: "brand", clickId: "a6" }),
    click({ retailer: "zooplus", host: "zooplus.de", country: "DE", slug: "kit-pets", side: "item-1", referrer: null, clickId: "clk00000000000000001", program: "feed:awin" }),
    click({ retailer: "other", host: "ulta.com", country: null, slug: "kit-pets", side: "item-2", referrer: null, clickId: "a8" }),
  ];
  const exportsRead = readExportFolder(FIXTURES).earnings;
  const postback: Earning = { network: "impact", orderId: "19816.4507.1002", clickId: "clk00000000000000005", advertiser: "walmart-us", commission: 0.4, sale: 10, currency: "USD", status: "pending", day: "2026-11-11", file: "database" };
  const earnings = mergeEarnings([postback], exportsRead);
  assert.equal(earnings.length, 5, "two reversed rows dropped; the export replaces the postback for the same order");
  assert.equal(earnings.find((e) => e.orderId === "19816.4507.1002")!.commission, 0.46);

  const r = buildReport(clicks, earnings, { by: "week", isKit: (s) => s.startsWith("kit-"), title: (s) => (s === "advil-vs-equate" ? "Advil vs Equate" : s) });
  assert.deepEqual(r.periods, ["2026-11-02", "2026-11-09"]);
  assert.equal(r.clicks, 8);
  assert.equal(r.tagged, 3);
  assert.deepEqual(r.earned, { USD: 1.42, EUR: 1.35 });
  assert.deepEqual(r.unmatched, { EUR: 0.6, GBP: 3.2 }, "sales whose click is outside the window or has no click ID");

  const row = (dim: keyof typeof r.tables, key: string) => r.tables[dim].find((x) => x.key === key)!;
  assert.deepEqual([row("store", "walmart").clicks, row("store", "walmart").tagged, row("store", "walmart").byPeriod], [3, 2, { "2026-11-02": 2, "2026-11-09": 1 }]);
  assert.deepEqual(row("store", "walmart").earned, { USD: 1.42 });
  assert.equal(row("store", "ulta").clicks, 1, "an 'other' row is named from its host");
  assert.deepEqual(r.tables.programme.map((x) => [x.key, x.clicks]), [["untagged", 5], ["walmart-us", 2], ["feed:awin", 1]]);
  assert.deepEqual(row("programme", "feed:awin").earned, { EUR: 1.35 });
  assert.deepEqual(r.tables.country.map((x) => x.key).sort(), ["DE", "GB", "US", "unknown"]);
  assert.deepEqual(Object.fromEntries(r.tables.page.map((x) => [x.key, x.clicks])), { swap: 5, kit: 2, basket: 1 });
  assert.equal(row("swap", "Advil vs Equate").clicks, 3);

  assert.deepEqual(
    r.leaks.map((l) => [l.store, l.untagged, Math.round(l.share * 100), Math.round(l.ofStore * 100), l.network]),
    [["tesco", 3, 60, 100, "flexoffers"], ["ulta", 1, 20, 100, "unknown"], ["walmart", 1, 20, 33, "impact"]],
  );
  assert.equal(r.leaks[0].signup, "https://www.flexoffers.com/affiliate-programs/tesco-stores-affiliate-program");

  const text = renderReport(r, { since: "2026-11-01", until: "2026-11-13", top: 10, exportFiles: 2, problems: [] });
  assert.match(text, /^# Revenue report, 2026-11-01 to 2026-11-13/);
  assert.match(text, /8 outbound clicks, 3 tagged \(38%\), 5 untagged/);
  assert.match(text, /\| tesco \| 3 \| 60% \| 100% \| flexoffers \| tesco \| https:\/\/www\.flexoffers\.com/);
  assert.match(text, /\| walmart \| 2 \| 1 \| 3 \| 67% \| 1\.42 USD \| 0\.473 USD \|/);
  assert.match(text, /## By page, per week/);
  assert.ok(!/NaN|undefined/.test(text));
  const none = renderReport(buildReport([], [], { by: "day" }), { since: "a", until: "b", top: 5, exportFiles: 0, problems: ["x.csv: no rows"] });
  assert.match(none, /0 outbound clicks/);
  assert.match(none, /No outbound clicks in this window/);
  assert.match(none, /- x\.csv: no rows/);
});

test("arguments", () => {
  assert.deepEqual({ ...parseArgs([]), exports: "" }, { days: 28, by: "week", top: 15, exports: "", json: false });
  assert.equal(parseArgs(["--days", "7"]).by, "day");
  assert.equal(parseArgs(["--days", "90", "--by", "day"]).by, "day");
  assert.equal(parseArgs(["--exports", "/tmp/x"]).exports, "/tmp/x");
});

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL is not set";
const conn = testDb(url);

before(async () => {
  if (!conn.client) return;
  await conn.open();
  await conn.db.execute(ALL_TABLES);
});
after(async () => {
  if (conn.client) await conn.db.execute(ALL_TABLES);
  await conn.close();
});

test("the CLI reads clicks and postbacks from Postgres and joins the export folder", { skip }, async () => {
  const now = new Date();
  await conn.db.insert(schema.clicks).values([
    { pairSlug: "advil-vs-equate", side: "alternative", retailer: "walmart", clickId: "clk00000000000000005", program: "walmart-us", country: "US", host: "walmart.com", referrer: `${SITE}/compare/advil-vs-equate`, createdAt: now },
    { pairSlug: "calpol-vs-tesco", side: "alternative", retailer: "tesco", clickId: "dbclick2", country: "GB", host: "tesco.com", createdAt: now },
  ]);
  await conn.db.insert(schema.conversions).values({ network: "impact", orderId: "pb-1", clickId: "dbclick2", commission: "0.25", currency: "GBP", status: "pending" });
  const out = execFileSync(process.execPath, ["--import", "tsx", join(ROOT, "scripts", "report-revenue.ts"), "--days", "3", "--exports", FIXTURES], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
  });
  assert.match(out, /2 outbound clicks, 1 tagged \(50%\), 1 untagged/);
  assert.match(out, /Earned from matched clicks: 0\.25 GBP \+ 0\.46 USD/);
  assert.match(out, /Commission exports read: 2 file\(s\)/);
  assert.match(out, /\| tesco \| 1 \| 100% \| 100% \| flexoffers/);
});
