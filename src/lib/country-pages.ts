/**
 * Which country views of which pages exist and are indexable, over the whole catalogue. Pure: it takes the catalogue's
 * lists, so scripts/tests/country-urls.test.ts checks the rule against every record. The pages call it through
 * seo-catalog.ts. The rule itself is in seo.ts (recordVersions, hubVersions, headRules) and docs/country-urls.md.
 */
import { CATEGORIES, CATEGORY_MAP } from "./categories";
import { PREFIXED_COUNTRIES, withCountry, type PrefixedCountry } from "./country-url";
import { forCountry, localFor } from "./localize";
import { alternateLanguages, headMetadata, headRules, hubVersions, indexableUrls, recordVersions, type Versions } from "./seo";
import type { Bundle, CategorySlug, Pair, Preset } from "./types";

export type CatalogLists = { pairs: readonly Pair[]; bundles: readonly Bundle[]; presets: readonly Preset[] };
export type RecordSection = "compare" | "bundle" | "basket";

/** Hubs with a prefixed form that list the whole catalogue: every country's view of them is indexable. */
export const HUB_PATHS = ["/", "/biggest-savings", "/bundles"] as const;

/**
 * Tools with a translated form only (LANGUAGE_PAGES in country-url.ts) that are worth a search result: the English page
 * and the German one. /my-list and /search are noindex in every form, so they have no versions.
 */
export const INDEXED_LANGUAGE_PAGES = ["/check", "/check/list"] as const;

/**
 * A translated tool's versions: /de's German one, and the unprefixed English page as the x-default (it serves every
 * other country, as a hub's unprefixed page does).
 */
export function languagePageVersions(path: string): Versions | null {
  if (!(INDEXED_LANGUAGE_PAGES as readonly string[]).includes(path)) return null;
  return { languages: { "de-DE": withCountry(path, "DE") }, xDefault: path };
}

function recordsOf(c: CatalogLists, section: RecordSection): readonly (Pair | Bundle | Preset)[] {
  return section === "compare" ? c.pairs : section === "bundle" ? c.bundles : c.presets;
}

function recordOf(c: CatalogLists, section: RecordSection, slug: string) {
  return recordsOf(c, section).find((r) => r.slug === slug);
}

/** A record page's versions (see recordVersions in seo.ts). A swap's twin joins its own. */
export function recordPageVersions(c: CatalogLists, section: RecordSection, slug: string): Versions | null {
  const record = recordOf(c, section, slug);
  if (!record) return null;
  const twinRef = section === "compare" ? (record as Pair).twin : null;
  const twin = twinRef ? (c.pairs.find((p) => p.slug === twinRef.slug) ?? null) : null;
  return recordVersions(section, record, twin);
}

/** The countries whose aisle page lists at least one swap. An aisle with none anywhere is noindex in every form. */
export function aisleCountries(c: CatalogLists, slug: CategorySlug): PrefixedCountry[] {
  const pairs = c.pairs.filter((p) => p.category === slug);
  return PREFIXED_COUNTRIES.filter((country) => forCountry(pairs, localFor(country)).length > 0);
}

/** A hub's versions, or null for a path that isn't one, or an aisle no country lists anything in. */
export function hubPageVersions(c: CatalogLists, path: string): Versions | null {
  if ((HUB_PATHS as readonly string[]).includes(path)) return hubVersions(path);
  const slug = /^\/category\/([^/]+)$/.exec(path)?.[1];
  if (slug && Object.hasOwn(CATEGORY_MAP, slug)) {
    const countries = aisleCountries(c, slug as CategorySlug);
    return countries.length ? hubVersions(path, countries) : null;
  }
  return null;
}

/** Any page's versions: a record's or a hub's. Null when the page has no indexable form at all. */
export function pageVersions(c: CatalogLists, path: string): Versions | null {
  const record = /^\/(compare|bundle|basket)\/([^/]+)$/.exec(path);
  if (record) return recordPageVersions(c, record[1] as RecordSection, record[2]);
  return languagePageVersions(path) ?? hubPageVersions(c, path);
}

/** The head rules for one form of a page with a prefixed form: its unprefixed URL (country null) or one country's. */
export function countryHeadRules(c: CatalogLists, path: string, country: PrefixedCountry | null) {
  const versions = pageVersions(c, path);
  if (!versions) return null;
  const self = withCountry(path, country);
  const record = /^\/(compare|bundle|basket)\/([^/]+)$/.exec(path);
  const own = record ? recordOf(c, record[1] as RecordSection, record[2]) : undefined;
  return headRules(versions, self, own ? withCountry(path, own.market) : undefined);
}

/** As Next metadata. Null for a page whose every form is noindex (an empty aisle), which keeps its own metadata. */
export function countryHead(c: CatalogLists, path: string, country: PrefixedCountry | null) {
  const rules = countryHeadRules(c, path, country);
  return rules ? headMetadata(rules) : null;
}

/** Slugs to prerender under a country's prefix: exactly its indexable views. Any other view renders when first asked for. */
export function prefixedSlugs(c: CatalogLists, section: RecordSection | "category", country: PrefixedCountry): string[] {
  if (section === "category") return CATEGORIES.filter((cat) => aisleCountries(c, cat.slug).includes(country)).map((cat) => cat.slug);
  const local = localFor(country);
  return recordsOf(c, section)
    .filter((r) => local.shows(r))
    .map((r) => r.slug);
}

/**
 * The sitemap's entries for pages with country URLs: every indexable URL once (a swap and its twin share their versions),
 * with all its versions as alternates, and the unprefixed page whose versions they are (for its date). src/app/sitemap.ts
 * adds dates and the rest of the site.
 */
export function countrySitemap(c: CatalogLists): { path: string; url: string; languages: Record<string, string> }[] {
  const seen = new Set<string>();
  return allCountryPages(c).flatMap(({ path, versions }) => {
    const languages = alternateLanguages(versions);
    return indexableUrls(versions)
      .filter((u) => !seen.has(u) && seen.add(u))
      .map((url) => ({ path, url, languages }));
  });
}

/** Every page with a prefixed form that has an indexable form, with its versions: for the sitemap and the tests. */
export function allCountryPages(c: CatalogLists): { path: string; versions: Versions }[] {
  const paths = [
    ...HUB_PATHS,
    ...INDEXED_LANGUAGE_PAGES,
    ...CATEGORIES.map((cat) => `/category/${cat.slug}`),
    ...c.pairs.map((p) => `/compare/${p.slug}`),
    ...c.bundles.map((b) => `/bundle/${b.slug}`),
    ...c.presets.map((p) => `/basket/${p.slug}`),
  ];
  return paths.flatMap((path) => {
    const versions = pageVersions(c, path);
    return versions ? [{ path, versions }] : [];
  });
}
