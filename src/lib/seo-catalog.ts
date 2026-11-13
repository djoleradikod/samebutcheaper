import "server-only";
import { getAllBundles, getAllPairs, getAllPresets } from "./catalog";
import * as pages from "./country-pages";
import type { PrefixedCountry } from "./country-url";
import { swapDescription, swapDescriptionsDe, swapTitles } from "./seo";
import { SITE } from "./site";
import { langForCountry, type Lang } from "./i18n/lang";
import { getT } from "./i18n";

const titles = new Map<Lang, Map<string, string>>();

/** The swap's title in a language, unique across the catalogue in that language (see swapTitles). Worked out once per server. */
export function swapTitleFor(slug: string, lang: Lang = "en") {
  if (!titles.has(lang)) titles.set(lang, swapTitles(getAllPairs(), lang));
  return titles.get(lang)!.get(slug);
}

let descriptionsDe: Map<string, string> | null = null;

/** The swap's description in a language; German ones are unique across the catalogue (see swapDescriptionsDe). */
export function swapDescriptionFor(slug: string, lang: Lang = "en") {
  const pair = getAllPairs().find((p) => p.slug === slug);
  if (!pair) return undefined;
  if (lang === "en") return swapDescription(pair);
  descriptionsDe ??= swapDescriptionsDe(getAllPairs());
  return descriptionsDe.get(slug);
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
  const lang = langForCountry(country);
  const t = getT(lang);
  const own = lang === "en" ? {} : { title: { absolute: t("home.metaTitle") }, description: t("home.metaDescription") };
  return {
    ...own,
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
