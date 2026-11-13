/**
 * Country URLs (/us, /uk, /de, /ca, /ie): the path helpers, the proxy's routing, and the canonical / noindex / hreflang
 * rule over the whole catalogue, including that the sitemap lists exactly the indexable set. See docs/country-urls.md.
 * Needs `npm run catalog` first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { allCountryPages, countryHeadRules, countrySitemap, prefixedSlugs, type CatalogLists } from "../../src/lib/country-pages";
import {
  countryForPrefix,
  countryOfPath,
  hrefOnPage,
  internalPath,
  isPrefixable,
  PREFIXED_COUNTRIES,
  prefixFor,
  readPath,
  switchCountryPath,
  withCountry,
} from "../../src/lib/country-url";
import { localFor } from "../../src/lib/localize";
import { langOfPath } from "../../src/lib/i18n/lang";
import { alternateLanguages, headRules, indexableUrls } from "../../src/lib/seo";
import type { Catalog } from "../../src/lib/types";
import { countryRoute } from "../../src/proxy";

const catalog = catalogJson as unknown as Catalog;
const lists: CatalogLists = { pairs: catalog.pairs, bundles: catalog.bundles ?? [], presets: catalog.presets ?? [] };
const pages = allCountryPages(lists);

/* ------------------------------------------------------------------ path helpers */

test("prefixes are the five markets, with uk for GB", () => {
  assert.deepEqual([...PREFIXED_COUNTRIES].sort(), ["CA", "DE", "GB", "IE", "US"]);
  assert.equal(prefixFor("GB"), "uk");
  assert.equal(prefixFor("gb"), "uk");
  assert.equal(prefixFor("FR"), null);
  assert.equal(prefixFor(null), null);
  assert.equal(countryForPrefix("uk"), "GB");
  assert.equal(countryForPrefix("gb"), null);
  assert.equal(countryForPrefix("toString"), null);
  assert.equal(countryForPrefix(undefined), null);
});

test("withCountry prefixes only pages that have a prefixed form", () => {
  assert.equal(withCountry("/", "DE"), "/de");
  assert.equal(withCountry("/compare/a-vs-b", "GB"), "/uk/compare/a-vs-b");
  assert.equal(withCountry("/compare/a-vs-b?x=1#prices", "US"), "/us/compare/a-vs-b?x=1#prices");
  assert.equal(withCountry("/bundles", "CA"), "/ca/bundles");
  assert.equal(withCountry("/category/pet", "IE"), "/ie/category/pet");
  assert.equal(withCountry("/brands", "DE"), "/brands");
  assert.equal(withCountry("/brand/claritin", "DE"), "/brand/claritin");
  assert.equal(withCountry("/compare", "DE"), "/compare");
  assert.equal(withCountry("/compare/a/b", "DE"), "/compare/a/b");
  assert.equal(withCountry("/compare/a", "HR"), "/compare/a");
  assert.equal(withCountry("/compare/a", null), "/compare/a");
  assert.ok(isPrefixable("/biggest-savings/"));
  assert.ok(!isPrefixable("https://example.com/compare/a"));
});

test("readPath reads public and internal paths the same way", () => {
  assert.deepEqual(readPath("/de/compare/x"), { country: "DE", rest: "/compare/x" });
  assert.deepEqual(readPath("/country/de/compare/x"), { country: "DE", rest: "/compare/x" });
  assert.deepEqual(readPath("/uk"), { country: "GB", rest: "/" });
  assert.deepEqual(readPath("/uk/"), { country: "GB", rest: "/" });
  assert.deepEqual(readPath("/compare/x"), { country: null, rest: "/compare/x" });
  assert.deepEqual(readPath("/deals"), { country: null, rest: "/deals" });
  assert.equal(countryOfPath("/country/ie"), "IE");
  assert.equal(countryOfPath(null), null);
  assert.equal(internalPath("/de/compare/x"), "/country/de/compare/x");
  assert.equal(internalPath("/us"), "/country/us");
  assert.equal(internalPath("/compare/x"), null);
});

