/**
 * The newsletter and upkeep against a real Postgres. Needs TEST_DATABASE_URL pointing at a database that may be
 * wiped (never the live one): the tests apply the migrations and empty the tables. Skipped without it.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { lastMaintenance, runMaintenance } from "../../src/lib/maintenance";
import { confirmByToken, hashSecret, sendPendingConfirmations, subscribeEmail, subscriberCounts, unsubscribe } from "../../src/lib/newsletter";
import { ALL_TABLES, mailStub, testDb, type Sent } from "./db-support";

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : "TEST_DATABASE_URL is not set";
const SITE = "https://samebutcheaper.test";

const conn = testDb(url);
const { client, db } = conn;
const { subscribers, clicks, conversions, lookups } = schema;

const mail = mailStub();
const { sent } = mail.state;
let env: Record<string, string> = {};

before(async () => {
  if (!client) return;
  await conn.open();
  await mail.start();
  env = mail.state.env;
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

const row = async (email: string) => (await db.select().from(subscribers).where(eq(subscribers.email, email)))[0];
const tokenIn = (mail: Sent) => /\/newsletter\/confirm\?t=([A-Za-z0-9_-]+)/.exec(mail.text)![1];
const confirm = async (secret: string) => (await confirmByToken(db, secret)).outcome;

test("sign-up sends one confirmation, and only the link confirms", { skip }, async () => {
  assert.equal(await subscribeEmail(db, { email: " Ana@Example.com ", source: "home", country: "DE" }, { siteUrl: SITE, env }), "sent");
  const r = await row("ana@example.com");
  assert.equal(r.status, "pending");
  assert.equal(r.country, "DE");
  assert.ok(r.confirmSentAt);
  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.deepEqual(mail.to, ["ana@example.com"]);
  assert.equal(mail.from, env.MAIL_FROM);
  const secret = tokenIn(mail);
  assert.ok(mail.html.includes(`${SITE}/newsletter/confirm?t=${secret}`));
  assert.notEqual(secret, r.token, "the confirm secret is not the long-lived unsubscribe token");
  assert.ok(!mail.text.includes(r.token!), "the body links only to the confirm page");
  assert.equal(r.confirmHash, hashSecret(secret), "only a hash of the secret is stored");
  assert.ok(!JSON.stringify(r).includes(secret));
  assert.ok(!mail.idempotencyKey?.includes(secret) && !mail.idempotencyKey?.includes(r.token!), "no secret goes to the mail provider in a header");
  assert.equal(mail.headers?.["List-Unsubscribe"], `<${SITE}/api/newsletter/unsubscribe?token=${r.token}>`);
  assert.equal(mail.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

  assert.equal(await confirm("not-the-token-not-the-token"), "invalid");
  assert.equal(await confirm(r.token!), "invalid", "the unsubscribe token can't confirm");
  assert.equal((await row("ana@example.com")).status, "pending");
  assert.equal(await confirm(secret), "done");
  const confirmed = await row("ana@example.com");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.newsletter, "yes");
  assert.ok(confirmed.confirmedAt);
  assert.equal(confirmed.confirmHash, null);
  assert.equal(await confirm(secret), "invalid", "a link works once: replaying it does nothing");
});

test("signing up again doesn't send a second email within ten minutes, or once confirmed", { skip }, async () => {
  const t0 = new Date("2026-11-10T10:00:00Z");
  assert.equal(await subscribeEmail(db, { email: "b@example.com" }, { siteUrl: SITE, env, now: t0 }), "sent");
  assert.equal(await subscribeEmail(db, { email: "b@example.com" }, { siteUrl: SITE, env, now: new Date(t0.getTime() + 60_000) }), "unchanged");
  assert.equal(sent.length, 1);
  assert.equal(await subscribeEmail(db, { email: "b@example.com" }, { siteUrl: SITE, env, now: new Date(t0.getTime() + 11 * 60_000) }), "sent");
  assert.equal(sent.length, 2);
  assert.notEqual(tokenIn(sent[0]), tokenIn(sent[1]), "each email has its own secret");
  assert.equal(await confirm(tokenIn(sent[0])), "invalid", "a newer email replaces the older link");
  assert.equal(await confirm(tokenIn(sent[1])), "done");
  assert.equal(await subscribeEmail(db, { email: "b@example.com" }, { siteUrl: SITE, env, now: new Date(t0.getTime() + 3600_000) }), "unchanged");
  assert.equal(sent.length, 2);
  assert.equal((await db.select().from(subscribers)).length, 1);
});

test("a sign-up on a German page is kept in German, with the same opt-in and headers; English is the default", { skip }, async () => {
  assert.equal(await subscribeEmail(db, { email: "de@example.com", country: "DE", lang: "de" }, { siteUrl: SITE, env }), "sent");
  assert.equal(await subscribeEmail(db, { email: "en@example.com", country: "DE" }, { siteUrl: SITE, env }), "sent");
  assert.equal(await subscribeEmail(db, { email: "xx@example.com", lang: "fr" }, { siteUrl: SITE, env }), "sent");
  const de = await row("de@example.com");
  assert.equal(de.lang, "de");
  assert.equal((await row("en@example.com")).lang, "en");
  assert.equal((await row("xx@example.com")).lang, "en", "a language we don't write in reads as English");
  const [german, english] = sent;
  assert.equal(german.subject, "Bestätige deine E-Mail-Adresse für SameButCheaper");
  assert.ok(german.text.includes("Bitte bestätige deine E-Mail-Adresse") && german.html.includes('lang="de"'));
  assert.equal(english.subject, "Confirm your email for SameButCheaper");
  assert.ok(!english.html.includes("lang="), "the English email is as it was");
  // Double opt-in and the unsubscribe headers are the same in German.
  assert.equal(de.status, "pending");
  assert.equal(german.headers?.["List-Unsubscribe"], `<${SITE}/api/newsletter/unsubscribe?token=${de.token}>`);
  assert.equal(german.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.equal(await confirm(tokenIn(german)), "done");
  assert.equal((await row("de@example.com")).status, "confirmed");

  // Someone typing the address on an English page can't change the language its owner reads in.
  await subscribeEmail(db, { email: "de@example.com", lang: "en" }, { siteUrl: SITE, env });
  assert.equal((await row("de@example.com")).lang, "de");
  // Starting over after unsubscribing takes the language of the page they start over on.
  await unsubscribe(db, de.token!);
  await subscribeEmail(db, { email: "de@example.com", lang: "en" }, { siteUrl: SITE, env });
  assert.equal((await row("de@example.com")).lang, "en");
});

test("unsubscribe works from pending or confirmed, and re-joining starts over", { skip }, async () => {
  await subscribeEmail(db, { email: "c@example.com" }, { siteUrl: SITE, env });
  const secret = tokenIn(sent[0]);
  const token = (await row("c@example.com")).token!;
  assert.equal(await unsubscribe(db, "x".repeat(30)), "invalid");
  assert.equal(await unsubscribe(db, token), "done");
  const gone = await row("c@example.com");
  assert.equal(gone.status, "unsubscribed");
  assert.ok(gone.unsubscribedAt);
  assert.equal(await unsubscribe(db, token), "already");
  assert.equal(await confirm(secret), "invalid", "an unused confirm link can't re-subscribe someone who left");

  assert.equal(await subscribeEmail(db, { email: "c@example.com" }, { siteUrl: SITE, env }), "sent");
  const back = await row("c@example.com");
  assert.equal(back.status, "pending");
  assert.equal(back.confirmedAt, null);
  assert.deepEqual(await subscriberCounts(db), { confirmed: 0, pending: 1, unsubscribed: 0, letter: 0 });
});

test("without email set up, sign-ups are stored and get their confirmation later", { skip }, async () => {
  assert.equal(await subscribeEmail(db, { email: "d@example.com" }, { siteUrl: SITE, env: {} }), "stored");
  assert.equal(await subscribeEmail(db, { email: "e@example.com" }, { siteUrl: SITE, env: {} }), "stored");
  assert.equal(sent.length, 0);
  assert.equal((await row("d@example.com")).confirmSentAt, null);
  assert.equal(await sendPendingConfirmations(db, { siteUrl: SITE, env }), 2);
  assert.equal(sent.length, 2);
  assert.equal(await sendPendingConfirmations(db, { siteUrl: SITE, env }), 0, "nobody is emailed twice");
});

test("a failed send leaves the sign-up waiting, not marked as sent", { skip }, async () => {
  mail.state.failNext = 1;
  assert.equal(await subscribeEmail(db, { email: "f@example.com" }, { siteUrl: SITE, env }), "stored");
  assert.equal((await row("f@example.com")).confirmSentAt, null);
  assert.equal(await sendPendingConfirmations(db, { siteUrl: SITE, env }), 1);
});

test("upkeep removes what the privacy page says it removes, and nothing else", { skip }, async () => {
  const now = new Date("2026-11-10T12:00:00Z");
  const ago = (d: number) => new Date(now.getTime() - d * 24 * 3600_000);
  await db.insert(subscribers).values([
    { email: "old-pending@example.com", status: "pending", token: "t".repeat(32), confirmSentAt: ago(31), createdAt: ago(31) },
    { email: "new-pending@example.com", status: "pending", token: "u".repeat(32), confirmSentAt: ago(5), createdAt: ago(5) },
    { email: "never-mailed@example.com", status: "pending", token: "v".repeat(32), confirmSentAt: null, createdAt: ago(90) },
    { email: "confirmed@example.com", status: "confirmed", newsletter: "yes", token: "w".repeat(32), confirmSentAt: ago(400), confirmedAt: ago(399), createdAt: ago(400) },
    // Letter switched off 31 days ago and nothing else on: deleted. Off 5 days ago: kept for now.
    { email: "idle@example.com", status: "confirmed", newsletter: "no", token: "y".repeat(32), confirmSentAt: ago(100), confirmedAt: ago(99), letterStoppedAt: ago(31), createdAt: ago(100) },
    { email: "idle-recent@example.com", status: "confirmed", newsletter: "no", token: "z".repeat(32), confirmSentAt: ago(100), confirmedAt: ago(99), letterStoppedAt: ago(5), createdAt: ago(100) },
    { email: "left@example.com", status: "unsubscribed", token: "x".repeat(32), confirmSentAt: ago(400), unsubscribedAt: ago(100), createdAt: ago(400) },
  ]);
  await db.insert(clicks).values([
    { pairSlug: "a", side: "alternative", retailer: "r", referrer: "https://x/", visitorHash: "h1", clickId: "oldclick01", createdAt: ago(200) },
    { pairSlug: "a", side: "alternative", retailer: "r", referrer: "https://x/", visitorHash: "h2", clickId: "newclick01", createdAt: ago(20) },
  ]);
  await db.insert(conversions).values([
    { network: "awin", orderId: "1", commission: "1.00", raw: { a: "1" }, createdAt: ago(200), updatedAt: ago(200) },
    { network: "awin", orderId: "2", commission: "1.00", raw: { a: "1" }, createdAt: ago(20), updatedAt: ago(20) },
  ]);
  await db.insert(lookups).values([
    { kind: "text", query: "old", createdAt: ago(366) },
    { kind: "text", query: "recent", createdAt: ago(300) },
  ]);

  const report = await runMaintenance(db, { siteUrl: SITE, env, now, pauseMs: 0 });
  assert.ok(report);
  assert.deepEqual(
    { ...report, ranAt: undefined },
    {
      ranAt: undefined,
      pendingSubscribersDeleted: 1,
      idleSubscribersDeleted: 1,
      clicksStripped: 1,
      conversionsStripped: 1,
      lookupsDeleted: 1,
      reportsDeleted: 0,
      wantedDeleted: 0,
      watchesDeleted: 0,
      wishesDeleted: 0,
      sendsDeleted: 0,
      confirmationsSent: 1,
      watchMailsSent: 0,
      watchChangesUnsent: 0,
      wishMailsSent: 0,
      wishMatchesUnsent: 0,
      letter: "off",
    },
  );

  const emails = (await db.select().from(subscribers)).map((s) => s.email).sort();
  assert.deepEqual(emails, ["confirmed@example.com", "idle-recent@example.com", "left@example.com", "never-mailed@example.com", "new-pending@example.com"]);
  assert.deepEqual(sent.map((m) => m.to[0]), ["never-mailed@example.com"]);

  const kept = await db.select().from(clicks).orderBy(clicks.id);
  assert.equal(kept.length, 2, "clicks themselves stay, sales are matched to them");
  assert.deepEqual([kept[0].referrer, kept[0].visitorHash, kept[0].clickId], [null, null, "oldclick01"]);
  assert.deepEqual([kept[1].referrer, kept[1].visitorHash], ["https://x/", "h2"]);
  const sales = await db.select().from(conversions).orderBy(conversions.id);
  assert.deepEqual(sales.map((s) => s.raw), [null, { a: "1" }]);
  assert.deepEqual((await db.select().from(lookups)).map((l) => l.query), ["recent"]);

  assert.equal((await lastMaintenance(db))?.ranAt, now.toISOString());
  const again = await runMaintenance(db, { siteUrl: SITE, env, now: new Date(now.getTime() + 3600_000), minHoursSinceLast: 20, pauseMs: 0 });
  assert.equal(again?.ranAt, now.toISOString(), "a run within 20 hours of the last one is skipped");
});

test("retention periods can be changed", { skip }, async () => {
  const now = new Date("2026-11-10T12:00:00Z");
  await db.insert(lookups).values([{ kind: "text", query: "ten days old", createdAt: new Date(now.getTime() - 10 * 24 * 3600_000) }]);
  const report = await runMaintenance(db, { siteUrl: SITE, env: { RETENTION_LOOKUP_DAYS: "7" }, now, pauseMs: 0 });
  assert.equal(report?.lookupsDeleted, 1);
});
