/** Run with: npm run test:links */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tagLink, programFor, newClickId, programEnvKey } from "../src/lib/affiliate-links";
import { PROGRAMS } from "../src/lib/affiliate-programs";

const WM = "https://www.walmart.com/ip/Equate-Ibuprofen/123?athcpid=x";

test("untagged when nothing is configured", () => {
  assert.deepEqual(tagLink(WM, "abc123", {}), { url: WM, program: null, network: null });
});

test("Impact tracking link wraps the product URL with the click ID", () => {
  const r = tagLink(WM, "abc123", { AFF_WALMART_US: "https://goto.walmart.com/c/111/565706/9383" });
  assert.equal(r.program, "walmart-us");
  const u = new URL(r.url);
  assert.equal(u.hostname, "goto.walmart.com");
  assert.equal(u.searchParams.get("u"), WM);
  assert.equal(u.searchParams.get("subId1"), "abc123");
});

test("Amazon tag per storefront, never sent to a sub-network", () => {
  const env = { AMAZON_ASSOCIATE_TAG: "sbc-20", AMAZON_TAGS: "amazon.co.uk:sbc-21", SKIMLINKS_ID: "999X" };
  assert.equal(new URL(tagLink("https://www.amazon.com/dp/B000", "c1", env).url).searchParams.get("tag"), "sbc-20");
  assert.equal(new URL(tagLink("https://www.amazon.co.uk/s?k=x", "c1", env).url).searchParams.get("tag"), "sbc-21");
  // amazon.de has no tag: stays plain rather than going through Skimlinks
  assert.deepEqual(tagLink("https://www.amazon.de/s?k=x", "c1", env).program, null);
});

test("Awin deep link with clickref", () => {
  const r = tagLink("https://www.boots.com/x", "c2", { AWIN_PUBLISHER_ID: "4242", AFF_BOOTS: "2041" });
  const u = new URL(r.url);
  assert.equal(u.hostname, "www.awin1.com");
  assert.equal(u.searchParams.get("awinmid"), "2041");
  assert.equal(u.searchParams.get("awinaffid"), "4242");
  assert.equal(u.searchParams.get("clickref"), "c2");
  assert.equal(u.searchParams.get("ued"), "https://www.boots.com/x");
});

test("Awin program needs the publisher ID too", () => {
  assert.equal(tagLink("https://www.boots.com/x", "c2", { AFF_BOOTS: "2041" }).program, null);
});

test("Rakuten, CJ, Partnerize formats", () => {
  const rk = new URL(tagLink("https://www.dermstore.com/p", "c3", { RAKUTEN_SITE_ID: "SITE", AFF_DERMSTORE: "12345" }).url);
  assert.equal(rk.hostname, "click.linksynergy.com");
  assert.equal(rk.searchParams.get("mid"), "12345");
  assert.equal(rk.searchParams.get("u1"), "c3");
  const cj = tagLink("https://www.cvs.com/shop/x", "c4", { CJ_PID: "777", AFF_CVS: "1" });
  assert.equal(cj.url, "https://www.anrdoezrs.net/links/777/type/dlg/sid/c4/https://www.cvs.com/shop/x");
  const pz = tagLink("https://www.chewy.com/p", "c5", { AFF_CHEWY: "1100lABC" });
  assert.ok(pz.url.startsWith("https://prf.hn/click/camref:1100lABC/pubref:c5/destination:https%3A%2F%2F"));
});

test("full template overrides any network", () => {
  const r = tagLink("https://www.iherb.com/pr/x", "c6", { AFF_IHERB: "https://www.iherb.com/pr/x?rcode=ABC&u={url}&s={click}" });
  assert.equal(r.program, "iherb");
  assert.ok(r.url.includes("s=c6"));
});

test("sub-network catches stores without a direct program", () => {
  const r = tagLink("https://www.tesco.com/groceries/x", "c7", { SKIMLINKS_ID: "123X456" });
  assert.equal(r.program, "skimlinks");
  const u = new URL(r.url);
  assert.equal(u.searchParams.get("url"), "https://www.tesco.com/groceries/x");
  assert.equal(u.searchParams.get("xcust"), "c7");
  const s = tagLink("https://www.tesco.com/groceries/x", "c7", { SOVRN_KEY: "k", AFFILIATE_FALLBACK: "sovrn" });
  assert.equal(s.program, "sovrn");
  // and a direct program that isn't configured yet falls back to the sub-network
  assert.equal(tagLink(WM, "c7", { SKIMLINKS_ID: "123X456" }).program, "skimlinks");
});

test("search engines and bad URLs are never wrapped", () => {
  assert.equal(tagLink("https://www.google.com/search?q=x", "c8", { SKIMLINKS_ID: "1" }).program, null);
  assert.equal(tagLink("javascript:alert(1)", "c8", { SKIMLINKS_ID: "1" }).program, null);
  assert.equal(tagLink("not a url", "c8", { SKIMLINKS_ID: "1" }).url, "not a url");
});

test("subdomains match, look-alike hosts don't", () => {
  assert.equal(programFor("https://us.ugreen.com/x")?.id, "ugreen");
  assert.equal(programFor("https://business.walmart.com/x")?.id, "walmart-us");
  assert.equal(programFor("https://notwalmart.com/x"), undefined);
});

test("program ids are unique, hosts are owned once, env keys are valid", () => {
  const ids = new Set<string>();
  const hosts = new Set<string>();
  for (const p of PROGRAMS) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.match(programEnvKey(p.id), /^AFF_[A-Z0-9_]+$/);
    for (const h of p.hosts) {
      assert.ok(!hosts.has(h), `host ${h} in two programs`);
      hosts.add(h);
    }
  }
});

test("click IDs are short and URL-safe", () => {
  const id = newClickId();
  assert.match(id, /^[a-z0-9]{9}$/);
  assert.notEqual(id, newClickId());
});
