import assert from "node:assert/strict";
import { test } from "node:test";
import { isAdminAuthorized, sameSecret } from "../../src/lib/admin-auth";
import { clientIp, isBotAgent, isPrefetch, visitorFrom } from "../../src/lib/visitor";

const h = (o: Record<string, string>) => new Headers(o);
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("client address: first X-Forwarded-For entry, unless a CDN header is named", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), {}), "203.0.113.7");
  assert.equal(clientIp(h({ "x-real-ip": "203.0.113.8" }), {}), "203.0.113.8");
  assert.equal(clientIp(h({}), {}), "");
  // Not trusted unless configured: a visitor can send this header themselves.
  assert.equal(clientIp(h({ "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "203.0.113.7" }), {}), "203.0.113.7");
  assert.equal(
    clientIp(h({ "cf-connecting-ip": "198.51.100.1", "x-forwarded-for": "172.64.0.1" }), { CLIENT_IP_HEADER: "CF-Connecting-IP" }),
    "198.51.100.1",
  );
  assert.equal(clientIp(h({ "x-forwarded-for": "2001:db8::1" }), {}), "2001:db8::1");
  assert.equal(clientIp(h({ "x-forwarded-for": "<script>" }), {}), "", "junk is not an address");
});

test("bots, scripts and empty user agents don't count as visitors; browsers do", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)",
    "curl/8.5.0",
    "python-requests/2.32.0",
    "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/130.0.0.0",
    "AhrefsBot/7.0",
    "",
  ]) {
    assert.equal(isBotAgent(ua), true, ua);
  }
  for (const ua of [CHROME, IPHONE]) assert.equal(isBotAgent(ua), false, ua);
});

test("prefetches are recognised", () => {
  assert.equal(isPrefetch(h({ "sec-purpose": "prefetch;prerender" })), true);
  assert.equal(isPrefetch(h({ purpose: "prefetch" })), true);
  assert.equal(isPrefetch(h({ "next-router-prefetch": "1" })), true);
  assert.equal(isPrefetch(h({ "user-agent": CHROME })), false);
});

test("the visitor hash is stable within a day and never holds the address", () => {
  const a = visitorFrom(h({ "x-forwarded-for": "203.0.113.7", "user-agent": CHROME }));
  const b = visitorFrom(h({ "x-forwarded-for": "203.0.113.7", "user-agent": CHROME }));
  const c = visitorFrom(h({ "x-forwarded-for": "203.0.113.9", "user-agent": CHROME }));
  assert.equal(a.hash, b.hash);
  assert.notEqual(a.hash, c.hash);
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.ok(!a.hash.includes("203"));
  assert.equal(a.key, "203.0.113.7");
  assert.equal(visitorFrom(h({ "user-agent": CHROME })).key.length, 64, "without an address, the limit key is the hash");
});

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

test("admin login: right user and password only", () => {
  const pw = "correct horse battery";
  assert.equal(isAdminAuthorized(basic("admin", pw), pw), true);
  assert.equal(isAdminAuthorized(basic("admin", "wrong"), pw), false);
  assert.equal(isAdminAuthorized(basic("root", pw), pw), false);
  assert.equal(isAdminAuthorized(basic("admin", ""), pw), false);
  assert.equal(isAdminAuthorized(null, pw), false);
  assert.equal(isAdminAuthorized("Bearer abc", pw), false);
  assert.equal(isAdminAuthorized("Basic !!!not-base64!!!", pw), false);
  assert.equal(isAdminAuthorized(basic("admin", pw), undefined), false, "no password set means nobody gets in");
  assert.equal(isAdminAuthorized(basic("admin", ""), ""), false);
});

test("admin login: a password with colons or non-ASCII characters works", () => {
  assert.equal(isAdminAuthorized(basic("admin", "a:b:c"), "a:b:c"), true);
  assert.equal(isAdminAuthorized(basic("admin", "a:b"), "a:b:c"), false);
  assert.equal(isAdminAuthorized(basic("admin", "pässwörd-šđ"), "pässwörd-šđ"), true);
});

test("sameSecret compares values of different lengths without throwing", () => {
  assert.equal(sameSecret("abc", "abc"), true);
  assert.equal(sameSecret("abc", "abcd"), false);
  assert.equal(sameSecret("", "x"), false);
});
