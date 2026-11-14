import assert from "node:assert/strict";
import { test } from "node:test";
import { legalMissing, legalNotice } from "../../src/lib/legal";
import { readinessChecks, summarize, type Facts } from "../../src/lib/readiness";

const GOOD_FACTS: Facts = { siteUrl: "https://samebutcheaper.com", database: "ok", migrationsApplied: 4, migrationsExpected: 4 };
const GOOD_ENV = {
  ADMIN_PASSWORD: "kT9v2LmQx7RbN4yZ",
  CLICK_HASH_SALT: "5f1c9a7e3b2d4f6a8c0e1b3d5f7a9c1e",
  POSTBACK_SECRET: "0a1b2c3d4e5f60718293a4b5c6d7e8f9",
  AWIN_PUBLISHER_ID: "123456",
  AFF_SHOPAPOTHEKE: "1",
  RESEND_API_KEY: "re_test",
  MAIL_FROM: "SameButCheaper <hello@samebutcheaper.com>",
  NEWSLETTER_WEEKLY: "on",
  MAIL_POSTAL_ADDRESS: "SameButCheaper, 1 Example Street, Berlin",
  LEGAL_NAME: "Example Owner",
  LEGAL_ADDRESS: "1 Example Street | 10115 Berlin",
  LEGAL_EMAIL: "legal@samebutcheaper.com",
};
const failing = (env: Record<string, string>, facts = GOOD_FACTS) => readinessChecks(env, facts).filter((c) => !c.ok).map((c) => c.id);

test("a fully configured install is ready, with only optional things open", () => {
  const s = summarize(readinessChecks(GOOD_ENV, GOOD_FACTS));
  assert.equal(s.ready, true);
  assert.deepEqual(s.blockers, []);
  assert.deepEqual(s.recommended, []);
});

test("the .env.example placeholders block a launch", () => {
  const ids = failing({ ADMIN_PASSWORD: "", CLICK_HASH_SALT: "change-me" }, { ...GOOD_FACTS, siteUrl: "http://localhost:3000" });
  for (const id of ["site-url", "admin-password", "click-salt"]) assert.ok(ids.includes(id), id);
  assert.equal(summarize(readinessChecks({ CLICK_HASH_SALT: "change-me" }, GOOD_FACTS)).ready, false);
});

test("weak secrets are caught", () => {
  assert.ok(failing({ ...GOOD_ENV, ADMIN_PASSWORD: "short" }).includes("admin-password"));
  assert.ok(failing({ ...GOOD_ENV, ADMIN_PASSWORD: "change-me-to-a-long-random-string" }).includes("admin-password"));
  assert.ok(failing({ ...GOOD_ENV, POSTBACK_SECRET: "abc" }).includes("postback-secret"));
});

test("database: down, missing or behind on migrations blocks", () => {
  assert.ok(failing(GOOD_ENV, { ...GOOD_FACTS, database: "down", migrationsApplied: null }).includes("database"));
  assert.ok(failing(GOOD_ENV, { ...GOOD_FACTS, database: "not-configured", migrationsApplied: null }).includes("database"));
  assert.ok(failing(GOOD_ENV, { ...GOOD_FACTS, migrationsApplied: 3 }).includes("database"));
});

test("a temporary address is fine to test on but flagged before launch", () => {
  const ids = failing(GOOD_ENV, { ...GOOD_FACTS, siteUrl: "https://49-13-9-56.sslip.io" });
  assert.deepEqual(ids.filter((i) => i === "site-url" || i === "own-domain"), ["own-domain"]);
});

test("no affiliate IDs and no email are recommended, not blockers", () => {
  const env = { ADMIN_PASSWORD: GOOD_ENV.ADMIN_PASSWORD, CLICK_HASH_SALT: GOOD_ENV.CLICK_HASH_SALT };
  const s = summarize(readinessChecks(env, GOOD_FACTS));
  assert.equal(s.ready, true);
  assert.deepEqual(s.recommended.map((c) => c.id).sort(), ["affiliate", "legal-notice", "mail", "postback-secret", "weekly-letter"]);
});

test("the weekly letter needs its switch, a postal address and email", () => {
  assert.ok(!failing(GOOD_ENV).includes("weekly-letter"));
  assert.ok(failing({ ...GOOD_ENV, NEWSLETTER_WEEKLY: "" }).includes("weekly-letter"));
  assert.ok(failing({ ...GOOD_ENV, MAIL_POSTAL_ADDRESS: "" }).includes("weekly-letter"));
  assert.ok(failing({ ...GOOD_ENV, RESEND_API_KEY: "" }).includes("weekly-letter"));
});

test("send caps and retention periods that don't parse are flagged, not fatal", () => {
  assert.ok(!failing({ ...GOOD_ENV, RETENTION_REPORT_DAYS: "90", NEWSLETTER_WEEKDAY: "2" }).includes("mail-numbers"));
  assert.ok(failing({ ...GOOD_ENV, RETENTION_REPORT_DAYS: "ninety" }).includes("mail-numbers"));
  assert.ok(failing({ ...GOOD_ENV, NEWSLETTER_WEEKDAY: "8" }).includes("mail-numbers"));
  assert.equal(summarize(readinessChecks({ ...GOOD_ENV, WATCH_MAX_PER_RUN: "-1" }, GOOD_FACTS)).ready, true);
});

