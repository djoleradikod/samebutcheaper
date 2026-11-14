/**
 * The first-touch source without a cookie (src/lib/traffic-source.ts) and the consent gate for affiliate tracking
 * (src/lib/consent.ts): who is asked, what a link carries with and without a yes, and that nothing is gated today.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { clickSource, trafficSource, withSource } from "../../src/lib/traffic-source";
import { consentActive, consentApplies, consentCookie, gatedProgrammes, gatedStores, gateLink, mayTag, readConsent } from "../../src/lib/consent";
import { registrySchema, type ProgrammeEntry } from "../../src/lib/programmes";

const ORIGIN = "https://samebutcheaper.example";

test("the source comes from the campaign tag or the referring site, never from our own pages", () => {
  assert.equal(trafficSource(new URLSearchParams("utm_source=Newsletter&utm_medium=email"), null, "samebutcheaper.example"), "newsletter.email");
  assert.equal(trafficSource(new URLSearchParams("ref=reddit"), "https://www.google.com/", "samebutcheaper.example"), "reddit");
  assert.equal(trafficSource(new URLSearchParams(), "https://www.google.com/search?q=x", "samebutcheaper.example"), "google.com");
  assert.equal(trafficSource(new URLSearchParams(), "https://samebutcheaper.example/compare/a", "samebutcheaper.example"), null);
  assert.equal(trafficSource(new URLSearchParams(), null, "samebutcheaper.example"), null);
});

test("a store link carries the source only to our own redirects, once", () => {
  assert.equal(withSource("/go/a/alternative", "google.com", ORIGIN), `${ORIGIN}/go/a/alternative?src=google.com`);
  assert.equal(withSource(`${ORIGIN}/out?s=tesco&c=GB&q=x&from=a`, "reddit", ORIGIN), `${ORIGIN}/out?s=tesco&c=GB&q=x&from=a&src=reddit`);
  assert.equal(withSource(`${ORIGIN}/go/a/brand?src=x`, "reddit", ORIGIN), `${ORIGIN}/go/a/brand?src=x`, "the first source stays");
  assert.equal(withSource("/compare/a", "reddit", ORIGIN), "/compare/a", "not a store link");
  assert.equal(withSource("https://elsewhere.example/go/a/b", "reddit", ORIGIN), "https://elsewhere.example/go/a/b");
  assert.equal(withSource("/go/a/brand", null, ORIGIN), "/go/a/brand");
  assert.equal(withSource("/go/a/brand", "Bad Value!", ORIGIN), "/go/a/brand", "only a clean source");
});

test("/go reads the source from its own address, or from another site linking straight to it", () => {
  const hosts = ["samebutcheaper.example"];
  assert.equal(clickSource(`${ORIGIN}/go/a/alternative?src=google.cpc`, `${ORIGIN}/compare/a`, hosts), "google.cpc");
  assert.equal(clickSource(`${ORIGIN}/go/a/alternative`, `${ORIGIN}/compare/a`, hosts), null, "a click from our page with nothing carried");
  assert.equal(clickSource(`${ORIGIN}/go/a/alternative`, "https://forum.example/thread", hosts), "forum.example");
  assert.equal(clickSource(`${ORIGIN}/go/a/alternative?src=<script>`, null, hosts), null);
});

test("consent applies in the EU, the EEA, the UK, Switzerland and wherever we can't tell", () => {
  for (const c of ["DE", "AT", "IE", "FR", "NO", "IS", "LI", "GB", "CH", "HR"]) assert.equal(consentApplies(c), true, c);
  for (const c of ["US", "CA", "AU"]) assert.equal(consentApplies(c), false, c);
  assert.equal(consentApplies(null), true);
  assert.equal(consentApplies("xx"), true);
});

test("the choice is read and written as one small cookie", () => {
  assert.equal(readConsent("sbc_country=DE; sbc_consent=yes"), "yes");
  assert.equal(readConsent("sbc_consent=no"), "no");
  assert.equal(readConsent("sbc_consent=maybe"), null);
  assert.equal(readConsent("xsbc_consent=yes"), null);
  assert.equal(readConsent(null), null);
  assert.match(consentCookie("yes"), /^sbc_consent=yes; Path=\/; Max-Age=\d+; SameSite=Lax$/);
});

const flagged = registrySchema.parse({
  checked: "2026-11-14",
  method: "test",
  stores: {
    ulta: {
      network: "awin",
      programme: "ulta",
      source: "https://example.org/ulta",
      terms: { consentBeforeTracking: true, source: "https://example.org/ulta/terms", quote: "§ 4: consent first", checked: "2026-11-14" },
    },
    tesco: { network: "awin", source: "https://example.org/tesco" },
  },
}).stores as Record<string, ProgrammeEntry>;

test("a flagged programme is tagged only with a yes, or outside the region; others always", () => {
  const gated = gatedProgrammes(flagged);
  assert.deepEqual([...gated], ["ulta"]);
  assert.deepEqual(gatedStores(flagged), ["ulta"]);
  assert.equal(consentActive(flagged), true);
  assert.equal(mayTag("ulta", { consent: null, country: "GB" }, gated), false, "nothing before a choice");
  assert.equal(mayTag("ulta", { consent: "no", country: "GB" }, gated), false);
  assert.equal(mayTag("ulta", { consent: "yes", country: "GB" }, gated), true);
  assert.equal(mayTag("ulta", { consent: null, country: null }, gated), false, "unknown country asks");
  assert.equal(mayTag("ulta", { consent: null, country: "US" }, gated), true);
  assert.equal(mayTag("walmart-us", { consent: "no", country: "DE" }, gated), true, "a programme that doesn't ask");
  const tagged = { url: "https://www.awin1.com/cread.php?x", program: "ulta", network: "awin" };
  assert.deepEqual(gateLink(tagged, "https://www.ulta.com/p", { consent: null, country: "GB" }, gated), { url: "https://www.ulta.com/p", program: null, network: null });
  assert.equal(gateLink(tagged, "https://www.ulta.com/p", { consent: "yes", country: "GB" }, gated), tagged);
});

test("no programme asks for consent today, so no one is asked and every link is tagged as before", () => {
  assert.equal(consentActive(), false);
  assert.deepEqual(gatedStores(), []);
});
