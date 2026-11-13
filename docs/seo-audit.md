# Search and AI findability: audit, 13 Nov 2026

What a crawler gets from each page type, what was wrong, what was fixed in this round and what is left as a proposal.
The site is not live, so nothing here is measured against real search traffic. Every number below comes from a local
production build (`next build`, standalone server) fetched the way a crawler fetches it.

## How this was checked

- **Crawler view.** Each page type fetched with no cookie and a Googlebot user agent, then loaded in Chromium twice:
  with JavaScript off (what a crawler that does not render sees on screen) and on (what Google's renderer sees).
  Recorded: title, meta description, canonical, hreflang, h1, JSON-LD types, visible text with and without JavaScript.
- **Reachability.** A crawler script follows every `<a href>` in the HTML from the home page (the streamed parts
  included, since they are in the same response) and compares what it reached with `sitemap.xml`. Run with no country,
  with each country cookie, and with a CDN geo header (`cf-ipcountry: US`), which is how Googlebot arrives in production.
- **Sources for the structured data decisions:** Google Search Central, read on 13 Nov 2026: product snippet
  documentation (last updated 8 Sep 2026), general structured data guidelines (10 Jul 2026), and the Search Central
  changelog entries of 8 May and 15 Jun 2026 on FAQ rich results.

## The page types before this round

| Page type | Title (example, length incl. " \| SameButCheaper") | Description | Canonical | h1 in first HTML | Body without JS | JSON-LD |
|---|---|---|---|---|---|---|
| Home `/` | "SameButCheaper: same job, lower price" (37) | 180 chars | `/` | yes | hero and FAQ text; lists stream | WebSite, Organization, FAQPage |
| Swap `/compare/*` | "Claritin vs Equate: 88% cheaper" (48) | 141-197, with prices | self | yes | h1 only; everything else streams | BreadcrumbList, Product x2 with Offer |
| Generic for `/dupe/*` | "Generic for Claritin (Loratadine): save up to 88%" (66) | with prices | self | no | nothing | ItemList, FAQPage (streamed) |
| Brand `/brand/*` | "Cheaper alternatives to Claritin: save up to 88%" (65) | 92 chars, says only a count | self | yes | head only | BreadcrumbList, CollectionPage |
| Ingredient `/ingredient/*` | "Loratadine: cheapest products with the same ingredient" (71) | 133 | self | no | nothing | none |
| Aisle `/category/*` | "Cheaper OTC Medicine: 73 swaps" (47) | 200, over length | self | yes | head only | BreadcrumbList, CollectionPage |
| Kit `/bundle/*` | full kit name + saving, up to 103 chars | up to 243, with prices | self | no | nothing | BreadcrumbList (streamed) |
| Basket `/basket/*` | "Home office: the same shop for $171 less" | with prices | self | no | nothing | BreadcrumbList (streamed) |
| Hubs `/biggest-savings`, `/brands`, `/ingredients`, `/bundles` | fine | fine | self | yes | head only | none |
| `/why` | fine | fine | self | yes | nothing | none |
| Prose (`/about`, `/how-we-verify`, ...) | fine | short but fine | self | yes | whole page | none |
| `/search`, `/search?q=` | "Search swaps" | | `/search`, noindex | yes | | |

Other findings:

- **Open Graph images:** kits and baskets had none, so a shared link showed no card.
- **Duplicate titles:** 10 swaps had a title another swap also had, and 42 brand-and-alternative pairs shared the same title shape (8 "Apple vs Anker" swaps, 5
  "Frontline vs PetArmor") with only the percentage apart. Twin swaps (one swap priced in two markets) could collide.
- **hreflang:** none. The 10 twin pairs had no link between them in the head.
- **Sitemap:** no `lastModified`, listed aisles with no swaps (those are noindex), and gave prose pages weekly change.
- **No feed and no llms.txt.**

## Gaps, ranked by expected search impact

1. **Googlebot would have seen half the site.** *Fixed.* Crawlers come from US addresses. Behind a CDN the proxy reads
   the geo header and sets the country to the US, and from then on every list hides UK, German and Irish records and
   every foreign swap page opens with "couldn't confirm you can buy it" and converted "about $" prices. A crawl with
   `cf-ipcountry: US` reached **708 of 1,285** sitemap pages: 235 swaps, 166 generic-for pages, 132 brands, 23 ingredients
   and 20 baskets were unreachable by links. With no country, the "unknown visitor" view lists one record of each swap
   and shows each record in its own currency. Fix: `src/proxy.ts` gives a request whose user agent is a crawler
   (`isBotAgent` in `src/lib/visitor.ts`, the same test the click log uses) no detected country. A crawler with a cookie
   still gets that cookie's country. This is the same page a visitor whose country can't be detected gets, so it is not
   cloaking. After: **1,285 of 1,285** reachable from the home page with a US geo header.
2. **Swap pages: the body needed JavaScript.** *Partly fixed (questions and links), the rest is a proposal below.*
   The whole comparison sits in a `CountryPart`, so in the first HTML it is a hidden `<div hidden id="S:2">` after the
   footer, moved into place by a script. Google renders it. Crawlers that don't (most AI crawlers read raw HTML and drop
   `hidden`) got the h1 and nothing else. Now each swap has, in the static HTML: four questions and answers, and a
   "More on this swap" block of links. Visible text with JavaScript off went from about 2,150 to 2,900-3,350 characters.
