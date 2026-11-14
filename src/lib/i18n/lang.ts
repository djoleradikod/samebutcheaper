/**
 * Which language a page is in. A language is a property of the URL (docs/country-urls.md, "Languages"):
 * - /de/... is German. Its prices are Germany's, its words are German.
 * - Every other prefix (/us, /uk, /ca, /ie) and every unprefixed URL is English, exactly as before.
 * - A few unprefixed pages exist only in German (GERMAN_PAGES): /datenschutz, the German privacy page.
 *
 * Pure, and shared by the proxy, server and client code, so it imports nothing but the path reader.
 */
import { readPath } from "../country-url";

export const LANGS = ["en", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** Countries whose prefix serves German. Austria has no prefix of its own, so only Germany. */
const GERMAN_COUNTRIES: ReadonlySet<string> = new Set(["DE"]);

/** Unprefixed pages written only in German. Their first path segment. */
export const GERMAN_PAGES: ReadonlySet<string> = new Set(["datenschutz"]);

/** The language of a prefixed country's pages. Null (no prefix) is English. */
export function langForCountry(country: string | null | undefined): Lang {
  return country && GERMAN_COUNTRIES.has(country.toUpperCase()) ? "de" : "en";
}

/**
 * Sections not translated yet, which stay whole English pages under a German prefix (`<html lang="en">`, hreflang
 * en-DE, English header and footer), never a mix. None since kits, baskets and the tools went German (13 Nov 2026);
 * kept so a new section can start English.
 */
export const ENGLISH_SECTIONS: ReadonlySet<string> = new Set<string>();

/** The language of one section of a country's pages: "/de/compare/x" is German, "/uk/compare/x" English. */
export function langForPage(country: string | null | undefined, section: string): Lang {
  return ENGLISH_SECTIONS.has(section) ? "en" : langForCountry(country);
}

/** The language of a public or internal pathname: "/de/compare/x" and "/country/de/compare/x" are German. */
export function langOfPath(pathname: string | null | undefined): Lang {
  if (!pathname) return "en";
  const { country, rest } = readPath(pathname);
  if (country) return langForPage(country, rest.split("/")[1] ?? "");
  return GERMAN_PAGES.has(rest.split("/")[1] ?? "") ? "de" : "en";
}

/** BCP 47 tag for Intl and `<html lang>`. English keeps the plain tag the site always had. */
export const HTML_LANG: Record<Lang, string> = { en: "en", de: "de" };

/** The locale Intl formats numbers and dates in. */
export const INTL_LOCALE: Record<Lang, string> = { en: "en-GB", de: "de-DE" };

export function isLang(x: unknown): x is Lang {
  return x === "en" || x === "de";
}
