/**
 * Links that carry the shopper's country (docs/country-urls.md, "First visit").
 *
 * A shopper who lands on an unprefixed page (/compare/x) is not redirected. But once the browser knows their country
 * and it has a prefix (the proxy sets the cookie from their location on the first request, or they chose it), every
 * internal link they follow goes to that country's URL (/de/compare/y), so what they share or bookmark from then on
 * carries the country. The server's HTML never changes: crawlers, who get no cookie, and visitors without JavaScript
 * read and follow the links as written. Someone who asked to see other countries' swaps keeps the unprefixed pages,
 * which can show them; a prefixed page can't.
 *
 * Pure, for CountryLink, the share buttons and tests.
 */
import { isBotAgent } from "./bot";
import { isPrefixedCountry, type PrefixedCountry } from "./country-url";

/** The country whose prefix this browser's links should carry on an unprefixed page, or null to leave them as written. */
export function shopperPrefixCountry(cookie: string, userAgent: string): PrefixedCountry | null {
  if (isBotAgent(userAgent)) return null;
  if (/(?:^|;\s*)sbc_others=1(?:;|$)/.test(cookie)) return null;
  const m = /(?:^|;\s*)sbc_country=([A-Z]{2})(?:;|$)/.exec(cookie);
  const country = m?.[1] ?? null;
  return isPrefixedCountry(country) ? country : null;
}

/**
 * Where a share button sends people for a record: the shopper's own country's URL when that country lists the record
 * (one of `versions`, keyed by country), else the record's canonical URL. `versions` and `canonical` come from the
 * record's hreflang set (src/lib/seo-catalog.ts pageVersionsFor), so a shared link is always an indexable page.
 */
export function shareTarget(versions: Partial<Record<string, string>>, canonical: string, country: string | null) {
  return (country && versions[country]) || canonical;
}
