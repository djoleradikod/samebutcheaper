# R2: reuse scout for images, code, bulk, evidence and prices

Date: 2026-11-06. This is the reuse scout for the owner-push work. It records what we can use, on what terms, and what
we could not confirm. Six read-only scouts collected the material. The lead then opened the claims that matter most.

How to read it:

- "Spot-checked" means the lead reopened the source on 2026-11-06. The section below says what each check found.
- Everything else is what a scout reported on the same date and has not been reopened.
- Web pages were read through a fetch tool that summarises with a small model. Where exact wording decides something, the
  check used the raw page text and says so. Clause numbers on the eBay and Best Buy pages are the tool's numbering, so
  check them against the page before quoting them to anyone.
- "Unconfirmed" means we looked and could not establish it. This document is not legal advice.

## Spot-check outcomes

| # | Claim from the scouts | Outcome | What the source says |
|---|---|---|---|
| 1 | Open Food Facts (OFF) images are CC BY-SA, commercial use allowed, attribution with a link | Confirmed. The raw page links CC BY-SA 3.0, which matches `data/images.json` | Reusers "have to mention the licence and to attribute the authorship to Open Food Facts with a link", or the product page for a specific product. The same attribution is "necessary for derivative works" |
| 2 | These images can be used "with no per-brand permission" | Refuted as worded | The licence "only covers the photo itself". Pack design copyright and trademark rights may apply, and it is the reuser's responsibility "to verify by themselves the rights that may apply" |
| 3 | OFF bulk rules were unread | Now confirmed | Above "a few hundred products", download the data. For more than about 10 images, use the S3 bucket `openfoodfacts-images` (eu-west-3). On OFF's own server, fetch "one at a time". The bucket syncs monthly and is not complete. Its page states no licence and does not mention the sister databases |
| 4 | OFF API page: "Any attempt to scrape the database using the API will very likely be blocked" | Not found | The raw text of that page has no form of the word "scrape". The rate limits and the custom User-Agent rule are confirmed. Abusive crawling is covered by "global rate-limits" and an IP ban. Do not quote the sentence |
| 5 | OFF product JSON may not carry image URLs | Answered: it does | A raw read of one product returned `image_url`, `image_front_url` and `selected_images`. `images` lists sizes and uploader. `data-fields.txt` lists `image_url` |
| 6 | Open Icecat terms could not be read | Partly confirmed | icecat.biz stays behind a bot check, but iceclog.com serves the terms (below). No clause names images, caching or local hosting, so self-hosting images stays unconfirmed |
| 7 | Commons files can be filtered by licence and credited from metadata | Confirmed by test | A raw API call on 5 battery photos returned `LicenseShortName`, `License`, `AttributionRequired`, `Artist`, `Credit`, `Restrictions` and `Copyrighted`. MediaWiki warns these values are "currently unreliable" for multi-licensed images and calls `License` "a best guess". Commons says to verify each image yourself and that trademarks are separate. The filtering is on our side. No licence search parameter was tested |
| 8 | Stiftung Warentest: brand basket "about 34% more expensive" | Number confirmed, direction refuted | Raw text: "Beim Einkauf lässt sich 34 Prozent sparen". The own-label basket is 34% cheaper, which makes the brand basket about 52% dearer. Grades 2.8 vs 2.7 (48 tests), 1,414 products, 25 tests for price, 25 Jan 2023 are all confirmed |
| 9 | NBER: pharmacists 9% vs 26%, chefs 12 points, $196bn and $44bn | Confirmed on the digest page | Also 50 health and 241 food and drink categories |
| 10 | CMA: larger packs sometimes cost more per unit; basket of 26; snapshot of 9 May 2023 | Confirmed | Toilet roll, cheese and laundry pods are the named examples |
| 11 | eBay: "adopt for display" | Verdict refuted | "eBay Content in a Public Display may not be co-mingled or combined with non-eBay Content" and must be "visually isolated". A brand-next-to-cheaper page cannot do that |
| 12 | Best Buy: top-ranked unlock; US only | Ranking refuted, US-only unconfirmed | The 72-hour cache limit and attribution are confirmed. The licence applies "in connection with offers to sell or sales of our products and services", and sites offering several purchase tiers must put Best Buy in the first tier. The terms I read set no territorial limit |
| 13 | Amazon: images may not be stored or cached | Confirmed, one correction | "You will not store or cache Product Advertising Content consisting of an image." A link to the image may be stored "for up to 24 hours", not indefinitely. I did not see the scout's "ASINs indefinitely" line |
| 14 | DailyMed label images are public domain (our own records and `data/README.md`) | Not supported | See below |

