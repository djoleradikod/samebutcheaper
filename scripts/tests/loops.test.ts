/**
 * Reports, "most wanted", price watches, "tell me when you add it" and the weekly letter, against a real Postgres
 * (TEST_DATABASE_URL, a database that may be wiped). Email goes to a stand-in for Resend. Skipped without it.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { and, eq } from "drizzle-orm";
import catalogJson from "../../src/generated/catalog.json";
import * as schema from "../../src/db/schema";
import type { CatalogueView } from "../../src/lib/catalog-data";
import { buildIssue, isoWeek, letterMail, runWeeklyLetter } from "../../src/lib/letter";
import { runMaintenance } from "../../src/lib/maintenance";
import { confirmSubscription, requestWatch, requestWish, subscribeEmail, unsubscribe } from "../../src/lib/newsletter";
import { cleanNote, closeReports, openReportCount, recordReport, reportQueue } from "../../src/lib/reports";
import { mostWanted, normaliseQuery, recordWanted } from "../../src/lib/wanted";
import { pricesOf, runWatches, watchChange } from "../../src/lib/watches";
import type { Bundle, Catalog, Pair } from "../../src/lib/types";
import { ALL_TABLES, mailStub, testDb, type Sent } from "./db-support";

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL is not set";
const SITE = "https://samebutcheaper.test";
const CONTACT = "hello@samebutcheaper.test";

const conn = testDb(url);
const { client, db } = conn;
const { subscribers, watches, wishes, sends, reports } = schema;
const mail = mailStub();
const { sent } = mail.state;
let env: Record<string, string> = {};
/** Letter settings that let it send, on a Thursday. */
let letterEnv: Record<string, string> = {};
const THURSDAY = new Date("2026-11-12T09:00:00Z");

const catalog = catalogJson as unknown as Catalog;
const usPair = catalog.pairs.find((p) => p.market === "US" && p.savingsPct > 30)!;
const dePair = catalog.pairs.find((p) => p.market === "DE" && p.savingsPct > 30)!;
const full: CatalogueView = { pairs: catalog.pairs, bundles: catalog.bundles };
/** The catalogue with one swap's cheaper product re-priced. */
function repriced(pair: Pair, factor: number, extra: Partial<Pair> = {}): CatalogueView {
  const altPpu = pair.alternative.ppu * factor;
  const savingsPct = Math.round((1 - altPpu / pair.brand.ppu) * 1000) / 10;
  const changed: Pair = { ...pair, alternative: { ...pair.alternative, ppu: altPpu, price: pair.alternative.price * factor }, savingsPct, ...extra };
  return { pairs: catalog.pairs.map((p) => (p.slug === pair.slug ? changed : p)), bundles: catalog.bundles };
}
const without = (slug: string): CatalogueView => ({ pairs: catalog.pairs.filter((p) => p.slug !== slug), bundles: catalog.bundles });

before(async () => {
  if (!client) return;
  await conn.open();
  await mail.start();
  env = mail.state.env;
  letterEnv = { ...env, NEWSLETTER_WEEKLY: "on", MAIL_POSTAL_ADDRESS: "SameButCheaper, 1 Test Street, Berlin" };
});
after(async () => {
  mail.stop();
  await conn.close();
});
beforeEach(async () => {
  if (!client) return;
  mail.reset();
  await db.execute(ALL_TABLES);
});

const linkIn = (m: Sent) => /(\/api\/newsletter\/confirm\?token=[A-Za-z0-9_-]+(?:&for=[a-z]+-\d+)?)/.exec(m.text)![1];
function parseLink(link: string) {
  const u = new URL(link, SITE);
  return { token: u.searchParams.get("token")!, scope: (u.searchParams.get("for") ?? undefined) as never };
}
async function follow(m: Sent) {
  const { token, scope } = parseLink(linkIn(m));
  return confirmSubscription(db, token, new Date(), scope);
}
const watchFor = (email: string, pair = usPair, country: string | null = "US") =>
  requestWatch(db, { email, country, slug: pair.slug, title: pair.title, prices: pricesOf(pair) }, { siteUrl: SITE, env });
const opts = (extra: Record<string, unknown> = {}) => ({ siteUrl: SITE, contactEmail: CONTACT, env, pauseMs: 0, ...extra });

