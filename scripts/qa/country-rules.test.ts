import assert from "node:assert/strict";
import { test } from "node:test";
import fx from "../../data/fx/ecb-reference-rates.json";
import { defaultMarket, type BrowseRow } from "../../src/lib/browse";
import { COUNTRY_CURRENCY, fallbackNotice, forCountry, listMarketFor, localFor, NO_RATE, rate, visibleMarkets } from "../../src/lib/localize";
import { COUNTRIES, deliversTo, storesFor, type MarketCode } from "../../src/lib/markets";

const row = (market: MarketCode, aisle: BrowseRow["aisle"] = "household"): BrowseRow => ({
  slug: `${market}-${aisle}`,
  aisle,
  shelf: "x",
  match: "equivalent_spec",
  market,
  photo: false,
  tier: 0 as BrowseRow["tier"],
  pct: 10,
  unit: 1,
  checked: "2026-11",
});

test("every country has a currency with a published rate, or a stated fallback", () => {
  const rates = fx.rates as Record<string, number>;
  for (const code of Object.keys(COUNTRIES)) {
    const currency = COUNTRY_CURRENCY[code];
    if (currency) assert.ok(currency === "EUR" || rates[currency] > 0, `${code} needs a rate for ${currency}`);
    else assert.ok(NO_RATE[code], `${code} has neither a currency nor a stated fallback`);
  }
  for (const code of Object.keys(NO_RATE)) assert.equal(COUNTRY_CURRENCY[code], undefined, `${code} is in both lists`);
});