### A finding the scouts did not raise: our DailyMed records

38 of the 50 records in `data/images.json` have `source: dailymed` and `license: "Public domain"`. That label is hardcoded
in `scripts/find-images.ts`. Only 12 records carry an Open Facts licence.

NLM's policy page (raw text) says its sites may hold "photographs, or other content contributed by or licensed from private
individuals, companies, or organizations that may be protected", and that "NLM cannot guarantee the copyright status for any
item". DailyMed's SPL image guideline describes images "submitted by the firm", though it covers oral dosage images and not
pack labels. Label art on DailyMed appears to come from the manufacturer, not the US government. I found no page that grants
reuse of it. So "public domain" is unconfirmed for all 38, and these are the medicine images the brief wants to stop leading with.

Match quality is a second problem. The record for "Equate Ibuprofen Tablets 200 mg, 500 count" matched
"IBUPROFEN DYE FREE (IBUPROFEN) TABLET, FILM COATED [WALMART INC.]", which is not plainly the same product. I did not audit the others.

## Images: open sources

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| Open Food Facts | https://world.openfoodfacts.org/terms-of-use | Images CC BY-SA 3.0; database ODbL; contents DbCL | Server repo AGPL-3.0, 1,200, 2026-11-06: do not link its code | adopt | Spot-checked. Download and self-host with licence, link and product page recorded. Third-party rights in the pack are on us (see legal questions). Whether taking barcode-to-image rows triggers ODbL duties is unconfirmed |
| Open Beauty Facts | https://world.openbeautyfacts.org/terms-of-use | Same wording, per scout | Not checked | adopt | Personal care and beauty. Coverage not measured |
| Open Products Facts | https://world.openproductsfacts.org/terms-of-use | Same wording, per scout | Not checked | adopt | Household goods. Already 3 records. Coverage not measured |
| Open Pet Food Facts | https://world.openpetfoodfacts.org/terms-of-use | Same wording, per scout | Not checked | adopt | Pet food. Coverage not measured |
| OFF S3 image bucket | https://openfoodfacts.github.io/openfoodfacts-server/api/aws-images-dataset/ | Licence not on that page; OFF's data page says all images are CC BY-SA | Monthly sync | adopt | Spot-checked. Recommended route for more than about 10 images. Sister databases are not mentioned, so use their servers one image at a time |
| Wikimedia Commons with Wikidata P18 | https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia | Per file: CC0, CC BY, CC BY-SA, public domain | n/a | adopt | Spot-checked. A generic battery photo is not "this item", so only exact product matches count as covered. Product coverage not measured |
| Open Icecat | https://iceclog.com/open-content-license/ | Open Content License v1.4 (11 Feb 2026); Fair Use Policy (2 May 2026) | n/a | watch | Spot-checked, summary read only (raw fetch gave a page shell). Copies and modified copies allowed with a set notice. Images, caching and hosting are not named. The Fair Use Policy bars use that violates a brand's purpose of "promoting and advancing" its products, which a "don't pay for the brand" site may do. Commercial use "inside a generative AI framework" voids the licence, and this repo has an Anthropic SDK dependency, so Icecat content must never reach a prompt. Free brands unconfirmed |
| Openverse | https://docs.openverse.org | Per item | WordPress/openverse, MIT, 536, 2026-11-06 | watch | Rate limits and filters unconfirmed: the API page returned only its title. It indexes Commons and others, so it adds little until Commons runs out |
| DailyMed | https://www.nlm.nih.gov/web_policies.html | Text public; photos may belong to private parties | n/a | reject | Hold for images until the legal answer. No new records. See the finding above |
| FoodData Central | https://fdc.nal.usda.gov/ | Public domain data | n/a | reject | No images |
| EU Safety Gate | https://commission.europa.eu/legal-notice_en | EU-owned content CC BY 4.0; third-party content needs permission | n/a | reject | Photo rights unconfirmed |

