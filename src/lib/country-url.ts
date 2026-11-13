/**
 * Country URLs: /us/..., /uk/..., /de/..., /ca/..., /ie/...
 *
 * Design (the full write-up, with the reasons, is docs/country-urls.md):
 *
 * - A prefixed URL shows one country's view, with no cookie: that country's currency, only what `localFor(country).shows`
 *   lists there, and only stores that sell there. It is rendered at build time, so the whole view is in the first HTML.
 * - Unprefixed URLs work exactly as before: the view follows the `sbc_country` cookie, and a crawler gets the view of a
 *   visitor we can't place. No link breaks and nothing redirects.
 * - Only some page types have a prefixed form (PREFIXED_SECTIONS below): home, swaps, kits, baskets, aisles, biggest
 *   savings and the bundles hub. Everything else (brands, ingredients, generic-for, prose) is one URL for everyone.
 * - The prefixed pages live in src/app/country/[country]/..., and src/proxy.ts rewrites /de/compare/x to
 *   /country/de/compare/x. A request for /country/... itself answers 404, so each view has exactly one public URL. The
 *   rewrite (not a [country] folder at the root) is what keeps /anything-else a real 404 instead of a page that streams.
 * - The path segment is the country as people write it in a URL ("uk"), the rest of the code keeps ISO codes ("GB").
 *   A later language wave can add a language after it (/de/de/...) or map a prefix to a language; nothing here assumes
 *   the page is English beyond `hreflang` in seo.ts.
 *
 * Pure, and shared by the proxy, server components and client components, so it imports nothing.
 */

/** The URL prefix for each country that has one. Order is the order the footer lists them in. */
export const COUNTRY_PREFIXES = { us: "US", uk: "GB", de: "DE", ca: "CA", ie: "IE" } as const;
export type CountryPrefix = keyof typeof COUNTRY_PREFIXES;
export type PrefixedCountry = (typeof COUNTRY_PREFIXES)[CountryPrefix];

export const PREFIXES = Object.keys(COUNTRY_PREFIXES) as CountryPrefix[];
export const PREFIXED_COUNTRIES = PREFIXES.map((p) => COUNTRY_PREFIXES[p]);

/** Where the prefixed pages are in src/app. Only src/proxy.ts sends requests there; it is never a public URL. */
export const INTERNAL_ROOT = "/country";

/** "us" for US, "uk" for GB. Null for a country with no prefix of its own (it uses unprefixed URLs and the cookie). */
export function prefixFor(country: string | null | undefined): CountryPrefix | null {
  if (!country) return null;
  const hit = PREFIXES.find((p) => COUNTRY_PREFIXES[p] === country.toUpperCase());
  return hit ?? null;
}

/** "GB" for "uk". Null for anything else, including "gb": the URL says uk, as people do. */
export function countryForPrefix(prefix: string | null | undefined): PrefixedCountry | null {
  if (!prefix || !Object.hasOwn(COUNTRY_PREFIXES, prefix)) return null;
  return COUNTRY_PREFIXES[prefix as CountryPrefix];
}

export function isPrefixedCountry(country: string | null | undefined): country is PrefixedCountry {
  return prefixFor(country) !== null;
}

/** First path sections that have a prefixed form, and whether they take a slug after them. "" is the home page. */
export const PREFIXED_SECTIONS: Record<string, "page" | "slug"> = {
  "": "page",
  "biggest-savings": "page",
  bundles: "page",
  compare: "slug",
  bundle: "slug",
  basket: "slug",
  category: "slug",
};

function splitPath(path: string) {
  const [pathname, rest = ""] = splitOnce(path, /[?#]/);
  return { pathname, rest };
}

function splitOnce(s: string, at: RegExp): [string, string?] {
  const m = at.exec(s);
  return m ? [s.slice(0, m.index), s.slice(m.index)] : [s];
}

/** Whether an unprefixed path ("/compare/x", "/", "/bundles?x=1") has a prefixed form. */
export function isPrefixable(path: string) {
  const { pathname } = splitPath(path);
  if (!pathname.startsWith("/")) return false;
  const parts = pathname.split("/").slice(1);
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  const kind = PREFIXED_SECTIONS[parts[0] ?? ""];
  if (kind === "page") return parts.length <= 1;
  if (kind === "slug") return parts.length === 2 && parts[1] !== "";
  return false;
}

/**
 * Reads a pathname, public or internal: "/de/compare/x" and "/country/de/compare/x" both give { country: "DE",
 * rest: "/compare/x" }. An unprefixed path gives { country: null, rest: path }.
 */
export function readPath(pathname: string): { country: PrefixedCountry | null; rest: string } {
  const parts = pathname.split("/");
  let at = 1;
  if (`/${parts[1]}` === INTERNAL_ROOT && countryForPrefix(parts[2])) at = 2;
  const country = countryForPrefix(parts[at]);
  if (!country) return { country: null, rest: pathname };
  const rest = `/${parts.slice(at + 1).join("/")}`;
  return { country, rest: rest === "/" || rest === "" ? "/" : rest.replace(/\/$/, "") };
}

/** The country a pathname is prefixed with, or null. */
export function countryOfPath(pathname: string | null | undefined) {
  return pathname ? readPath(pathname).country : null;
}

/**
 * The URL of an unprefixed path in a country's view: ("/compare/x", "DE") gives "/de/compare/x", ("/", "GB") gives "/uk".
 * Paths with no prefixed form, other sites and a country with no prefix come back unchanged.
 */
export function withCountry(path: string, country: string | null | undefined) {
  const prefix = prefixFor(country);
  if (!prefix || !isPrefixable(path)) return path;
  const { pathname, rest } = splitPath(path);
  return `/${prefix}${pathname === "/" ? "" : pathname.replace(/\/$/, "")}${rest}`;
}

/** The internal path src/proxy.ts rewrites a public prefixed path to: "/de/compare/x" gives "/country/de/compare/x". */
export function internalPath(publicPath: string) {
  const { country, rest } = readPath(publicPath);
  if (!country) return null;
  return `${INTERNAL_ROOT}/${prefixFor(country)}${rest === "/" ? "" : rest}`;
}

/**
 * Where the country switcher goes from a prefixed page: the same page under the new prefix, or the unprefixed page when
 * the new country has no prefix (its view then comes from the cookie the switcher also sets). Null on an unprefixed page:
 * there the switcher only sets the cookie, as it always has.
 */
export function switchCountryPath(pathname: string, country: string, search = "") {
  const { country: current, rest } = readPath(pathname);
  if (!current) return null;
  return `${withCountry(rest, country)}${search}`;
}

/** For an inline script that runs before the first paint: sets `pathCountry` to the URL's country ("GB"), or null. */
export const PATH_COUNTRY_SCRIPT = `var pathCountry=(function(){var p=location.pathname.match(/^\\/(${PREFIXES.join("|")})(?:\\/|$)/);return p?${JSON.stringify(COUNTRY_PREFIXES)}[p[1]]:null})();`;

/** How a href reads on a page: prefixed when the page is, and only for paths that have a prefixed form. */
export function hrefOnPage(href: string, pageCountry: string | null) {
  if (!pageCountry || !href.startsWith("/") || href.startsWith("//")) return href;
  if (readPath(href).country) return href;
  return withCountry(href, pageCountry);
}
