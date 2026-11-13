# Country URLs and content in the first HTML

Built 13 Nov 2026, from proposals 1 and 2 of `docs/seo-audit.md`. This is the design, the rule for search engines and
what it cost.

## What changed for a reader

- **`/us/...`, `/uk/...`, `/de/...`, `/ca/...`, `/ie/...`** are real pages: the home page, swaps (`/de/compare/<slug>`),
  kits (`/de/bundle/<slug>`), baskets (`/de/basket/<slug>`), aisles (`/de/category/<slug>`), `/de/biggest-savings` and
  `/de/bundles`. Each shows that country's view with no cookie: prices in its currency, only what that country lists
  (`localFor(country).shows`), only stores that sell there. It is prerendered, so the whole view is in the first HTML.
- **Unprefixed URLs work exactly as before**: the view follows the `sbc_country` cookie, a crawler gets the view of a
  visitor we can't place, nothing redirects. Only their canonical changed (see the rule below).
- **The swap page's argument is in the first HTML of the unprefixed URL too.** Title, verdict, match and evidence
  labels, why it's the same, where the brand wins, the same-or-different table, sources, photo credits and the questions
  are static. What names a price or a store (the shelf, the offers, the yearly saving, "for the same amount", the table's
  price row, bulk, where to buy, related swaps) is in a `RecordPart`, whose stand-in is the record's own view: its own
  market's prices and stores, nothing converted. The shopper's view replaces it in the same place and shape, so nothing
  jumps; a crawler or a reader without JavaScript reads the record's own view. Kit and basket pages are prices nearly
  throughout, so each body is one `RecordPart` with the same kind of stand-in.
- The footer links each country's home page ("Prices by country"), so a crawler, which arrives with no country, reaches
  every prefixed page by links.
- Each swap, kit and basket page links its own country versions ("Prices by country:", the same set as its hreflang),
  in the static HTML. An aisle shows one swap per product group, so some records are linked only from brand, ingredient
  or dupe pages, which have no prefix; without these links their prefixed (sitemap) URL was reachable only through the
  canonical. A record with one version has no row (since 13 Nov 2026): a shopper has nothing to choose between, and that
  one URL is still its canonical and in the sitemap.
- On a prefixed page, every link to a page that has a prefixed form stays in the prefix, and the country switcher goes
  to the same page under the new prefix (or the unprefixed page, for a country without one; the choice is also saved).

## How it is built

| Piece | File |
|---|---|
| Prefixes, path helpers (`withCountry`, `readPath`, `switchCountryPath`, `hrefOnPage`) | `src/lib/country-url.ts` |
| Proxy: rewrite `/de/x` to `/country/de/x`, 404 for unknown pages and for `/country/...` itself | `src/proxy.ts` (`countryRoute`) |
| The prefixed routes, thin wrappers over the normal pages | `src/app/country/[country]/**` |
| The URL's country for every `CountryPart` on a page (React `cache`, one render) | `src/lib/path-country.ts`, `src/app/country/[country]/country-page.ts` |
| `CountryPart` renders a prefixed page's country statically; `RecordPart` (record's own view as stand-in) | `src/components/ForCountry.tsx` |
| The URL's country for client components (`FixedContext`: the cookie is not read) | `src/lib/client/country.ts`, `src/components/CountryProvider.tsx`, `src/app/country/[country]/layout.tsx` |
| Links that stay in the prefix | `src/components/CountryLink.tsx` (a drop-in for `next/link`) |
| Switcher | `src/components/CountryPicker.tsx` |
| Footer country index, a record's version links | `src/components/CountryIndex.tsx` (`CountryIndex`, `VersionLinks`) |
| The band follows the URL's country (`x-sbc-path-country` from the proxy) | `src/lib/server-country.ts`, `src/app/layout.tsx` |
| The rule: versions, canonical, noindex, hreflang | `src/lib/seo.ts` (`recordVersions`, `hubVersions`, `headRules`) |
| The rule over the catalogue, static params, sitemap entries | `src/lib/country-pages.ts` (pure), `src/lib/seo-catalog.ts` |
| Swap, kit and basket pages, shared by both URLs | `src/app/compare/[slug]/SwapView.tsx`, `src/app/bundle/[slug]/KitView.tsx`, `src/app/basket/[slug]/BasketView.tsx` |