test("no check ever echoes a secret", () => {
  const text = JSON.stringify(readinessChecks(GOOD_ENV, GOOD_FACTS));
  for (const secret of [GOOD_ENV.ADMIN_PASSWORD, GOOD_ENV.CLICK_HASH_SALT, GOOD_ENV.POSTBACK_SECRET, GOOD_ENV.RESEND_API_KEY]) {
    assert.ok(!text.includes(secret));
  }
});

test("the legal notice: required before any email goes out, recommended while email is off", () => {
  const legal = (env: Record<string, string>) => readinessChecks(env, GOOD_FACTS).find((c) => c.id === "legal-notice")!;
  assert.equal(legal(GOOD_ENV).ok, true);
  const missing = legal({ ...GOOD_ENV, LEGAL_ADDRESS: " " });
  assert.deepEqual([missing.ok, missing.level], [false, "blocker"]);
  assert.match(missing.detail, /LEGAL_ADDRESS/);
  assert.equal(summarize(readinessChecks({ ...GOOD_ENV, LEGAL_NAME: "" }, GOOD_FACTS)).ready, false, "email on, no notice: not ready");
  assert.equal(legal({ ...GOOD_ENV, LEGAL_NAME: "", RESEND_API_KEY: "" }).level, "recommended");
  assert.ok(!failing({ ...GOOD_ENV, WISH_MAX_PER_RUN: "50" }).includes("mail-numbers"));
  assert.ok(failing({ ...GOOD_ENV, WISH_MAX_PER_RUN: "lots" }).includes("mail-numbers"));
});

test("the legal notice is built only from what is set, never filled in", () => {
  assert.equal(legalNotice({ LEGAL_NAME: "A", LEGAL_EMAIL: "a@example.com" }), null);
  assert.deepEqual(legalNotice({ LEGAL_NAME: " Ana Owner ", LEGAL_ADDRESS: "1 Main St | 10115 Berlin | Germany", LEGAL_EMAIL: "a@example.com", LEGAL_PHONE: "" }), {
    name: "Ana Owner",
    address: ["1 Main St", "10115 Berlin", "Germany"],
    email: "a@example.com",
    phone: null,
    vatId: null,
    responsible: null,
  });
  assert.deepEqual(legalMissing({ LEGAL_NAME: "x" }), ["LEGAL_ADDRESS", "LEGAL_EMAIL"]);
});

test("the database password: the .env.example placeholder or a short one blocks; unknown is not checked", () => {
  assert.ok(failing({ ...GOOD_ENV, POSTGRES_PASSWORD: "change-me-to-a-long-random-string" }).includes("postgres-password"));
  assert.ok(failing({ ...GOOD_ENV, POSTGRES_PASSWORD: "short" }).includes("postgres-password"));
  assert.ok(!failing({ ...GOOD_ENV, POSTGRES_PASSWORD: "4f9a1c7e2b8d6a0f3c5e7b9d" }).includes("postgres-password"));
  assert.equal(readinessChecks(GOOD_ENV, GOOD_FACTS).find((c) => c.id === "postgres-password"), undefined);
  const text = JSON.stringify(readinessChecks({ ...GOOD_ENV, POSTGRES_PASSWORD: "4f9a1c7e2b8d6a0f3c5e7b9d" }, GOOD_FACTS));
  assert.ok(!text.includes("4f9a1c7e2b8d6a0f3c5e7b9d"));
});

test("addresses on another domain than the site's are flagged: the built-in contact address and MAIL_FROM", () => {
  const facts = { ...GOOD_FACTS, siteUrl: "https://www.cheaper.example", contactEmail: "hello@samebutcheaper.com" };
  const c = readinessChecks({ ...GOOD_ENV, MAIL_FROM: "Cheaper <hi@cheaper.example>" }, facts).find((x) => x.id === "own-addresses")!;
  assert.deepEqual([c.ok, c.level], [false, "recommended"]);
  assert.match(c.detail, /contact address hello@samebutcheaper\.com/);
  assert.doesNotMatch(c.detail, /MAIL_FROM/);
  assert.ok(!failing({ ...GOOD_ENV, MAIL_FROM: "x <hi@mail.cheaper.example>" }, { ...facts, contactEmail: "hello@cheaper.example" }).includes("own-addresses"));
  assert.ok(failing(GOOD_ENV, { ...facts, contactEmail: "hello@cheaper.example" }).includes("own-addresses"), "MAIL_FROM on samebutcheaper.com");
  assert.ok(!failing(GOOD_ENV, { ...GOOD_FACTS, contactEmail: "hello@samebutcheaper.com" }).includes("own-addresses"));
  assert.ok(!failing(GOOD_ENV, { ...GOOD_FACTS, siteUrl: "http://localhost:3000", contactEmail: "a@b.example" }).includes("own-addresses"));
});