test("the rates file is dated and sourced", () => {
  assert.match(fx.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(fx.url, /^https:\/\/www\.ecb\.europa\.eu\//);
  assert.equal(fx.base, "EUR");
});

test("Ireland leads with UK prices in euro, and never sees a US or Canadian record", () => {
  const ie = localFor("IE");
  assert.equal(ie.listMarket, "GB");
  assert.equal(ie.currency, "EUR");
  assert.equal(ie.fallback, true);
  assert.deepEqual(visibleMarkets("IE"), ["GB", "DE"]);
  const kept = forCountry([{ market: "US" as const }, { market: "CA" as const }, { market: "GB" as const }, { market: "DE" as const }], "IE");
  assert.deepEqual(kept.map((k) => k.market), ["GB", "DE"]);
});

test("US and Canadian records stay in the US and Canada, whatever the country", () => {
  for (const code of Object.keys(COUNTRIES)) {
    const markets = visibleMarkets(code);
    if (code === "US" || code === "CA") assert.ok(markets.includes("US") && markets.includes("CA"), code);
    else assert.ok(!markets.includes("US") && !markets.includes("CA"), code);
    assert.ok(markets.includes(listMarketFor(code)), `${code} leads with a market it can see`);
  }
});

test("a conversion is marked, uses the committed rate and keeps the original with its date", () => {
  const ie = localFor("IE");
  const expected = 9.99 / (fx.rates as Record<string, number>).GBP;
  assert.equal(ie.amount(9.99, "GBP"), expected);
  assert.equal(ie.money(9.99, "GBP"), `about €${expected.toFixed(2)}`);
  assert.equal(ie.bare(9.99, "GBP"), `€${expected.toFixed(2)}`);
  assert.equal(ie.original(9.99, "GBP", "GB", "2026-11"), "£9.99 at a UK store, Nov 2026");
});

test("no conversion means no marking and no second price", () => {
  const ie = localFor("IE");
  assert.equal(ie.money(11.7, "EUR"), "€11.70");
  assert.equal(ie.original(11.7, "EUR", "DE", "2026-11"), null);
  assert.equal(localFor("GB").money(9.99, "GBP"), "£9.99");
  assert.equal(localFor("US").money(9.99, "USD"), "$9.99");
});

test("with no country, a record keeps its own currency and store: we can't say it's foreign", () => {
  const unknown = localFor(null);
  assert.equal(unknown.known, false);
  assert.equal(unknown.money(9.99, "GBP"), "£9.99");
  assert.equal(unknown.converts("GBP"), false);
  assert.equal(unknown.original(9.99, "GBP", "GB", "2026-11"), null);
  assert.equal(unknown.sells("tesco", "GB"), true);
  assert.equal(unknown.listMarket, "US");
  assert.equal(fallbackNotice(unknown), null);
  // A known US shopper is different: they get dollars, and no UK store.
  assert.equal(localFor("US").sells("tesco", "GB"), false);
  assert.match(localFor("US").money(9.99, "GBP"), /^about \$/);
});

test("the band says what it's showing, in each case", () => {
  const ie = fallbackNotice(localFor("IE"));
  assert.match(ie?.text ?? "", /prices in Ireland yet, so these are UK prices, shown in euro/);
  assert.match(ie?.rate ?? "", /ECB rate of 6 Nov 2026, £1 = €1\.\d\d/);

  const hr = fallbackNotice(localFor("HR"));
  assert.match(hr?.text ?? "", /these are German prices, shown in euro/);
  assert.equal(hr?.rate, null);

  const rs = fallbackNotice(localFor("RS"));
  assert.equal(localFor("RS").currency, "EUR");
  assert.match(rs?.text ?? "", /no reference rate for the Serbian dinar/);

  assert.equal(localFor("AE").currency, "GBP");
  for (const own of ["US", "GB", "CA", "DE"]) assert.equal(fallbackNotice(localFor(own)), null, own);
});

test("a currency with no rate throws instead of passing a price through 1:1", () => {
  assert.throws(() => rate("USD", "XXX" as never), /No reference rate/);
});

test("unit prices stay readable in a currency with no small unit", () => {
  // 0.37 once read "CHF 7", because the "37.0 ct" clean-up ran on it.
  assert.equal(localFor("CH").unitBare(0.4, "count", "CHF"), "CHF 0.40");
  assert.ok(!localFor("JP").unitBare(1, "count", "GBP").includes("undefined"));
});

test("the default list follows the rule, and doesn't pick a country the list has none of", () => {
  const all = [row("US"), row("GB"), row("DE")];
  assert.equal(defaultMarket(all, "US"), "US");
  assert.equal(defaultMarket(all, null), "US");
  assert.equal(defaultMarket(all, "IE"), "GB");
  assert.equal(defaultMarket(all, "HR"), "DE");
  assert.equal(defaultMarket(all, "DE"), "DE");
  // Ireland with only German rows on this list: "all", which is only what the server sent.
  assert.equal(defaultMarket([row("DE")], "IE"), "all");
});

test("no store that doesn't sell in the selected country", () => {
  assert.equal(deliversTo("walmart", "US", "IE"), "no");
  assert.equal(deliversTo("target", "US", "IE"), "no");
  assert.equal(deliversTo("costco", "US", "IE"), "no");
  assert.equal(deliversTo("tesco", "GB", "IE"), "no");
  assert.equal(deliversTo("amazon", "GB", "IE"), "maybe");
  assert.equal(deliversTo("walmart", "US", "US"), "yes");
});

test("Ireland's store links are Irish, and the specialist one only shows in its aisles", () => {
  const ids = (aisle?: string) => storesFor("IE", aisle).map((s) => s.id);
  assert.deepEqual(ids("household"), ["amazon", "supervalu", "lidl-ie", "google"]);
  assert.deepEqual(ids("tools-diy"), ["amazon", "supervalu", "lidl-ie", "woodies", "google"]);
  // The redirect looks a store up by id with no aisle, so it must still know every one.
  assert.ok(ids().includes("woodies"));
  const hosts = storesFor("IE").map((s) => new URL(s.search.replace("{q}", "x")).hostname);
  assert.ok(hosts.includes("www.amazon.ie"));
  assert.ok(!hosts.some((h) => /walmart|target|costco/.test(h)));
});