### Why a rewrite and not a `[country]` folder at the root

The Next docs' i18n pattern moves every route under `app/[lang]`. Here that would move every page (and every other
engineer's work) and make `[country]` catch every unknown top-level path. Those pages stream, so they can't answer 404
once rendering starts, and `/anything` would become a soft 404. Instead the prefixed pages live in
`src/app/country/[country]`, and `src/proxy.ts` rewrites only the five known prefixes there, after checking the rest of
the path is a page with a prefixed form and a slug in the catalogue. Anything else stays a real 404.

Next 16.4 sends a proxy rewrite back through the proxy with the internal path. The proxy marks its own rewrite with a
header holding a random value made when the server starts, lets that one through, and answers 404 to any other request
for `/country/...`, so each view has exactly one public URL. `robots.txt` also closes `/country/`.

### Why the pages need no change of their own

The prefixed home, aisle, biggest-savings and bundles routes import the unprefixed page and render it. Before that,
`pageCountry()` puts the URL's country into a per-render slot (`src/lib/path-country.ts`), and every `CountryPart`
reads it: with a country there, it renders that country's view directly, with no `Suspense` and no cookie, so it is
static. The `[country]` layout wraps the page in a `CountryProvider` marked `fixed`, so every client component (`Money`,
`useLocal`, `CountryLink`) uses the URL's country and never the cookie. A new page type gets a prefixed form by adding a
wrapper under `src/app/country/[country]` and its section to `PREFIXED_SECTIONS`.

### Links

`CountryLink` is `next/link` with the prefix applied. Inside a fixed country (a prefixed page) the country comes from
the provider, so the href is in the static HTML. In the header and footer, which are in the root layout and outside any
page's provider, it reads the path with `usePathname`: known at build time for every prerendered page. A view rendered on
demand (a noindex one) can't read its path until the request, so there those links start unprefixed and are corrected
when its part streams in. A link to a page with no prefixed form (`/my-list`, `/brands`) needs none of this and is a
plain link.

What waits for the path is a small Suspense boundary, and it has to stay small: React 19 sends a finished boundary over
500 bytes later in the stream once the shell is large, so a big one starts out unprefixed even on a prerendered page.
That is why the header's logo link is an empty overlay over the logo, and the country picker reads the path only for its
label. `node scripts/ci/quality.mjs` checks the first HTML of a prerendered `/de` page for both.

Every public page and component uses it (the import line is the only change), except `CountryIndex`, whose links are
already prefixed, and the admin pages.

### First visit: links that carry the shopper's country

A shopper who lands on an unprefixed page is not redirected. Once the browser knows their country and it has a prefix
(the proxy sets the `sbc_country` cookie from their location on the first request, or they chose a country), every
`CountryLink` on an unprefixed page points at that country's URL, so whatever they go on to share or bookmark carries the
country (`src/lib/shopper-links.ts`, `src/lib/client/shopper-country.ts`). The rule's guards:

- The server's HTML is unchanged, links as written. The change happens in the browser after hydration, so crawlers
  (which the proxy never gives a cookie, and which `isBotAgent` also catches by user agent in the browser) and readers
  without JavaScript see and follow the unprefixed links, and each page keeps one canonical.
- Only paths with a prefixed form change, to exactly the URL `withCountry` builds, so they land on the same pages the
  switcher and the sitemap use. A view the country doesn't list opens as rule 3 below says (noindex, with its note).
- A shopper who asked to see other countries' swaps (`sbc_others=1`) keeps the unprefixed pages, which can show them.
- The share button shares the page's country URL: the sharer's country's version when that country lists the record,
  else the record's canonical (`shareTarget`).

## The rule (canonical, noindex, hreflang, sitemap)

One rule for every page with a prefixed form:

1. **A country's view is indexable when that country lists the page**: `localFor(country).shows(record)`. The record's
   own market always lists it; another country only when its sellers sell or deliver there. Hubs (home, biggest savings,
   bundles) are listed in every country; an aisle where it has at least one swap that country lists.
2. **An indexable URL has a self canonical** and names every indexable version as `hreflang` (`en-US`, `en-GB`, `en-DE`,
   `en-CA`, `en-IE`) plus `x-default`. All versions name the same set, so hreflang is reciprocal by construction.