## Images: commercial sources

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| Amazon Associates, Creators API | https://affiliate-program.amazon.com/help/operating/policies | No storing or caching images; each use links only to Amazon; resize only; dated price stamp | n/a | watch | Spot-checked. Large catalogue, but it needs hotlinking, which the brief forbids unless the coordinator makes an exception. Needs an account, and PR 2 is still waiting. Sales threshold unconfirmed. PA-API retirement dates conflict across sources |
| eBay Browse API | https://developer.ebay.com/develop/apis/api-license-agreement | No co-mingling with non-eBay content; 6-hour freshness; delete copies | n/a | reject | Spot-checked. The clause rules out side-by-side swaps |
| Best Buy Developer API | https://developer.bestbuy.com/legal | Attribute; resize only; cache 72 hours at most; tied to selling Best Buy products | n/a | watch | Spot-checked. Weak fit: first-tier placement and the sales tie conflict with recommending the cheapest item. 72 hours rules out storing images in the repo. Whether it is free, and how the affiliate carve-out works, are unconfirmed |
| Walmart via Impact | https://affiliates.walmart.com/terms | Exh. A §24 bars product images unless Walmart supplies them for the program | n/a | reject | Per scout, summary only |
| Target Partners | https://partners.target.com/faqs | Unconfirmed (search only) | n/a | watch | Program status conflicting; no API found |
| Kroger API | https://developer.kroger.com | Unconfirmed (empty fetch) | n/a | watch | Terms unread |
| Tesco | none opened | 2009 rules allowed only Tesco-supplied images (search only) | n/a | reject | Probably dead, unconfirmed |
| Awin, CJ, Rakuten, Sovrn, Skimlinks | awin.com, cj.com, rakutenadvertising.com, sovrn.com, skimlinks.com | Unconfirmed; pages returned 404 or no clauses | n/a | watch | Rights are probably per advertiser. Each needs an account |
| Anker, P&G, Unilever, Duracell press kits | none found | Unconfirmed; Unilever's notice implies no licence | n/a | reject | Would need each brand's written permission, and our purpose is to steer people away from them |

## Code

