import assert from "node:assert/strict";
import { test } from "node:test";
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
  assert.deepEqual(s.recommended.map((c) => c.id).sort(), ["affiliate", "mail", "postback-secret"]);
});

test("no check ever echoes a secret", () => {
  const text = JSON.stringify(readinessChecks(GOOD_ENV, GOOD_FACTS));
  for (const secret of [GOOD_ENV.ADMIN_PASSWORD, GOOD_ENV.CLICK_HASH_SALT, GOOD_ENV.POSTBACK_SECRET, GOOD_ENV.RESEND_API_KEY]) {
    assert.ok(!text.includes(secret));
  }
});
