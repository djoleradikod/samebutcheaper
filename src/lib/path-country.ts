import "server-only";
import { cache } from "react";
import type { PrefixedCountry } from "./country-url";

/**
 * The country a prefixed page (/de/..., see country-url.ts) renders for, for the length of one render.
 *
 * The page under src/app/country/[country] sets it before it renders anything, and every CountryPart below it reads
 * it: with a country set, a CountryPart renders that country's view straight into the static HTML instead of waiting
 * for the request's cookie. So the home page, aisles and hubs get a prefixed form without their files knowing about it.
 * React's cache() is scoped to one render, so two pages rendering at once never see each other's country.
 */
const slot = cache((): { country: PrefixedCountry | null } => ({ country: null }));

export function setPathCountry(country: PrefixedCountry) {
  slot().country = country;
}

/** The prefixed page's country, or null on an unprefixed page. */
export function getPathCountry(): PrefixedCountry | null {
  return slot().country;
}