Metadata from `gh api` on 2026-11-06. Lead re-read sharp, thumbhash, convert-units, U-2-Net and shadcn/ui. The rest are the scout's readings.

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| sharp | https://github.com/lovell/sharp | Apache-2.0 | 32,826, 2026-11-05 | adopt | `scripts/images/ingest.ts` already imports it, but it is only Next's optional dependency in the lockfile. Make it a direct dev dependency |
| Fuse.js | https://github.com/krisk/Fuse | Apache-2.0 | 20,525, 2026-08-09 | adopt | Already a dependency |
| thumbhash | https://github.com/evanw/thumbhash | MIT | 4,236, 2024-05-26 | adopt | Small placeholders. Old but finished; check it does not hurt LCP |
| convert-units | https://github.com/convert-units/convert-units | GitHub says NOASSERTION; scout read MIT in package.json | 851, 2026-10-18 | adopt | Unit-price conversion, with our own parser of about 100 lines. Confirm the licence at install |
| shadcn/ui | https://github.com/shadcn-ui/ui | MIT | 127,511, 2026-11-06 | adopt | Copy in only what we lack (sheet, command). We have Tailwind 4 and no component library. The primitives copies pull in were not reviewed |
| coss ui | https://github.com/cosscom/ui | MIT | 10,795, 2026-11-05 | borrow | Product card and facet patterns |
| vercel/shop | https://github.com/vercel/shop | MIT | 126, 2026-11-01 | borrow | Storefront patterns; Shopify-backed, so no base |
| rembg | https://github.com/danielgatis/rembg | MIT | 25,364, 2026-11-06 | watch | Offline tool only, once the cutout question is answered |
| U-2-Net | https://github.com/xuebinqin/U-2-Net | Apache-2.0 repo | 9,894, 2024-06-26 | watch | Scout said adopt. Weight and training data terms were not read, and cutouts wait on the legal question |
| IS-Net (DIS) | https://github.com/xuebinqin/DIS | Apache-2.0 repo | 2,588, 2024-09-23 | watch | Same as U-2-Net |
| BiRefNet | https://github.com/ZhengPeng7/BiRefNet | MIT code; weights unconfirmed | 4,377, 2026-10-25 | watch | Weight and dataset terms not cleared |
| jez500/pricebuddy | https://github.com/jez500/pricebuddy | GPL-3.0 | 1,494, 2026-10-24 | watch | Separate process only, never linked |
| Orama | https://github.com/oramasearch/orama | Apache-2.0 | 10,601, 2026-10-18 | watch | Features we do not need |
| MiniSearch | https://github.com/lucaong/minisearch | MIT | 6,193, 2025-09-16 | watch | Fallback if Fuse fails at facets |
| Stackzero commerce-ui | https://github.com/stackzero-labs/ui | MIT | 266, 2025-09-01 | watch | 14 months stale |
| BRIA RMBG-2.0 | linked from the rembg README | Paid for commercial use, per scout | n/a | reject | Paid licence |
| makeswift/commerce-toolkit | https://github.com/makeswift/commerce-toolkit | None found | 1, 2026-07-14 | reject | A search snippet said MIT; the repo does not |
| vercel/commerce | https://github.com/vercel/commerce | MIT | 14,309, 2026-10-19, archived | reject | Archived |
| Discount-Bandit | https://github.com/Cybrarist/Discount-Bandit | None found | 762, 2026-10-26 | reject | No licence |
| PriceGhost | https://github.com/clucraft/PriceGhost | None in metadata | 1,136, 2026-02-03 | reject | No licence |
| medusajs/medusa | https://github.com/medusajs/medusa | MIT core | 37,112, 2026-11-06 | reject | A selling backend; we do not sell |
| HeroUI | https://github.com/heroui-inc/heroui | Apache-2.0 | 31,148, 2026-11-04 | reject | Second design system |
| Tremor | https://github.com/tremorlabs/tremor | Apache-2.0 | 3,689, 2025-10-10 | reject | Dashboards, and stale |
| FlexSearch | https://github.com/nextapps-de/flexsearch | Apache-2.0 | 13,817, 2026-06-28 | reject | Second search engine |
| Pagefind | https://github.com/Pagefind/pagefind | MIT | 5,552, 2026-11-05 | reject | Static index; we need dynamic facets |
| blurhash | https://github.com/woltapp/blurhash | MIT | 17,083, 2024-07-08 | reject | Thumbhash is smaller |

No open-source price comparison app is safe to fork: the good ones are GPL-3.0 or unlicensed. npm has no `unit-price`,
`price-per-unit` or `unitprice` package.

