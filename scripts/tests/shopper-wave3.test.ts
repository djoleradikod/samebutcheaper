/**
 * Wave 3 loose ends: links that carry the shopper's country, the share target, kits shoppers report never leading a list,
 * My list's offline date and the "did you mean" No counted as wanted.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterKits } from "../../src/lib/kit-filter";
import { offlineDate, savedAt } from "../../src/lib/offline";
import { kitCanLeadNow, kitLeadFirst, setReported } from "../../src/lib/reported-state";
import { shareTarget, shopperPrefixCountry } from "../../src/lib/shopper-links";
import { hrefOnPage } from "../../src/lib/country-url";
import { wantedRequest } from "../../src/lib/wanted";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

test("a shopper's links carry their country's prefix; crawlers, unprefixed countries and the wide view keep them as written", () => {
  assert.equal(shopperPrefixCountry("sbc_src=x; sbc_country=DE", IPHONE), "DE");
  assert.equal(shopperPrefixCountry("sbc_country=GB", IPHONE), "GB");
  assert.equal(shopperPrefixCountry("sbc_country=DE", GOOGLEBOT), null, "never a crawler");
  assert.equal(shopperPrefixCountry("sbc_country=DE", ""), null, "an empty user agent counts as a script");
  assert.equal(shopperPrefixCountry("sbc_country=HR", IPHONE), null, "Croatia has no prefix");
  assert.equal(shopperPrefixCountry("", IPHONE), null, "no country, no change");
  assert.equal(shopperPrefixCountry("sbc_country=DE; sbc_others=1", IPHONE), null, "other countries' swaps live on unprefixed pages");
  assert.equal(shopperPrefixCountry("sbc_country=DE; sbc_others=0", IPHONE), "DE");
  assert.equal(shopperPrefixCountry("xsbc_country=DE", IPHONE), null, "only the cookie itself");
  // What CountryLink then does with it: the same URLs the switcher and the sitemap use, and nothing else.
  assert.equal(hrefOnPage("/compare/x", "DE"), "/de/compare/x");
  assert.equal(hrefOnPage("/", "GB"), "/uk");
  assert.equal(hrefOnPage("/brands", "DE"), "/brands");
  assert.equal(hrefOnPage("/uk/compare/x", "DE"), "/uk/compare/x", "an already prefixed link stays");
});

test("sharing sends the sharer's country version when it lists the record, else the canonical", () => {
  const versions = { US: "/us/compare/a", CA: "/ca/compare/a-ca" };
  assert.equal(shareTarget(versions, "/us/compare/a", "CA"), "/ca/compare/a-ca");
  assert.equal(shareTarget(versions, "/us/compare/a", "DE"), "/us/compare/a");
  assert.equal(shareTarget(versions, "/us/compare/a", null), "/us/compare/a");
});

test("a kit shoppers report as changed never leads a kit list, under any order", () => {
  setReported([{ recordKind: "bundle", slug: "b" }]);
  try {
    assert.equal(kitCanLeadNow({ slug: "b" }), false);
    assert.equal(kitCanLeadNow({ slug: "a" }), true);
    assert.deepEqual([{ slug: "b" }, { slug: "a" }].sort(kitLeadFirst).map((k) => k.slug), ["a", "b"]);
    const items = [
      { slug: "a", aisle: "tech", oneStore: true, net: 10, netPct: 50, rank: 1 },
      { slug: "b", aisle: "tech", oneStore: false, net: 40, netPct: 60, rank: 0, stale: !kitCanLeadNow({ slug: "b" }) },
      { slug: "c", aisle: "skin", oneStore: true, net: 25, netPct: 30, rank: 2 },
    ];
    for (const sort of ["recommended", "amount", "pct"] as const) {
      const order = filterKits(items, { aisle: "all", oneStore: false, sort }).map((i) => i.slug);
      assert.equal(order.at(-1), "b", sort);
    }
  } finally {
    setReported([]);
  }
  assert.equal(kitCanLeadNow({ slug: "b" }), true, "until the flag clears");
});

test("offline, My list dates its prices from when the copy was kept", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(savedAt(h({ "x-sbc-saved": "2026-11-12T08:30:00.000Z", date: "Wed, 01 Jan 2025 00:00:00 GMT" }))?.toISOString(), "2026-11-12T08:30:00.000Z");
  assert.equal(savedAt(h({ date: "Thu, 12 Nov 2026 08:30:00 GMT" }))?.toISOString(), "2026-11-12T08:30:00.000Z", "the response date when there's no stamp");
  assert.equal(savedAt(h({ "x-sbc-saved": "junk" })), null);
  assert.equal(savedAt(h({})), null);
  assert.equal(offlineDate(new Date("2026-11-12T23:30:00Z")), "12 Nov 2026");
});

test("a 'did you mean' answered No is counted as wanted from the check, by its cleaned name only", () => {
  assert.deepEqual(wantedRequest({ q: "Nurofen Express", source: "check" }), { query: "nurofen express", source: "check" });
  assert.deepEqual(wantedRequest({ q: "ibuprofen gel" }), { query: "ibuprofen gel", source: "search" });
  assert.deepEqual(wantedRequest({ q: "ibuprofen gel", source: "admin" }), { query: "ibuprofen gel", source: "search" }, "no other sources");
  assert.equal(wantedRequest({ q: "me@example.com", source: "check" }), null, "nothing personal");
  assert.equal(wantedRequest(null), null);
  assert.equal(wantedRequest("q"), null);
});