// ---- Reports ---------------------------------------------------------------------------------------------------

test("report notes are capped and lose contact details", () => {
  assert.equal(cleanNote("  it is   now\n£4.20 at Tesco  "), "it is now £4.20 at Tesco");
  assert.equal(cleanNote("mail me at ana@example.com or +49 151 2345 6789"), "mail me at [email removed] or [number removed]");
  assert.equal(cleanNote("x".repeat(500))!.length, 300);
  assert.equal(cleanNote("   "), null);
  assert.equal(cleanNote(42), null);
});

test("reports queue by page; three price or stock reports from different visitors in 14 days go first", { skip }, async () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  await recordReport(db, { recordKind: "pair", slug: "quiet", kind: "other", note: "typo", visitorHash: "a", now: ago(0) });
  for (const [h, kind, d] of [["a", "price", 1], ["b", "stock", 2], ["c", "price", 3]] as const) {
    await recordReport(db, { recordKind: "pair", slug: "busy", kind, visitorHash: h, country: "DE", now: ago(d) });
  }
  // The same visitor three times, and old reports, don't make a page urgent.
  for (const d of [1, 2, 3]) await recordReport(db, { recordKind: "bundle", slug: "same-person", kind: "price", visitorHash: "z", now: ago(d) });
  for (const [h, d] of [["x", 20], ["y", 30], ["w", 40]] as const) await recordReport(db, { recordKind: "pair", slug: "old", kind: "price", visitorHash: h, now: ago(d) });

  const queue = await reportQueue(db, now);
  assert.deepEqual(queue.map((g) => [g.slug, g.flagged]), [["busy", true], ["quiet", false], ["same-person", false], ["old", false]]);
  assert.equal(queue[0].urgentRecent, 3);
  assert.equal(queue[0].items[0].country, "DE");
  assert.equal(await openReportCount(db), 10);

  assert.equal(await closeReports(db, { recordKind: "pair", slug: "busy" }, "resolved", now), 3);
  const [one] = queue.find((g) => g.slug === "quiet")!.items;
  assert.equal(await closeReports(db, { ids: [one.id] }, "dismissed", now), 1);
  assert.equal(await closeReports(db, { ids: [one.id] }, "resolved", now), 0, "a closed report stays as it was closed");
  assert.equal(await openReportCount(db), 6);
  assert.deepEqual((await reportQueue(db, now)).map((g) => g.slug), ["same-person", "old"]);
});

// ---- Most wanted -----------------------------------------------------------------------------------------------

test("queries are normalised, capped, and refused when they could be personal", () => {
  assert.equal(normaliseQuery("  “Advil”   Liqui-Gels  "), "advil liqui-gels");
  assert.equal(normaliseQuery("NIVEA\tCrème"), "nivea crème");
  assert.equal(normaliseQuery("me@example.com"), null);
  assert.equal(normaliseQuery("https://amazon.com/x"), null);
  assert.equal(normaliseQuery("call 0151 2345678"), null);
  assert.equal(normaliseQuery("4 0"), null);
  assert.equal(normaliseQuery("x"), null);
  assert.equal(normaliseQuery("vitamin d3 1000"), "vitamin d3 1000");
  const long = normaliseQuery("word ".repeat(40))!;
  assert.ok(long.length <= 80 && !long.endsWith(" "));
});

test("misses are counted per query, country and day, with 7- and 30-day totals and who is waiting", { skip }, async () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  await recordWanted(db, { query: "advil", source: "search", country: "US", now: ago(0) });
  await recordWanted(db, { query: "advil", source: "search", country: "US", now: ago(0) });
  await recordWanted(db, { query: "advil", source: "check", country: "US", now: ago(10) });
  await recordWanted(db, { query: "advil", source: "search", country: "DE", now: ago(2) });
  await recordWanted(db, { query: "nurofen", source: "search", country: "GB", now: ago(40) });
  assert.equal((await db.select().from(schema.wanted)).length, 4, "the same query, source, country and day is one row");

  await requestWish(db, { email: "w1@example.com", query: "advil", country: "US" }, { siteUrl: SITE, env });
  await follow(sent[0]);
  await requestWish(db, { email: "w2@example.com", query: "advil", country: "US" }, { siteUrl: SITE, env });

  const byCountry = await mostWanted(db, { now });
  assert.deepEqual(
    byCountry.map((r) => [r.query, r.country, r.last7, r.last30, r.sources, r.waiting, r.waitingPending]),
    [
      ["advil", "US", 2, 3, "check, search", 1, 1],
      ["advil", "DE", 1, 1, "search", 1, 1],
    ],
  );
  const overall = await mostWanted(db, { now, byCountry: false });
  assert.deepEqual(overall.map((r) => [r.query, r.last7, r.last30]), [["advil", 3, 4]]);
});