## Bulk and shelf-life sources

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| USDA FoodKeeper | https://catalog.data.gov/dataset/fsis-foodkeeper-data | CC0 on data.gov; metadata modified 2025-01-22 | n/a | adopt | The dataset record is read. The JSON itself returned 403, so its contents are unconfirmed and nothing ships from it until it opens |
| EU Directive 98/6/EC | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31998L0006 | EU law | n/a | adopt | Unit price required, art. 3(1); "clearly legible", art. 4(1) |
| UK Price Marking Order 2004 | https://www.legislation.gov.uk/uksi/2004/102/regulation/5 | Crown copyright | n/a | adopt | Unit price rule, with stated exemptions |
| German PAngV §4 | https://www.gesetze-im-internet.de/pangv_2022/__4.html | German law | n/a | adopt | Grundpreis "neben dem Gesamtpreis" |
| CMA unit pricing summary | https://www.gov.uk/government/publications/unit-pricing-analysis-and-consumer-research/summary-of-consumer-research-and-unit-pricing-analysis | Open Government Licence | n/a | adopt | Spot-checked. Bigger is not always cheaper. A single-day snapshot of 26 items, so state that |
| Clorox bleach FAQ | https://www.clorox.com/learn/how-to-tell-when-a-bleach-bottle-was-made/ | Company page, undated | n/a | adopt | One-year shelf life, opened or not. One source, so it needs a second before it ships |
| Which? unit pricing | https://www.which.co.uk/news/article/can-you-spot-the-cheapest-supermarket-prices-asvVe1C5iZMO | Copyright Which?; terms unread | n/a | borrow | 23 Aug 2022. Cite and link; do not copy |
| FDA pet food storage | https://www.fda.gov/animal-veterinary/animal-health-literacy/proper-storage-pet-food-treats | Government work | n/a | borrow | Below 80 F, cool and dry. No opened-bag shelf life, so we must not imply one |
| Battery University BU-802b | https://batteryuniversity.com/article/bu-802b-what-does-elevated-self-discharge-do | Terms unread | n/a | borrow | Alkaline 7 to 10 years, no storage temperature. Energizer's own page is unconfirmed, so the two-source rule is not met yet |
| FDA SLEP page | https://www.fda.gov/emergency-preparedness-and-response/mcm-legal-regulatory-and-policy-framework/expiration-dating-extension | Government work | n/a | borrow | Military stockpile only. "Up to two years" and repackaging were not on the page. Must not be used to tell shoppers that medicine lasts longer |
| Purdue tuna study | https://purdue.edu/uns/html4ever/1999/990809.Binkley.surcharges.html | University news | n/a | borrow | 1999, three brands; give the date |
| NIST Handbook 130, Section 5 | https://www.nist.gov/document/2026-hb-130-section-iv-c | US public domain | n/a | watch | 2026 edition exists; §5.4 wording unread (compressed PDF) |
| Bauner and Hossain 2023 | https://econpapers.repec.org/RePEc:ags:aaea23:335447 | PDF returned 403 | n/a | watch | The 26% figure comes from a search summary. Unconfirmed |
| FoodKeeper app page, Tide or P&G, Energizer, Duracell, WRAP, FSA, 21 CFR 201.327, Consumer Reports unit pricing, Nielsen, Aguiar and Hurst | no working primary URL | Unconfirmed | n/a | watch | Primary pages returned 403, 404 or no matching text. Do not cite yet |
| Fleisher or Kim papers | https://economics.osu.edu/sites/economics.osu.edu/files/Abstract_Kim.pdf | Unreadable | n/a | reject | The author does not match what was reported. Do not cite |
| jelera/food-shelflife-db | https://github.com/jelera/food-shelflife-db | MIT | 7, 2023-01-19 | reject | Stale wrapper; use the official data |