3. **No answer to "is X the same as Y" in the page's own words.** *Fixed.* See "Questions on swap pages".
4. **Duplicate and over-long titles; descriptions with prices.** *Fixed.* See "Titles and descriptions".
5. **Nine swaps reachable only by a link that needed a country.** *Fixed.* The unknown-visitor view shows one record of
   each twin, and the other (8 German pet swaps and one Canadian swap) was linked only from the country banner. The
   static "This swap at German prices" link fixes it for every visitor.
6. **Product and Offer markup that doesn't fit the page.** *Removed.* See "Structured data".
7. **hreflang for twins.** *Added*, in the head and in the sitemap.
8. **Hubs with no list markup.** *Added* BreadcrumbList and ItemList on ingredient pages, `/biggest-savings`, `/brands`
   and `/ingredients` (aisles and brands already had them; generic-for pages have ItemList and FAQPage).
9. **Sitemap dates, feed, llms.txt.** *Added.*
10. **Kit and basket share images.** *Added.*

## Questions on swap pages

`src/lib/swap-faq.ts` builds four questions from the record alone; `src/components/SwapQuestions.tsx` shows them and
the FAQPage JSON-LD. The swap page adds one line, `<SwapQuestions record={record} />`.

- **"Is <alternative> the same as <brand>?"** Worded by match type, as `matchSentence` and `/how-we-verify` do:
  - `identical_active`: "has the same active ingredient as ...", the actives that match on the label with their
    strength, the label's definition of the match, and "Inactive ingredients can differ, so read the label if you have
    allergies" when the table has that row.
  - `identical_formula`, `same_manufacturer`: the claim and the label's definition.
  - `equivalent_spec`: "Not the same product, but it does the same job", the definition, and the specs that match.
  - `same_kind`: "We can't say they are", the subcategory, and "What we have doesn't show that they match on what's
    inside or how well they work."
  - Confidence: "Both labels were confirmed from primary sources" or "The evidence is strong, but not every detail came
    from a primary source". `same_kind` has no confidence line, as on the page.