// ---- Double opt-in for watches and wishes ----------------------------------------------------------------------

test("a watch from a new address waits for its own link, and doesn't sign them up for the letter", { skip }, async () => {
  assert.equal(await watchFor("ana@example.com"), "sent");
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, new RegExp(`/api/newsletter/confirm\\?token=[A-Za-z0-9_-]+&for=watch-1`));
  assert.ok(sent[0].text.includes(usPair.title));
  assert.equal(sent[0].headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  const [w] = await db.select().from(watches);
  assert.equal(w.status, "pending");
  assert.equal(Number(w.altPpu).toPrecision(6), usPair.alternative.ppu.toPrecision(6));

  // Unconfirmed: a price change sends nothing.
  assert.equal((await runWatches(db, opts({ catalogue: repriced(usPair, 1.2) }))).sent, 0);
  assert.equal(sent.length, 1);

  assert.equal(await follow(sent[0]), "done");
  assert.equal(await follow(sent[0]), "already");
  const [sub] = await db.select().from(subscribers);
  assert.deepEqual([sub.status, sub.newsletter], ["confirmed", "no"]);
  assert.equal((await db.select().from(watches))[0].status, "active");
  // Confirmed for a watch only: the weekly letter skips them.
  const run = await runWeeklyLetter(db, { ...opts(), env: letterEnv, now: THURSDAY });
  assert.deepEqual(run, { status: "ran", issue: isoWeek(THURSDAY), sent: 0, empty: 0, failed: 0 });
});

test("someone else typing a confirmed address can't start anything without that address's click", { skip }, async () => {
  await subscribeEmail(db, { email: "bo@example.com", country: "GB" }, { siteUrl: SITE, env });
  await follow(sent[0]);
  assert.equal(await watchFor("bo@example.com", usPair, "US"), "sent");
  assert.equal(sent.length, 2);
  const [w] = await db.select().from(watches);
  assert.equal(w.status, "pending", "a confirmed address still confirms each new thing");
  // The letter's link doesn't switch on the watch.
  const letterLink = parseLink(linkIn(sent[0]));
  assert.equal(await confirmSubscription(db, letterLink.token), "already");
  assert.equal((await db.select().from(watches))[0].status, "pending");
  // A link for a watch that belongs to another address does nothing.
  await watchFor("cy@example.com");
  const cyWatch = (await db.select().from(watches).where(eq(watches.slug, usPair.slug))).find((x) => x.id !== w.id)!;
  assert.equal(await confirmSubscription(db, letterLink.token, new Date(), `watch-${cyWatch.id}`), "invalid");
  assert.equal((await db.select().from(watches).where(eq(watches.id, cyWatch.id)))[0].status, "pending");
  // Its own link does.
  assert.equal(await follow(sent[1]), "done");
  assert.equal((await db.select().from(watches).where(eq(watches.id, w.id)))[0].status, "active");
  // The country stays the one they first gave.
  assert.equal((await db.select().from(subscribers).where(eq(subscribers.email, "bo@example.com")))[0].country, "GB");
});

test("confirmation emails are limited: one per thing per ten minutes, five per address per day", { skip }, async () => {
  assert.equal(await watchFor("dee@example.com"), "sent");
  assert.equal(await watchFor("dee@example.com"), "unchanged", "the same watch again within ten minutes");
  const others = catalog.pairs.filter((p) => p.slug !== usPair.slug).slice(0, 6);
  const outcomes = [];
  for (const p of others) outcomes.push(await watchFor("dee@example.com", p));
  assert.deepEqual(outcomes, ["sent", "sent", "sent", "sent", "stored", "stored"]);
  assert.equal(sent.length, 5);
});