## Why-not-overpay evidence

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| Stiftung Warentest brand comparison | https://www.test.de/presse/pressemitteilungen/Der-grosse-Markenvergleich-Handelsmarken-bieten-oft-gute-Qualitaet-fuer-weniger-Geld-5957414-0/ | Press release; terms unread | n/a | adopt | Spot-checked. Own-label basket 34% cheaper. Foods, 25 Jan 2023. The tofu, oil and organic meat claim is unconfirmed |
| NBER digest, Bronnenberg et al. | https://www.nber.org/digest/nov14/informed-shoppers-and-brand-premiums | Terms unread | n/a | adopt | Spot-checked. Numbers from the digest; cite the QJE paper as the study only, since its abstract was not extracted |
| CMA consumer research | https://www.gov.uk/government/publications/unit-pricing-analysis-and-consumer-research/summary-of-consumer-research-and-unit-pricing-analysis | Open Government Licence | n/a | adopt | Spot-checked. Long-life staples and cleaning are where shoppers use unit prices |
| Which? own-brand roundup | https://www.which.co.uk/news/article/own-brand-best-buys-our-experts-love-aQIQ36N6SxQp | Copyright Which?; terms unread | n/a | adopt | 29 Oct 2026. Beans, batteries, washing-up liquid, kitchen roll. Cite and link only |
| Which? everyday essentials | https://www.which.co.uk/news/article/everyday-essentials-you-could-be-overpaying-for-aRLz65k1AcuT | Same | n/a | adopt | 14 May 2026. Pricier items that did badly: a toilet roll, a kettle. Full tables paywalled |
| Which? tea test | https://www.which.co.uk/policy-and-insight/article/the-perfect-cuppa-supermarket-own-brand-tea-bags-beat-branded-favourites-aYXko9I0vZQn | Same | n/a | adopt | Aug 2024. Asda 1.5p a bag, 72%; PG Tips 4p, 71% |
| Which? beans test | https://www.which.co.uk/policy-and-insight/article/beans-on-a-budget-supermarket-own-brand-baked-beans-beat-branded-favourites-aLrd20H6Mayc | Same | n/a | adopt | Sept 2024 per the page (a snippet said 2023). Aldi 41p, 76%; Heinz £1.40, 72%. Oct 2026 prices differ, so keep the dates apart |
| Which? household items | https://www.which.co.uk/news/article/everyday-household-items-it-pays-to-get-right-ax3CV4w2cqJw | Same | n/a | adopt | 11 Jun 2026. Also our "cheaper really is worse" source: microfibre pillows wear out sooner, and some batteries are duds |
| Stiftung Warentest drugstore | https://www.test.de/Handelsmarke-gegen-Marke-371-Drogerieartikel-im-Vergleich-5463700-0/ | Part paywalled | n/a | adopt | 18 May 2019. 371 products, 21 tests. No percentage on the page |
| ACCC Nurofen | https://www.accc.gov.au/media-release/reckitt-benckiser-ordered-to-pay-17-million-in-penalties-for-misleading-conduct-regarding-nurofen-specific-pain-products | Regulator release | n/a | adopt | 29 Apr 2016. Same ibuprofen lysine 342 mg at almost double. Medicine, so not a lead story. The raised $6m penalty is unconfirmed |
| Which? dishwasher tablets | https://www.which.co.uk/reviews/dishwasher-tablets | Same | n/a | borrow | Apr 2026. Cost per wash only, because the scores are paywalled. It cannot support a quality claim |
| NBER WP 25214 | https://www.nber.org/papers/w25214 | Terms unread | n/a | borrow | Nov 2018. "Overwhelming majority" with no figure on the page |
| Consumer Reports press release | https://www.consumerreports.org/media-room/press-releases/2008/04/consumer-reports-names-great-everyday-products/ | Terms unread | n/a | borrow | 2008. Old, so give the date |
| ONS shrinkflation | https://www.ons.gov.uk/economy/inflationandpriceindices/articles/theimpactofshrinkflationoncpihuk/howmanyofourproductsaregettingsmaller | Terms unread | n/a | borrow | Jan 2019; data to June 2017. Dated |
| Hjorth-Andersen 1984 | https://academic.oup.com/jcr/article/11/2/708/1806551 | Abstract only | n/a | borrow | Weak price-quality link. Old framing only |
| Janssen and Kasinger 2025 | none opened (PDF returned 403) | Unconfirmed | n/a | watch | Figures from a search summary |
| Gerstner 1985; Hansen, Ailawadi and Steenkamp | none opened | Unconfirmed | n/a | watch | Search snippets only |
| Kirkland batteries made by Duracell | none (Motley Fool 404) | Unconfirmed | n/a | reject | A 2016 remark through secondary outlets. "Same manufacturer" needs documentation |

The "cheaper is worse" evidence is thin and mostly about product type, not store-brand versions of the same product. The
site should say that plainly and not imply parity everywhere. No terms pages of testers were read, so reuse stays at short
factual citation with a link.

## Price sources

Only four of 30 sources returned usable prices and pack text to the fetch tool.