test("the switcher keeps the page and changes the prefix", () => {
  assert.equal(switchCountryPath("/de/compare/x", "GB"), "/uk/compare/x");
  assert.equal(switchCountryPath("/country/de/compare/x", "US", "?a=1"), "/us/compare/x?a=1");
  assert.equal(switchCountryPath("/uk", "DE"), "/de");
  // A country with no prefix goes to the unprefixed page, whose view follows the cookie the switcher sets.
  assert.equal(switchCountryPath("/de/category/pet", "FR"), "/category/pet");
  // On an unprefixed page the switcher only sets the cookie, as before.
  assert.equal(switchCountryPath("/compare/x", "DE"), null);
});

test("links on a prefixed page stay in the prefix, and only those with a prefixed form", () => {
  assert.equal(hrefOnPage("/compare/x", "DE"), "/de/compare/x");
  assert.equal(hrefOnPage("/", "GB"), "/uk");
  assert.equal(hrefOnPage("/brands", "DE"), "/brands");
  assert.equal(hrefOnPage("/us/compare/x", "DE"), "/us/compare/x");
  assert.equal(hrefOnPage("#prices", "DE"), "#prices");
  assert.equal(hrefOnPage("//cdn.example/x", "DE"), "//cdn.example/x");
  assert.equal(hrefOnPage("/compare/x", null), "/compare/x");
});

test("the proxy routes prefixed paths and 404s the rest", () => {
  const swap = catalog.pairs[0].slug;
  assert.deepEqual(countryRoute(`/de/compare/${swap}`), { country: "DE", internal: `/country/de/compare/${swap}` });
  assert.deepEqual(countryRoute("/uk"), { country: "GB", internal: "/country/uk" });
  assert.deepEqual(countryRoute("/ca/biggest-savings"), { country: "CA", internal: "/country/ca/biggest-savings" });
  assert.equal(countryRoute("/de/compare/not-a-swap"), "missing");
  assert.equal(countryRoute("/de/brands"), "missing");
  assert.equal(countryRoute("/de/compare"), "missing");
  assert.equal(countryRoute("/country/de/compare/x"), "missing");
  assert.equal(countryRoute("/country"), "missing");
  assert.equal(countryRoute(`/compare/${swap}`), null);
  assert.equal(countryRoute("/brands"), null);
  assert.equal(countryRoute("/"), null);
});

/* ------------------------------------------------- the rule over the whole catalogue */