test("a wish confirms on its own and counts as waiting", { skip }, async () => {
  assert.equal(await requestWish(db, { email: "em@example.com", query: "nurofen express", country: "GB" }, { siteUrl: SITE, env }), "sent");
  assert.ok(sent[0].text.includes("nurofen express"));
  assert.match(linkIn(sent[0]), /&for=wish-1$/);
  assert.equal((await db.select().from(wishes))[0].status, "pending");
  assert.equal(await follow(sent[0]), "done");
  const [w] = await db.select().from(wishes);
  assert.equal(w.status, "active");
  assert.ok(w.confirmedAt);
  const [sub] = await db.select().from(subscribers);
  assert.deepEqual([sub.status, sub.newsletter], ["confirmed", "no"]);
});

// ---- Price watches ---------------------------------------------------------------------------------------------

async function activeWatch(email = "fi@example.com", pair = usPair, country: string | null = "US") {
  mail.reset();
  await watchFor(email, pair, country);
  await follow(sent.at(-1)!);
  mail.reset();
}

test("watch rules: 5% moves either way, the saving dropping under 5%, and withdrawal", () => {
  const p = pricesOf(usPair);
  assert.equal(watchChange(p, { ...p, altPpu: p.altPpu * 1.04 }), null);
  assert.ok(watchChange(p, { ...p, altPpu: p.altPpu * 1.05 }));
  assert.ok(watchChange(p, { ...p, altPpu: p.altPpu * 0.95 }));
  assert.ok(watchChange({ ...p, savingsPct: 6 }, { ...p, savingsPct: 4.9 }));
  assert.equal(watchChange({ ...p, savingsPct: 4 }, { ...p, savingsPct: 3 }), null, "already under 5% when they started");
  assert.deepEqual(watchChange(p, null), { withdrawn: true });
  assert.ok(watchChange(p, { ...p, unit: "kg" }), "a change of unit is a change");
});

