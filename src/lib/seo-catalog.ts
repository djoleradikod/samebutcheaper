import "server-only";
import { getAllBundles, getAllPairs, getAllPresets } from "./catalog";
import * as pages from "./country-pages";
import type { PrefixedCountry } from "./country-url";
import { swapTitles } from "./seo";
import { SITE } from "./site";

let titles: Map<string, string> | undefined;

/** The swap's title, unique across the catalogue (see swapTitles). Worked out once per server. */
export function swapTitleFor(slug: string) {
  titles ??= swapTitles(getAllPairs());
  return titles.get(slug);
}

/* ---------------------------------- country URLs over this catalogue (the rule is in seo.ts, see country-pages.ts) */

const lists = (): pages.CatalogLists => ({ pairs: getAllPairs(), bundles: getAllBundles(), presets: getAllPresets() });

/** The head (canonical, hreflang, noindex) for a page with a prefixed form, unprefixed (null) or in one country's view. */
export function countryHead(path: string, country: PrefixedCountry | null) {
  return pages.countryHead(lists(), path, country);
}

/**
 * The home page's head, unprefixed (null) or one country's. The layout's alternates also name the feed, and a page's
 * alternates replace the layout's whole, so the feed is named again here.
 */
export function homeHead(country: PrefixedCountry | null) {
  const head = countryHead("/", country);
  return {
    ...head,
    alternates: { ...head?.alternates, types: { "application/atom+xml": [{ url: "/feed.xml", title: `${SITE.name}: newest price checks` }] } },
  };
}

/** A page's versions (its indexable country URLs), or null when it has none. */
export function pageVersionsFor(path: string) {
  return pages.pageVersions(lists(), path);
}

export function prefixedSlugs(section: pages.RecordSection | "category", country: PrefixedCountry) {
  return pages.prefixedSlugs(lists(), section, country);
}

export function countrySitemap() {
  return pages.countrySitemap(lists());
}