const recordPages = pages.filter((p) => /^\/(compare|bundle|basket)\//.test(p.path));

test("every swap, kit and basket has an indexable view in its own market", () => {
  assert.equal(recordPages.length, lists.pairs.length + lists.bundles.length + lists.presets.length);
  for (const r of [...lists.pairs.map((p) => ["compare", p] as const), ...lists.bundles.map((b) => ["bundle", b] as const), ...lists.presets.map((p) => ["basket", p] as const)]) {
    const [section, record] = r;
    const own = withCountry(`/${section}/${record.slug}`, record.market);
    const rules = countryHeadRules(lists, `/${section}/${record.slug}`, record.market);
    assert.equal(rules?.canonical, own, record.slug);
    assert.equal(rules?.index, true);
  }
});

test("every indexable URL has a self canonical, and every other country view is noindex with no canonical", () => {
  for (const { path, versions } of pages) {
    const indexable = indexableUrls(versions);
    for (const country of PREFIXED_COUNTRIES) {
      const self = withCountry(path, country);
      const rules = countryHeadRules(lists, path, country)!;
      if (indexable.includes(self)) {
        assert.equal(rules.canonical, self, self);
        assert.equal(rules.index, true, self);
      } else {
        assert.equal(rules.index, false, self);
        assert.equal(rules.canonical, null, self);
        assert.equal(rules.languages, null, self);
      }
    }
    const plain = countryHeadRules(lists, path, null)!;
    assert.equal(plain.index, true, path);
    if (/^\/(compare|bundle|basket)\//.test(path)) {
      // A record's unprefixed URL shows its own view, so it points there and isn't one of the versions.
      assert.ok(!indexable.includes(path), path);
      assert.ok(plain.canonical && countryOfPath(plain.canonical), path);
      assert.equal(plain.languages, null);
    } else {
      assert.equal(plain.canonical, path);
      assert.equal(versions.xDefault, path);
    }
  }
});

test("a country's view is indexable exactly when that country lists the record", () => {
  for (const p of lists.pairs) {
    const twin = p.twin ? lists.pairs.find((x) => x.slug === p.twin!.slug) : undefined;
    for (const country of PREFIXED_COUNTRIES) {
      const self = withCountry(`/compare/${p.slug}`, country);
      const rules = countryHeadRules(lists, `/compare/${p.slug}`, country)!;
      assert.equal(rules.index, localFor(country).shows(p), `${self}`);
      // A country lists at most one of two twins, so one hreflang per country is never ambiguous.
      if (twin) assert.ok(!(localFor(country).shows(p) && localFor(country).shows(twin)), self);
    }
  }
});

test("hreflang is reciprocal: every indexable URL names the same set, itself included", () => {
  const byUrl = new Map<string, Record<string, string>>();
  for (const { versions } of pages) {
    const langs = alternateLanguages(versions);
    for (const u of indexableUrls(versions)) {
      const rules = headRules(versions, u);
      assert.deepEqual(rules.languages, langs, u);
      const before = byUrl.get(u);
      if (before) assert.deepEqual(before, langs, `${u} is in two groups`);
      byUrl.set(u, langs);
      assert.ok(Object.values(langs).includes(u), `${u} names itself`);
    }
  }
  for (const [u, langs] of byUrl) {
    for (const [lang, other] of Object.entries(langs)) {
      assert.ok(byUrl.has(other), `${u} names ${other} (${lang}), which isn't indexable`);
      assert.deepEqual(byUrl.get(other), langs, `${other} doesn't name the same set as ${u}`);
    }
    // One URL per region, and the region is the URL's own country.
    for (const [lang, other] of Object.entries(langs)) {
      if (lang === "x-default") continue;
      assert.equal(`${langOfPath(other)}-${countryOfPath(other)}`, lang, other);
    }
  }
});

test("only indexable views are prerendered, and every one of them is", () => {
  const prerendered = new Set<string>();
  for (const country of PREFIXED_COUNTRIES) {
    for (const section of ["compare", "bundle", "basket", "category"] as const) {
      for (const slug of prefixedSlugs(lists, section, country)) prerendered.add(withCountry(`/${section}/${slug}`, country));
    }
  }
  const indexable = new Set(pages.flatMap((p) => indexableUrls(p.versions)).filter((u) => countryOfPath(u) && /\/(compare|bundle|basket|category)\//.test(u)));
  assert.deepEqual([...prerendered].sort(), [...indexable].sort());
});

test("the sitemap lists exactly the indexable set, each URL once, with the same alternates as its head", () => {
  // src/app/sitemap.ts takes these entries as they are and adds dates (its own output is checked in scripts/tests/e2e.ts).
  const entries = countrySitemap(lists);
  const listed = entries.map((e) => e.url);
  assert.equal(new Set(listed).size, listed.length, "a URL is listed twice");
  const expected = new Set(pages.flatMap((p) => indexableUrls(p.versions)));
  assert.deepEqual(new Set(listed), expected);
  for (const e of entries) {
    const head = countryHeadRules(lists, readPath(e.url).rest, countryOfPath(e.url))!;
    assert.equal(head.canonical, e.url);
    assert.deepEqual(head.languages, e.languages, e.url);
  }
  // No record's unprefixed URL, no noindex view.
  for (const p of lists.pairs) assert.ok(!expected.has(`/compare/${p.slug}`));
  for (const u of listed) assert.notEqual(countryHeadRules(lists, readPath(u).rest, countryOfPath(u))?.index, false, u);
  // Every hub, every non-empty aisle and every record has at least one listed URL.
  assert.ok(listed.includes("/") && listed.includes("/de") && listed.includes("/uk/biggest-savings") && listed.includes("/bundles"));
});
