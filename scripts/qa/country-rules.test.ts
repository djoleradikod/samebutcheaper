import assert from "node:assert/strict";
import { test } from "node:test";
import fx from "../../data/fx/ecb-reference-rates.json";
import { defaultMarket, type BrowseRow } from "../../src/lib/browse";
import { COUNTRY_CURRENCY, fallbackNotice, forCountry, listMarketFor, localFor, NO_RATE, rate, visibleMarkets } from "../../src/lib/localize";
import { COUNTRIES, deliversTo, isKnownCountry, storesFor, type MarketCode } from "../../src/lib/markets";
import { inRange, RATING_FLOOR, ratingLabel, ratingShare } from "../../src/lib/rating";
import { sellerOf, sellsIn } from "../../src/lib/sellers";

const row = (market: MarketCode, aisle: BrowseRow["aisle"] = "household"): BrowseRow => ({
  slug: `${market}-${aisle}`,
  aisle,
  shelf: "x",
  match: "equivalent_spec",
  market,
  photo: false,
  tier: 0 as BrowseRow["tier"],
  rated: false,
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
  const everywhere = ["amazon"];
  const kept = forCountry((["US", "CA", "GB", "DE"] as const).map((market) => ({ market, sellers: everywhere })), ie);
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

const listed = (market: MarketCode, ...sellers: string[]) => ({ market, sellers });

test("the seller comes from the own-label name first, then the store, then the link", () => {
  const side = (brand: string, product: string, retailer: string, url = "") => sellerOf({ brand, product, retailer, url });
  assert.equal(side("Sainsbury's", "Hot chocolate", "sainsburys"), "sainsburys");
  assert.equal(side("Marks & Spencer", "Tea", "ocado"), "marksandspencer", "own label beats the store it was priced through");
  assert.equal(side("Vonhaus", "Rotary tool", "other", "https://www.amazon.co.uk/s?k=x"), "amazon");
  assert.equal(side("Jeden Tag", "Reis", "other", "https://www.mytime.de/x"), "mytime");
  assert.equal(side("Galpharm", "Ibuprofen", "tesco", "https://www.tesco.com/x"), "tesco");
  assert.equal(side("Someone", "Thing", "other", "https://www.which.co.uk/x"), "unknown", "a review site isn't a seller");
  assert.equal(side("Someone", "Thing", "other"), "unknown");
});

test("the footprint places sellers only on evidence", () => {
  assert.ok(sellsIn("lidl", "IE"));
  assert.ok(sellsIn("tesco", "IE"), "carried by the manual source");
  assert.ok(sellsIn("amazon", "IE"));
  assert.ok(!sellsIn("sainsburys", "IE"));
  assert.ok(!sellsIn("unknown", "IE"));
  assert.ok(!sellsIn("amazon", "RS"), "no storefront delivers there");
});

test("Ireland lists a UK record only from a seller there, and the control brings back the rest but never the US", () => {
  const ie = localFor("IE");
  assert.ok(ie.shows(listed("GB", "tesco")));
  assert.ok(ie.shows(listed("DE", "zooplus")));
  assert.ok(!ie.shows(listed("GB", "sainsburys")));
  assert.ok(!ie.shows(listed("DE", "kaufland")));
  assert.ok(!ie.shows(listed("US", "amazon")));
  const more = localFor("IE", true);
  assert.ok(more.others);
  assert.ok(more.shows(listed("GB", "sainsburys")));
  assert.ok(!more.shows(listed("US", "walmart")));
  assert.ok(!more.shows(listed("CA", "loblaws")));
});

test("a basket or kit needs every seller to pass", () => {
  assert.ok(localFor("IE").shows(listed("GB", "tesco", "lidl")));
  assert.ok(!localFor("IE").shows(listed("GB", "tesco", "sainsburys")));
});

test("a country with its own market keeps its records and judges the others by seller, with no way to turn that off", () => {
  const gb = localFor("GB", true);
  assert.equal(gb.others, false);
  assert.ok(gb.shows(listed("GB", "sainsburys")));
  assert.ok(!gb.shows(listed("DE", "kaufland")));
  assert.ok(gb.shows(listed("DE", "lidl")));
  assert.ok(!localFor("US").shows(listed("GB", "tesco")));
  assert.ok(localFor("US").shows(listed("CA", "loblaws")));
  assert.ok(localFor("CA").shows(listed("US", "walmart")), "Canada fills up from the US");
});

test("an unknown country filters nothing", () => {
  assert.ok(localFor(null).shows(listed("GB", "sainsburys")));
  assert.equal(forCountry([listed("US", "walmart")], localFor(null)).length, 1);
});

test("written prices convert, keep the original and leave everything else alone", () => {
  const ie = localFor("IE");
  const out = ie.prose("Aldi scored 68%, at £4.39 against 44p per 100g.", "GBP");
  assert.match(out, /^Aldi scored 68%, at about €[\d.]+ \(£4\.39\) against about [\d.]+ ct \(44p\) per 100g\.$/);
  assert.equal(ie.prose("Costs €2.59 at dm, 16.80 EUR for six.", "EUR"), "Costs €2.59 at dm, 16.80 EUR for six.", "nothing converts in euro");
  const gb = localFor("GB");
  assert.equal(gb.prose("At £4.39 and 44p.", "GBP"), "At £4.39 and 44p.");
  assert.match(gb.prose("Costs €2.59, or 16.80 EUR for six.", "EUR"), /^Costs about £[\d.]+ \(€2\.59\), or about £[\d.]+ \(16\.80 EUR\) for six\.$/);
  assert.equal(localFor(null).prose("At £4.39.", "GBP"), "At £4.39.", "with no country nothing is foreign");
  assert.equal(ie.prose("Use a 25p coin in 4p mode, 2 packs.", "GBP").includes("2 packs"), true);
});

test("a prototype name is not a country", () => {
  assert.equal(isKnownCountry("constructor"), false);
  assert.equal(localFor("constructor").known, false);
});

test("every scale reduces to the same floor, and German grades run backwards", () => {
  assert.equal(ratingShare(3, "stars-5"), 0.6);
  assert.equal(ratingShare(6, "out-of-10"), 0.6);
  assert.equal(ratingShare(60, "percent"), 0.6);
  assert.equal(ratingShare(3, "de-grade"), 0.6, "grade 3.0 sits where 3 stars sits");
  assert.equal(ratingShare(1, "de-grade"), 1, "grade 1.0 is the best");
  assert.ok(ratingShare(3.1, "de-grade") < RATING_FLOOR);
  assert.ok(ratingShare(2.9, "stars-5") < RATING_FLOOR);
  assert.ok(!inRange(0.5, "de-grade"));
  assert.ok(!inRange(5.5, "stars-5"));
});

test("a rating reads as its source gave it", () => {
  assert.equal(ratingLabel({ score: 4.4, scale: "stars-5", count: 1253 }), "4.4 of 5 from 1,253 ratings");
  assert.equal(ratingLabel({ score: 75, scale: "percent", publisher: "Which?" }), "Which? 75%");
  assert.equal(ratingLabel({ score: 1.5, scale: "de-grade", publisher: "Stiftung Warentest" }), "Stiftung Warentest grade 1.5");
});