test("a price move sends one email, once, even when two runs overlap", { skip }, async () => {
  await activeWatch();
  const moved = repriced(usPair, 1.1);
  assert.equal((await runWatches(db, opts({ catalogue: full }))).changed, 0, "nothing changed yet");
  const [a, b] = await Promise.all([runWatches(db, opts({ catalogue: moved })), runWatches(db, opts({ catalogue: moved }))]);
  assert.equal(a.sent + b.sent, 1);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.match(m.subject, /Price change/);
  assert.match(m.text, /gone up 10%/);
  assert.equal(m.headers?.["List-Unsubscribe"], `<${SITE}/api/newsletter/unsubscribe?token=${(await db.select().from(subscribers))[0].token}&only=watch-1>`);
  assert.equal(m.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.ok(m.text.includes("Stop watching this swap:") && m.text.includes("Unsubscribe from everything:"));
  assert.ok(m.html.includes("utm_source=newsletter"));
  assert.ok(!/<img/i.test(m.html), "no images, so no tracking pixels");
  // The new prices are now the baseline: a third run sends nothing.
  assert.equal((await runWatches(db, opts({ catalogue: moved }))).sent, 0);
  assert.equal((await db.select().from(sends).where(eq(sends.kind, "watch"))).length, 1);
  // Back down again by 10% from there is a new change.
  assert.equal((await runWatches(db, opts({ catalogue: full }))).sent, 1);
});

test("the saving dropping under 5% and a withdrawal each get their email; a withdrawn swap ends the watch", { skip }, async () => {
  await activeWatch();
  const brandish = repriced(usPair, (usPair.brand.ppu * 0.97) / usPair.alternative.ppu);
  assert.equal((await runWatches(db, opts({ catalogue: brandish }))).sent, 1);
  assert.match(sent[0].subject, /under 5%/);
  assert.equal((await runWatches(db, opts({ catalogue: without(usPair.slug) }))).sent, 1);
  assert.match(sent[1].subject, /withdrawn/);
  assert.equal((await db.select().from(watches))[0].status, "ended");
  assert.equal((await runWatches(db, opts({ catalogue: without(usPair.slug) }))).sent, 0);
});

test("watch emails use the reader's currency", { skip }, async () => {
  await activeWatch("gb@example.com", usPair, "DE");
  await runWatches(db, opts({ catalogue: repriced(usPair, 0.8) }));
  assert.match(sent[0].text, /about €/);
});

test("a failed send is retried on the next run; without email set up a change is only logged", { skip }, async () => {
  await activeWatch();
  const moved = repriced(usPair, 1.2);
  assert.equal((await runWatches(db, opts({ catalogue: moved, env: {} }))).notSent, 1);
  assert.equal((await db.select().from(sends).where(eq(sends.kind, "watch"))).length, 0);
  mail.state.failNext = 1;
  assert.equal((await runWatches(db, opts({ catalogue: moved }))).sent, 0);
  assert.equal((await db.select().from(sends).where(eq(sends.kind, "watch"))).length, 0, "the claim is released");
  assert.equal((await runWatches(db, opts({ catalogue: moved }))).sent, 1);
});

test("runs are capped", { skip }, async () => {
  for (const e of ["c1@example.com", "c2@example.com", "c3@example.com"]) await activeWatch(e);
  const moved = repriced(usPair, 1.2);
  assert.equal((await runWatches(db, opts({ catalogue: moved, limit: 2 }))).sent, 2);
  assert.equal((await runWatches(db, opts({ catalogue: moved, limit: 2 }))).sent, 1);
});

test("unsubscribe: one watch, the letter, or everything; links only work for their own address", { skip }, async () => {
  await activeWatch("hu@example.com", usPair);
  await watchFor("hu@example.com", dePair);
  await follow(sent.at(-1)!);
  await subscribeEmail(db, { email: "hu@example.com" }, { siteUrl: SITE, env });
  await follow(sent.at(-1)!);
  const [sub] = await db.select().from(subscribers);
  assert.equal(sub.newsletter, "yes");
  const [w1, w2] = await db.select().from(watches).orderBy(watches.id);

  assert.equal(await unsubscribe(db, sub.token!, new Date(), `watch-${w1.id}`), "done");
  assert.equal(await unsubscribe(db, sub.token!, new Date(), `watch-${w1.id}`), "already");
  assert.equal(await unsubscribe(db, "y".repeat(32), new Date(), `watch-${w2.id}`), "invalid");
  assert.deepEqual((await db.select().from(watches).orderBy(watches.id)).map((w) => w.status), ["stopped", "active"]);
  mail.reset();
  await runWatches(db, opts({ catalogue: repriced(usPair, 1.5) }));
  assert.equal(sent.length, 0, "a stopped watch sends nothing");

  assert.equal(await unsubscribe(db, sub.token!, new Date(), "letter"), "done");
  const after = (await db.select().from(subscribers))[0];
  assert.deepEqual([after.status, after.newsletter], ["confirmed", "no"], "the address and its other watch carry on");

  assert.equal(await unsubscribe(db, sub.token!), "done");
  assert.equal((await db.select().from(subscribers))[0].status, "unsubscribed");
  assert.deepEqual((await db.select().from(watches).orderBy(watches.id)).map((w) => w.status), ["stopped", "stopped"]);
  await runWatches(db, opts({ catalogue: repriced(dePair, 1.5) }));
  assert.equal(sent.length, 0);
  // An old confirm link can't bring anything back.
  assert.equal(await confirmSubscription(db, sub.token!, new Date(), `watch-${w2.id}`), "invalid");
});

// ---- The weekly letter -----------------------------------------------------------------------------------------

async function reader(email: string, country: string | null) {
  mail.reset();
  await subscribeEmail(db, { email, country }, { siteUrl: SITE, env });
  await follow(sent.at(-1)!);
  mail.reset();
}

test("the letter waits for its switch, a postal address, email and its weekday", { skip }, async () => {
  await reader("li@example.com", "US");
  const run = (e: Record<string, string>, now = THURSDAY) => runWeeklyLetter(db, { ...opts(), env: e, now });
  assert.deepEqual(await run(env), { status: "off" });
  assert.deepEqual(await run({ ...env, NEWSLETTER_WEEKLY: "on" }), { status: "no-postal-address" });
  assert.deepEqual(await run(letterEnv, new Date("2026-11-10T09:00:00Z")), { status: "not-today" });
  const noMail = { ...letterEnv, RESEND_API_KEY: "" };
  assert.deepEqual(await run(noMail), { status: "no-mail", waiting: 1 });
  assert.equal((await db.select().from(sends).where(eq(sends.kind, "weekly"))).length, 0);
  assert.equal(sent.length, 0);
});

test("the letter goes once a week to confirmed readers only, in their currency, never repeating a swap", { skip }, async () => {
  await reader("de@example.com", "DE");
  await reader("us@example.com", "US");
  await subscribeEmail(db, { email: "pending@example.com" }, { siteUrl: SITE, env });
  await reader("gone@example.com", "US");
  const gone = (await db.select().from(subscribers).where(eq(subscribers.email, "gone@example.com")))[0];
  await unsubscribe(db, gone.token!);
  mail.reset();

  const first = await runWeeklyLetter(db, { ...opts(), env: letterEnv, now: THURSDAY });
  assert.deepEqual(first, { status: "ran", issue: "2026-W46", sent: 2, empty: 0, failed: 0 });
  assert.deepEqual(sent.map((m) => m.to[0]).sort(), ["de@example.com", "us@example.com"]);
  const de = sent.find((m) => m.to[0] === "de@example.com")!;
  const us = sent.find((m) => m.to[0] === "us@example.com")!;
  assert.ok(de.text.includes("€") && !de.text.includes("$"), "a German reader sees euros");
  assert.ok(us.text.includes("$"));
  const deToken = (await db.select().from(subscribers).where(eq(subscribers.email, "de@example.com")))[0].token;
  assert.equal(de.headers?.["List-Unsubscribe"], `<${SITE}/api/newsletter/unsubscribe?token=${deToken}&only=letter>`);
  assert.ok(de.text.includes("Unsubscribe from the weekly letter:") && de.text.includes("Unsubscribe from everything:"));
  assert.ok(de.text.includes("1 Test Street"), "the postal address is in every letter");
  for (const m of sent) {
    assert.ok(!/<img/i.test(m.html));
    for (const href of m.html.match(/href="https:\/\/samebutcheaper\.test\/(compare|bundle)[^"]+"/g) ?? []) assert.match(href, /utm_source=newsletter/);
  }

  mail.reset();
  const again = await runWeeklyLetter(db, { ...opts(), env: letterEnv, now: new Date(THURSDAY.getTime() + 86400000) });
  assert.equal(again.status === "ran" && again.sent, 0, "a second run in the same week sends nothing");
  assert.equal(sent.length, 0);

  const nextWeek = new Date(THURSDAY.getTime() + 7 * 86400000);
  await runWeeklyLetter(db, { ...opts(), env: letterEnv, now: nextWeek });
  const issues = await db.select().from(sends).where(and(eq(sends.kind, "weekly"), eq(sends.subscriberId, (await db.select().from(subscribers).where(eq(subscribers.email, "de@example.com")))[0].id)));
  assert.equal(issues.length, 2);
  const [w1, w2] = issues.map((i) => new Set(i.items as string[]));
  assert.ok(w2.size > 0);
  for (const k of w2) assert.ok(!w1.has(k), `${k} was already in last week's letter`);
});

test("letters are capped per run, and a failed send is tried again", { skip }, async () => {
  for (const e of ["l1@example.com", "l2@example.com", "l3@example.com"]) await reader(e, "GB");
  mail.state.failNext = 1;
  const capped = { ...letterEnv, NEWSLETTER_MAX_PER_RUN: "2" };
  assert.deepEqual(await runWeeklyLetter(db, { ...opts(), env: capped, now: THURSDAY }), { status: "ran", issue: "2026-W46", sent: 1, empty: 0, failed: 1 });
  assert.deepEqual(await runWeeklyLetter(db, { ...opts(), env: capped, now: THURSDAY }), { status: "ran", issue: "2026-W46", sent: 2, empty: 0, failed: 0 });
  assert.equal(sent.length, 3);
  assert.equal(new Set(sent.map((m) => m.to[0])).size, 3);
});

test("new records lead the letter; the first sighting of the catalogue counts as old", { skip }, async () => {
  const seen = Object.fromEntries([...catalog.pairs.map((p) => [`p:${p.slug}`, "1970-01-01"]), ...catalog.bundles.map((b) => [`b:${b.slug}`, "1970-01-01"])]);
  const fresh = catalog.pairs.find((p) => p.market === "GB")!;
  seen[`p:${fresh.slug}`] = "2026-11-11";
  const issue = buildIssue({ catalogue: full, country: "GB", sent: new Set(), seen, now: THURSDAY })!;
  assert.equal(issue.fresh[0].kind === "pair" && issue.fresh[0].pair.slug, fresh.slug);
  const m = letterMail(issue, { to: "x@example.com", token: "t".repeat(32), issueKey: "2026-W46" }, { siteUrl: SITE, contactEmail: CONTACT });
  assert.ok(m.text.indexOf("NEW ON THE SITE") < m.text.indexOf("BIG SAVINGS"));
  const everything = new Set([...catalog.pairs.map((p) => `p:${p.slug}`), ...catalog.bundles.map((b: Bundle) => `b:${b.slug}`)]);
  assert.equal(buildIssue({ catalogue: full, country: "GB", sent: everything, seen, now: THURSDAY }), null, "nothing left: no letter");
});

// ---- Upkeep ----------------------------------------------------------------------------------------------------

test("upkeep deletes old reports, counts, stopped watches and unconfirmed requests, and keeps the rest", { skip }, async () => {
  const now = new Date("2026-11-13T12:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  await recordReport(db, { recordKind: "pair", slug: "a", kind: "price", visitorHash: "h", now: ago(200) });
  await recordReport(db, { recordKind: "pair", slug: "b", kind: "price", visitorHash: "h", now: ago(40) });
  await recordReport(db, { recordKind: "pair", slug: "c", kind: "price", visitorHash: "h", now: ago(1) });
  await recordWanted(db, { query: "old", source: "search", now: ago(401) });
  await recordWanted(db, { query: "new", source: "search", now: ago(3) });

  // A watch-only address that never confirmed, mailed 31 days ago: it goes, with its watch.
  await watchFor("never@example.com");
  await db.update(watches).set({ confirmSentAt: ago(31) });
  // A confirmed address with a stopped watch (40 days) and a fresh pending one.
  await activeWatch("keep@example.com", dePair, "DE");
  const keep = (await db.select().from(subscribers).where(eq(subscribers.email, "keep@example.com")))[0];
  await unsubscribe(db, keep.token!, now, `watch-${(await db.select().from(watches).where(eq(watches.subscriberId, keep.id)))[0].id}`);
  await db.update(watches).set({ stoppedAt: ago(40) }).where(eq(watches.subscriberId, keep.id));
  await requestWatch(db, { email: "keep@example.com", slug: usPair.slug, title: usPair.title, prices: pricesOf(usPair) }, { siteUrl: SITE, env, now });

  const report = await runMaintenance(db, { siteUrl: SITE, env, now, pauseMs: 0 });
  assert.ok(report);
  assert.equal(report.reportsDeleted, 1);
  assert.equal(report.wantedDeleted, 1);
  assert.equal(report.watchesDeleted, 1, "the stopped watch");
  assert.equal(report.pendingSubscribersDeleted, 1);
  assert.deepEqual((await db.select().from(subscribers)).map((s) => s.email), ["keep@example.com"]);
  assert.deepEqual((await db.select().from(watches)).map((w) => [w.slug, w.status]), [[usPair.slug, "pending"]]);
  const left = await db.select().from(reports).orderBy(reports.slug);
  assert.deepEqual(left.map((r) => [r.slug, r.visitorHash]), [["b", null], ["c", "h"]], "the hash goes after 30 days");
  assert.deepEqual((await db.select().from(schema.wanted)).map((w) => w.query), ["new"]);

  const shorter = await runMaintenance(db, { siteUrl: SITE, env: { RETENTION_REPORT_DAYS: "7", RETENTION_WANTED_DAYS: "1" }, now, pauseMs: 0 });
  assert.equal(shorter?.reportsDeleted, 1);
  assert.equal(shorter?.wantedDeleted, 1);
});