- **"What is different about <alternative>?"** Where the brand wins in the table, then the record's own `differences`
  sentences that are about the product (the page's `sortDifferences` points).
- **"How much cheaper is <alternative> than <brand>?"** Both unit prices, the percentage, the market and the month.
- **"Where can I buy <alternative>?"** The store, if it sells where the shopper is; otherwise that it doesn't deliver
  there, what to look for (`lookForQuery`), the pharmacy note for medicine in Germany, and a pointer to "Buying where you
  live".

Three forms, because the static HTML is shared by every country:

1. **Static (no country):** no price and no store. Sentences that name a price or the record's store are left out.
   This is what a crawler without JavaScript sees on screen.
2. **The shopper's:** their currency ("about £0.05"), their store or what to look for. Replaces the static form.
3. **The record's own:** its market's currency and store, nothing converted. This is what a crawler sees once rendered
   (it has no country) and what a shopper in the record's market sees.

The FAQPage JSON-LD is the record's own form and is emitted only when it is word for word what the page shows, i.e. for
crawlers and for shoppers in the record's market. A shopper seeing converted prices gets the questions without
markup, so the markup never carries a second currency. Tests assert both properties over all 458 swaps.

**Note:** Google stopped showing FAQ rich results on 7 May 2026 and removed the documentation on 15 Jun 2026. The
markup no longer earns a rich result in Google. It is kept because it is valid schema.org, other engines and AI
assistants read it, and the cost is nil. The value is in the visible text, which is in the first HTML.

## Titles and descriptions

All templates are pure functions in `src/lib/seo.ts`, tested in `scripts/tests/seo.test.ts`. Rules: query words first,
about 60 characters before the site name, descriptions up to 155 characters cut at a sentence, **no money amounts**
(the head is the same for every country; a percentage, market and month are true for all of them).

| Page type | Before | After |
|---|---|---|
| Swap | "Claritin vs Equate: 88% cheaper" | "Claritin vs Equate loratadine 10 mg: 88% cheaper"; spec swaps name the kind ("Royal Canin vs Felix wet cat food"); twins add "(German prices)". 458 unique titles; 7 over 60 characters, none cut. |
| Swap description | summary + both unit prices | "Is Felix the same as Royal Canin? Felix does the same job as Royal Canin and costs 72% less per kg at German prices checked Nov 2026." A `same_kind` swap says its records don't show they match inside. |
| Generic for | unchanged title; description with prices | "2 checked generics for Claritin (Loratadine), compared per unit. Equate has the same active ingredient ..." |
| Brand | "N cheaper alternatives to X, each with sources." | names what the swaps are for: "2 cheaper alternatives to Claritin products: allergy, compared per unit with sources." |
| Ingredient | "Loratadine: cheapest products with the same ingredient" (71) | "Cheapest loratadine: brand names vs generics" ("cheaper matches" outside medicine) |
| Aisle | "Cheaper OTC Medicine: 73 swaps", 200-char description | "Cheaper OTC medicine: 73 brand-name swaps", description fitted to 155 |
| Kit | full name with pack details, up to 103 chars | "Momentous Nightly Sleep rebuilt for 85% less" |
| Basket | "Home office: the same shop for $171 less" | "Home office: the same shop for 53% less" |

"Dupe" is not used in any title: the site says it doesn't list scent-alike dupes, and "generic" is used only for
medicines.

## hreflang and canonicals

- Every indexable page has a self-canonical; query URLs (`/search?q=`, `/check?...`) canonicalise to the plain path.
  `?others=` is not a URL parameter at all (it is the `sbc_others` cookie), so no page varies by it.
- Twins: each names itself and its twin as `en-<market>` (the page is English everywhere; the region says whose prices
  it has) and both name the same `x-default`, the record a visitor we can't place is shown (`TWIN_ORDER` in
  `localize.ts`). The same alternates are in the sitemap.
- `/search` is noindex with a self-canonical. Google advises against mixing the two signals, but the canonical points to
  itself, so there is no conflict to resolve. Left as is.

## Structured data

Kept: WebSite with SearchAction, Organization (layout), BreadcrumbList on swaps, kits, baskets, aisles, brands.
Added: FAQPage on swaps; BreadcrumbList + CollectionPage/ItemList on ingredient pages, `/biggest-savings`, `/brands`,
`/ingredients` (static, one record of each swap, names and URLs only).

**Product markup: removed from swap pages, not added anywhere.** The swap page had two `Product` items, each with an
`Offer` (price, currency, store URL). Reasons, from Google's documentation:

- Product rich results "only support pages that focus on a single product (or multiple variants of the same
  product)". A swap page compares two different products, so it is not eligible whatever we mark up.
- Google lists product snippets as being for review and aggregator pages too, but an `Offer` is a statement that the
  product is on sale at that price. Ours are dated snapshots (some over a year old), from stores we don't run, and the
  guidelines ask that markup be current and a true representation of the page.
- Ratings on file are retailers' shopper ratings. Marking them up as our `aggregateRating` would be third-party reviews
  presented as ours, which the review snippet guidelines don't allow.
- Kits and baskets list several products, the same single-product rule applies.

If a single-product page type is ever added (one generic, with our own editorial review), `Product` with `review`
written by us is the markup that fits. Not before.

## Crawl surface

- `sitemap.ts`: every indexable page and nothing else (1,285 URLs, no empty aisle, no noindex page). `lastModified` is
  the newest `price_checked` among the records a page shows; prose pages give no date rather than a made-up one. Twins
  carry hreflang.
- `robots.ts`: everything open to every crawler, AI crawlers included. Closed: `/go/`, `/out`, `/admin`, `/api/`,
  `/newsletter/`, `/page-not-found`, `/check?`, `/my-list?`. Whether to shut out AI *training* crawlers (GPTBot,
  CCBot, Google-Extended) while keeping AI *search* crawlers is the owner's call; today they are all allowed.
