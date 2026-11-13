import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { isLimited, LIMITS, rateLimit, resetRateLimits } from "../../src/lib/rate-limit";

beforeEach(resetRateLimits);

test("allows up to the limit, then refuses until the window ends", () => {
  const rules = [{ limit: 3, windowMs: 1000 }];
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("t", "a", rules, t + i).ok, true);
  const refused = rateLimit("t", "a", rules, t + 10);
  assert.equal(refused.ok, false);
  assert.equal(refused.retryAfter, 1);
  assert.equal(rateLimit("t", "a", rules, t + 1001).ok, true, "a new window opens");
});

test("keys and limit names don't share counts", () => {
  const rules = [{ limit: 1, windowMs: 1000 }];
  assert.equal(rateLimit("x", "a", rules, 0).ok, true);
  assert.equal(rateLimit("x", "b", rules, 0).ok, true);
  assert.equal(rateLimit("y", "a", rules, 0).ok, true);
  assert.equal(rateLimit("x", "a", rules, 1).ok, false);
});

test("a refused hit doesn't use up the longer window", () => {
  const rules = [
    { limit: 2, windowMs: 1000 },
    { limit: 3, windowMs: 100_000 },
  ];
  assert.equal(rateLimit("m", "a", rules, 0).ok, true);
  assert.equal(rateLimit("m", "a", rules, 1).ok, true);
  for (let i = 0; i < 20; i++) assert.equal(rateLimit("m", "a", rules, 2 + i).ok, false);
  // The short window has passed; only two hits count toward the long one, so a third is allowed and a fourth isn't.
  assert.equal(rateLimit("m", "a", rules, 2000).ok, true);
  const fourth = rateLimit("m", "a", rules, 4000);
  assert.equal(fourth.ok, false);
  assert.equal(fourth.retryAfter, 96);
});

test("isLimited reads without counting", () => {
  const rules = [{ limit: 1, windowMs: 1000 }];
  assert.equal(isLimited("p", "a", rules, 0), false);
  assert.equal(isLimited("p", "a", rules, 0), false);
  rateLimit("p", "a", rules, 0);
  assert.equal(isLimited("p", "a", rules, 1), true);
  assert.equal(isLimited("p", "a", rules, 2000), false);
});

test("the store stays bounded under a flood of distinct keys", () => {
  const rules = [{ limit: 1, windowMs: 60_000 }];
  for (let i = 0; i < 25_000; i++) rateLimit("flood", `k${i}`, rules, 0);
  // The newest key is still tracked, the oldest was dropped to make room.
  assert.equal(isLimited("flood", "k24999", rules, 1), true);
  assert.equal(isLimited("flood", "k0", rules, 1), false);
});

test("every site limit has at least one sane rule", () => {
  for (const [name, rules] of Object.entries(LIMITS)) {
    assert.ok(rules.length > 0, name);
    for (const r of rules) assert.ok(r.limit > 0 && r.windowMs >= 1000, name);
  }
});

test("reports and missed searches: generous for a person, tight for a script, and counted once a day", () => {
  const t = 5_000_000;
  for (let i = 0; i < 5; i++) assert.equal(rateLimit("reports", "v", LIMITS.reports, t + i).ok, true);
  assert.equal(rateLimit("reports", "v", LIMITS.reports, t + 10).ok, false, "a sixth report in ten minutes");
  for (let i = 0; i < 20; i++) assert.equal(rateLimit("wanted", "v", LIMITS.wanted, t + i).ok, true);
  assert.equal(rateLimit("wanted", "v", LIMITS.wanted, t + 30).ok, false);
  assert.equal(rateLimit("once", "v:pair:x:price", LIMITS.oncePerDay, t).ok, true);
  assert.equal(rateLimit("once", "v:pair:x:price", LIMITS.oncePerDay, t + 3600_000).ok, false);
  assert.equal(rateLimit("once", "v:pair:x:stock", LIMITS.oncePerDay, t).ok, true, "another kind of report counts on its own");
  assert.equal(rateLimit("once", "v:pair:x:price", LIMITS.oncePerDay, t + 24 * 3600_000 + 1).ok, true, "the next day counts again");
});