| Candidate | URL | Licence or terms | Stars, last push | Verdict | Why |
|---|---|---|---|---|---|
| Which? published test prices | Which? URLs above | Copyright Which? | n/a | adopt | Citable prices with dates and scores for specific pairs. Few pairs |
| Amazon Creators API | https://affiliate-program.amazon.com/help/operating/policies | Allowed through the API, with a date stamp and disclaimer | n/a | watch | The compliant automated route for prices once the account exists |
| Aldi Süd | https://www.aldi-sued.de | Terms unread | n/a | watch | Price, pack and €/kg on the homepage. Automation unconfirmed |
| Trolley | https://www.trolley.co.uk | No licence or terms found | n/a | watch | Per-store UK prices. Automation unconfirmed |
| B&Q | https://www.diy.com | Terms unread | n/a | watch | Prices only on a later results page |
| Open Prices | https://prices.openfoodfacts.org | No licence statement found by the scout | n/a | watch | Community prices. Coverage not measured |
| Awin, CJ, other feeds | see commercial images | Unconfirmed | n/a | watch | Feeds would be the clean long-term route. Each needs an account |
| Target | https://www.target.com/c/terms-conditions/-/N-4sr7l | Bars robots, scraping and data extraction (fetch summary) | n/a | reject | Readable, but no automated pipeline may use it |
| Walmart | https://corporate.walmart.com/terms-of-use | Bars spiders and robots (fetch summary) | n/a | reject | Same, and a bot check |
| Costco, Home Depot, Lowe's, Staples, Tesco, Sainsbury's, Asda, Argos, Boots, Screwfix, Toolstation, Halfords, dm, Lidl, Rossmann, Hornbach, REWE, Bauhaus, ATU, Obi | none usable | Unread | n/a | reject | Blocked, or shells without prices. Do not try to get round bot checks |
| idealo, geizhals, Amazon retail pages | none usable | Unread | n/a | watch | Not reached by this tool. Terms unconfirmed. The bar comparison needs its own capture, and that is separate from taking their data |

Areas with no usable price source today: pet, cables and tech, office, car, garden. Baby rests on one untested Target
result. These are the areas the brief wants to grow into, so the catalogue will be limited here until a feed or dated hand
check exists.

## What we will do

**Images, in this order:**

1. Open Facts family first, no account needed. Match by `gtin` against the nightly dumps. Fetch OFF images from the S3
   bucket and sister-database images one at a time, with a custom User-Agent. Self-host, keep the licence, version and product page
   in `data/images.json`, and show the credit with a link. Run the dump query first and report coverage per category, because no
   coverage figure exists yet.
2. Wikimedia Commons second. Accept only an allow-list on `LicenseShortName` (CC0, public domain, CC BY, CC BY-SA). Send multi-licensed
   files and any non-empty `Restrictions` to a person. Store `Artist` and `Credit`. Count it as covered only when it shows the same product.
3. Everything else gets the designed placeholder and does not count as covered.
4. DailyMed: no new records. Report image share with and without the 38 records until the legal answer. Correct the
   "public domain" wording in `data/README.md` and `scripts/find-images.ts` to match the outcome.
5. Open Icecat only after a written answer from Icecat, and never in an AI prompt.
6. Amazon only after the account exists and the coordinator decides on the hotlinking exception.
7. eBay, Best Buy, Walmart and brand press kits are not pursued now.

**Code:** add sharp as a direct dev dependency, then adopt thumbhash and convert-units with our own unit-price parser. Keep Fuse.js.
Copy shadcn/ui components only where we lack one. No forks. No background removal until question 3 below is answered.

**Evidence:** use only rows marked adopt or borrow, with their dates. A claim with one source does not ship (bleach and alkaline
batteries today). Write the Stiftung Warentest figure as "34% cheaper", not "34% more expensive". Do not quote the OFF scraping sentence.

**Prices:** no automated collection from any retailer whose terms bar it or whose terms we have not read. Prices are dated hand
checks or published test prices until a feed exists. Pipelines may not get round bot checks.

**To send the owner, through the coordinator:**

- Three legal questions, none of which we can settle:
  1. Are DailyMed label images reusable on a commercial site? This decides 38 records.
  2. Does showing brand pack photos on a commercial comparison site need more than the photo licence, given that Open Facts leaves pack
     design and trademark rights to the reuser? This affects every image, including the Open Facts ones.
  3. Can we ship adapted images such as white-tile cutouts, marked as changed and released under CC BY-SA? The same question applies
     to the resize and flatten in `scripts/images/ingest.ts`.
- One unlock now: register a free Open Icecat account and send Icecat this question: "We run a site comparing branded products with
  cheaper equivalents. May we store Open Icecat images on our own server and show them next to competing products, and which brands
  are in the free set?"
- One later: an Amazon Associates account and Creators API credentials, with a decision on whether Amazon-served images are an
  allowed exception to the no-hotlinking rule. This is tied to PR 2 and public go-live, so it can wait.
- Nothing is needed for Open Facts or Commons, so that work starts now. The coverage each option reaches comes once the dump query has run.