3. **A view the country doesn't list** (`/de/compare/<a US-only swap>`) opens normally, says it isn't listed there,
   and is `noindex, follow` with no canonical and no hreflang. A German shopper can open and share it; it is a
   converted copy, and its links still lead somewhere. Google advises against mixing noindex with a canonical that
   points elsewhere, so it has neither.
4. **A swap's twin** (the same swap priced in another market) joins its versions: in each country, the record that
   country lists (localize.ts guarantees at most one). The `x-default` of a record is the own-market URL of the record a
   visitor we can't place is shown (`TWIN_ORDER` in localize.ts).
5. **Unprefixed URLs**: a swap, kit or basket shows a visitor we can't place exactly its own-market view, so its
   unprefixed URL canonicalises to `/<own market>/...` and is not in the sitemap. A hub's unprefixed URL lists one
   record of every swap in its own currency, a page no country URL repeats, so it is the `x-default` and indexable.
6. **The sitemap lists exactly the indexable set**, each URL once, with all its versions as alternates.

`scripts/tests/country-urls.test.ts` checks all of it over the whole catalogue: every record has an indexable own-market
view; every indexable URL has a self canonical and every other country view is noindex with no canonical; a view is
indexable exactly when the country lists the record; hreflang is reciprocal and each region code matches its URL; the
prerendered set equals the indexable set; the sitemap equals the indexable set.

## Numbers

| | Before | After |
|---|---|---|
| Static pages generated by `next build` | 2,204 | 3,102 |
| Prefixed views prerendered (indexable only) | – | swaps 717, kits 45, baskets 37, aisles 56, hubs 15 |
| Sitemap URLs with country forms (hubs, aisles, swaps, kits, baskets) | 548, all unprefixed | 888 (15 aisles + 3 hubs unprefixed, the rest prefixed) |
| `.next/server/app` | 213 MB | 548 MB |
| `.next/standalone` | 299 MB | 636 MB |
| Unprefixed swap page static HTML, example | 28.6 KB | 92 KB |
| Visible text without JavaScript, unprefixed swap, example | about 2,900 characters | about 8,800 |

All 458 swaps times 5 countries would be 2,290 swap pages; prerendering only the indexable views makes it 717. Build
times on the shared 4-core machine are in the hand-over report; they depend heavily on what else is running.

## What a crawl reaches

A crawl of the production build (crawler user agent, no cookie, from `/`, following every `<a href>` in the full
response, as in `docs/seo-audit.md`) reached 2,368 pages, all 200, 1,077 of them prefixed. It reached 1,631 of the
1,632 sitemap URLs by links; the one left is `/check`, which the crawl skips on purpose. Before the version links on
record pages it reached 1,549: 83 prefixed records were linked only through unprefixed brand, ingredient or dupe pages.

## Ready for languages

Nothing here assumes English except `hreflangFor` in `src/lib/seo.ts`, which says `en-<country>`. When German pages
come (proposal 3 in `docs/seo-audit.md`):

- The prefix stays the country (whose prices); language is a second, independent choice. Either `/de/` serves German
  and the English German-price view moves to `/de/en/`, or a language segment is added in front (`/de-de/`, `/en-de/`).
  Both fit `readPath`/`withCountry`: they are the only places that parse or build a prefix.
- `hreflangFor(country)` becomes `hreflangFor(country, language)`; versions gain one entry per language, and the rule
  above is unchanged (a view is indexable where its country lists the record).
- `<html lang>` is set in the root layout; a language segment would set it from the path the way the band reads the
  country (a header from the proxy), or the prefixed tree gets its own root layout through a route group.
- Copy goes through dictionaries keyed by language (the Next i18n guide's `getDictionary`), starting with the page
  chrome, `seo.ts` and `swap-faq.ts`. Record text (`summary`, `differences`) needs German written by a person.

## Left as they were, on purpose

- No redirect of a first visit to its country's prefix. Unprefixed URLs keep working exactly as before, and a redirect
  by location would also need care never to redirect a crawler. Links carry the country instead (see "First visit").
- Pages without a prefixed form (generic-for, brand, ingredient, `/why`, prose) are one URL for everyone, as before.
