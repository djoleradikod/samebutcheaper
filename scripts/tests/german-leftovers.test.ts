/**
 * The last English corners of the German site: dates in German record prose, the vet clause only where pets are,
 * the pages an email opens in the subscriber's language, and a /de 404 that stays German.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { germanDates, withGermanDates } from "../../src/lib/i18n/german-dates";
import { getT } from "../../src/lib/i18n";
import { countryRoute } from "../../src/proxy";
import { confirmUrl, unsubscribeUrl } from "../../src/lib/newsletter";
import { hrefOnPage, isPrefixable } from "../../src/lib/country-url";
import { numbersIn } from "../../src/lib/i18n/record-check";

test("an ISO date in German prose reads as a German date, nothing else changes", () => {
  assert.equal(germanDates("bei REWE am 2026-09-18, keiner als Angebot"), "bei REWE am 18. September 2026, keiner als Angebot");
  assert.equal(germanDates("am 2026-03-26 und am 2026-02-06"), "am 26. März 2026 und am 6. Februar 2026");
  assert.equal(germanDates("https://example.org/2026-09-18/report"), "https://example.org/2026-09-18/report", "inside a web address");
  assert.equal(germanDates("Code 12026-09-18"), "Code 12026-09-18");
  assert.equal(germanDates("2026-13-01"), "2026-13-01", "not a date");
  const record = { evidence: "am 2026-11-06 abgelesen", differences: ["seit 2026-01-01"], n: 3 };
  assert.deepEqual(withGermanDates(record), { evidence: "am 6. November 2026 abgelesen", differences: ["seit 1. Januar 2026"], n: 3 });
  assert.equal(withGermanDates(record), withGermanDates(record), "worked out once per record");
});

test("the record check still compares the stored text, so the shown date doesn't matter to it", () => {
  // The check reads the record files, where the date stays ISO; the German date only exists on the page.
  assert.deepEqual(numbersIn("am 2026-09-18", "de"), numbersIn("on 2026-09-18", "en"));
});

test("a vet is named only where pet products are", () => {
  for (const lang of ["en", "de"] as const) {
    const t = getT(lang);
    assert.doesNotMatch(t("evidence.healthBody"), /vet|Tierarzt/i, `${lang}: human medicines`);
    assert.match(t("evidence.healthBodyPet"), /vet|Tierarzt/i, `${lang}: pet products`);
  }
});

test("a German subscriber's email links open the German pages, and those pages exist only under /de", () => {
  assert.equal(confirmUrl("https://s.example", "abc", "de"), "https://s.example/de/newsletter/confirm?t=abc");
  assert.equal(confirmUrl("https://s.example", "abc"), "https://s.example/newsletter/confirm?t=abc");
  assert.equal(unsubscribeUrl("https://s.example", "tok", "letter", "de"), "https://s.example/de/newsletter/unsubscribe?token=tok&only=letter");
  assert.equal(unsubscribeUrl("https://s.example", "tok"), "https://s.example/newsletter/unsubscribe?token=tok");
  for (const p of ["confirm", "confirmed", "confirmed/watch", "confirmed/wish", "invalid", "stopped", "unsubscribe", "unsubscribed"]) {
    assert.deepEqual(countryRoute(`/de/newsletter/${p}`), { country: "DE", internal: `/country/de/newsletter/${p}` });
    assert.equal(countryRoute(`/uk/newsletter/${p}`), "missing", "an English prefix has none");
  }
  assert.equal(hrefOnPage("/disclosure", "DE"), "/de/disclosure");
  assert.ok(!isPrefixable("/disclosure", "GB"));
});

test("an address under /de that is no page is a German 404", () => {
  assert.equal(countryRoute("/de/no-such-page"), "missing");
  assert.equal(countryRoute("/de/compare/no-such-swap"), "missing");
});