- `/feed.xml`: Atom, the 60 most recently price-checked swaps and kits, linked from the home page's head.
- `/llms.txt`: what the site is, coverage figures from the catalogue, where data comes from, what each match label
  promises (from `MATCH_TYPE_META`, so it can't drift), page types with a live example each, main pages, aisles.

## Internal links and orphans

- Every swap page now links, in the static HTML: its generic-for page, its brand page, its ingredient pages (ingredient
  matches only), its aisle, its twin, and up to four swaps on the same shelf in the same market.
- Before: with no country 9 swaps were unreachable; with a US country 577 pages. After: none, in every view checked.
- 18 pages have only one link in (mostly brand and generic-for pages whose only swap is itself rarely linked); they are
  reachable and in the sitemap.
- `/my-list` is linked from the header and is noindex; it is correctly not in the sitemap.

## Proposals, not built

### 1. Country-independent swap body in the first HTML (medium effort, high value)

*Built on 13 Nov 2026, with proposal 2: see `docs/country-urls.md`.*

What still needs JavaScript on a swap page is mostly not country-dependent: the verdict line ("Equate has the same
active ingredient as Claritin and costs 88% less per tablet"), the match and confidence badges, the "Why" block, where
the brand wins, the same-or-different table except its price rows, sources and photo credits. Only the offers table,
"same amount" line, bulk box, where-to-buy, related cards and sticky buy bar need the country.

Plan: split `CompareBody` in `src/app/compare/[slug]/page.tsx` into a static part and a `CountryPart`. In
`src/components/SameOrDifferent.tsx`, let the table take its price rows as a slot filled by a `CountryPart`. In
`src/components/WhyBlock.tsx`, pass text through a price filter for the static form (`hasPrice` in
`src/lib/swap-faq.ts` already does this) and stream the sentences with prices. Layout risk: the verdict and the offers
sit side by side, so the static part must hold the offers' height (as `CountryPart`'s fallback does now).

The same split works for `/dupe` (head, match labels and counts are static), `/ingredient` (head) and `/bundle`
(components list without prices). `/why` is all cited findings, filtered by country only for which chains they name:
the findings with no chain could be static.

### 2. Country URLs: `/uk/...`, `/de/...`, `/us/...` (large effort, the biggest long-term gain)

*Built on 13 Nov 2026, as a rewrite to `src/app/country/[country]` rather than moving every route, and without the
first-visit redirect: see `docs/country-urls.md` for the design and the canonical rule.*

Today a URL's content depends on a cookie, so search engines index one version (now the unknown-visitor one, in each
record's own currency) and a UK searcher's result can't show UK prices or stores. With a country prefix, each market's
page is its own URL with its own prices, `hreflang="en-GB"` etc. between them, and `CountryPart` reads the country from
the path instead of the cookie. Files: `src/proxy.ts` (redirect a first visit to its country prefix, never a crawler),
`src/lib/server-country.ts` (country from the path), every `src/app/**` route moved under `[country]`, `sitemap.ts`
(one entry per market version), `seo.ts` (hreflang for every market version, not just twins), the `Link`s in
components. Records stay per market, so `/de/compare/<us-slug>` would be the converted view and should be noindex.
Worth doing before the catalogue grows; every link earned before then points at a URL that would need a redirect.

### 3. German pages for German records (medium effort after 2)

150 German records have German product names and German sources, but every page is English, so they rank for neither
German queries ("Alternative zu Persil", "Generikum Nurofen") nor English ones well. Needs: `lang="de"` pages under
`/de/`, translated templates (the page chrome, `seo.ts`, `swap-faq.ts`, match labels), and German `summary` and
`differences` text in the records, written by a person, since the copy rules (claims no stronger than the record)
don't survive machine translation unchecked. Start with the 53 medicine generic-for pages, where the German query
volume is clearest.

### 4. Public changelog of price checks (small effort)

A `/changes` page and feed listing each catalogue build's added swaps and re-checked prices, generated from git
history of `data/pairs/*.json` at build time. It gives crawlers and assistants a dated record that the prices are
maintained, and gives returning visitors a reason to come back. Needs a "first added" date per record, which the
catalogue doesn't have: the build script would read it from `git log --diff-filter=A` (a small separate function).

### 5. Single-swap generic-for pages (decision for the owner)

295 of 346 `/dupe` pages have one swap, so they repeat their swap page with a different title. They target a different
query ("generic for X", "cheaper alternative to X") and add the "is there a generic" answer, which is why they stay
indexable. If Search Console later shows Google choosing the swap page as canonical for most of them, either
canonicalise those to `/compare/<slug>` or give the dupe page more of its own (every strength and pack of that brand).

## After this round

| Check | Before | After |
|---|---|---|
| Pages reachable from home, crawler with US geo header | 708 / 1,285 | 1,285 / 1,285 |
| Pages reachable, no country | 1,276 / 1,285 | 1,285 / 1,285 |
| Unique swap titles | 448 / 458 | 458 / 458 |
| Swap page text visible without JavaScript | ~2,150 chars (chrome and h1) | ~2,900-3,350 chars |
| Twins with hreflang | 0 / 20 | 20 / 20 |
| Kit and basket share images | 0 / 68 | 68 / 68 |
| Sitemap URLs with a date | 0 | all but 8 prose pages |
