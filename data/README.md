# Catalog data

Every swap lives in `data/pairs/*.json` (one file per research batch; any file name works).
Bundles (a brand's kit rebuilt from cheaper items) live in `data/bundles/*.json`.
Each file is a JSON array of pairs. `npm run catalog` validates all of them against
`src/lib/schema.ts` and writes `src/generated/catalog.json`, which the site reads.
It runs automatically before `npm run dev` and `npm run build`, and the build fails if any pair is invalid.

## Rules for a pair

- `match_type` is one of `identical_active`, `identical_formula`, `same_manufacturer`, `equivalent_spec`.
  See `/how-we-verify` on the site for what each one requires. `same_kind` is the honest fallback when the records show no more than
  that. The build fails an `identical_active` pair unless every `key_ingredients` row matches on both sides, and turns an
  `equivalent_spec` pair into `same_kind` when nothing is compared on both sides, so write rows for the same spec with the same name.
- `confidence` is `high` (both labels confirmed from primary sources) or `medium` (strong but secondary evidence).
- `brand.unit` and `alternative.unit` must be the same unit, because savings are computed per unit.
- At least 2 real `sources` URLs.
- The alternative must be at least 5% cheaper per unit, or the build rejects it.
- `market` is the country the prices were checked in: `US` (default), `GB`, `CA`, `DE` or `IE`. `price` is in
  that country's currency (USD, GBP, CAD, EUR), and both sides of a pair must be priced in the same market.
  Slugs for non-US pairs end in `-gb`, `-ca`, `-de` or `-ie`. (Older files use `price_usd`; it still works and means USD.)
- `retailer` is one of the stores in `RETAILERS` in `src/lib/markets.ts`, or `other`.
- `asin` is optional. When it is set, Amazon links go to that market's Amazon store (`amazon.com`, `amazon.co.uk`,
  `amazon.ca`, `amazon.de`) with the matching affiliate tag.
- `look_for` is optional: what a shopper in another country should search for, when the automatic phrase
  (actives, strength and form) wouldn't work.

### Optional product fields

- `gtin`: the UPC/EAN barcode digits (8 to 14). Used to fetch openly licensed photos
  (`npx tsx scripts/fetch-images.ts`) and, later, to match affiliate feeds.
- `image`: where a product photo was found (older files). The site never loads this URL. `scripts/images/ingest.ts`
  downloads it, normalises it, and stores `public/products/<file>-160.webp` and `-480.webp` with a licence record in
  `data/images.json`, keyed by `"<brand>|<product>"`. **Only openly licensed sources**: Open Facts (CC BY-SA, credited on
  the page) and others listed in `docs/research/R2-reuse.md`. A photo shows only once a person has checked it (`reviewed`).
  DailyMed label images stay off: they're flat carton artwork and their rights aren't confirmed. Never brand or retailer
  photos unless their terms allow it. A swap with no record draws a pack tile and doesn't count as covered.
- `why`: one or two plain sentences on why this brand's premium isn't worth paying, specific to this swap.
- `claims`: ids from `data/evidence/claims.json` to show on this swap. Claims matching the category apply anyway.
- `shelf_life`: an id from `data/evidence/shelf-life.json`, when the subcategory match isn't the right record.
- `same_swap`: the slug of this same swap priced in another market. Set it on one of the two, and the build links both. A list shows one of them: the shopper's own market's first, then the market they lead with, then the one with English names.
- `bulk`: a bigger pack of the alternative, same unit: `{ "product", "size", "price", "retailer", "url" }`. Its price is
  checked the same way as the others, and its URL goes in `sources`.
- `rating`: `{ "stars": 4.6, "count": 12400, "source": "<the product page the rating is from>" }`. Use the same
  retailer for both sides when you can, so the ratings are comparable.
- `license_id`: the regulator's number printed on the pack: NDC (US), PL (UK), DIN (Canada), PZN (Germany).
  When both sides have the same number, the page says they are the same licensed medicine.

### The "same or different?" table

Every swap page builds this table from the label data: active ingredients, formula or manufacturer, pack, price
per unit, rating, licence number and retailer. Add researched rows with `aspects` on the pair for anything
else a shopper would weigh up, such as inactive ingredients, coating, third-party testing, warranty, returns or
customer service. A row with the same `aspect` name replaces the generated one.

```json
"aspects": [
  { "aspect": "Coating", "brand": "Sugar-coated tablet", "alternative": "Film-coated tablet", "verdict": "different" },
  { "aspect": "Warranty", "brand": "2 years", "alternative": "18 months", "verdict": "brand_better" }
]
```

`verdict` is `same`, `alt_better`, `brand_better` or `different`. Be honest about where the brand wins.

## Presets (`data/presets/*.json`)

A basket for a life moment, built only from swaps in the catalogue, so a preset makes no new price claims. All its
items are priced in one market. The total buys the same amount on both sides, using each swap's unit prices.

```json
{
  "family": "new-flat",
  "slug": "new-flat-gb",
  "market": "GB",
  "title": "A new flat",
  "audience": "Moving in, first cupboard shop",
  "blurb": "One line on what it covers.",
  "icon": "key",
  "research": "Which checklists and guides the list of items came from.",
  "sources": ["https://...", "https://..."],
  "items": [{ "pair": "<swap slug>", "qty": 1, "note": "optional" }]
}
```

`icon` is one of `PRESET_ICONS` in `src/lib/schema.ts`. At least 4 items and 2 sources for the list.

## Evidence (`data/evidence/`)

`claims.json` holds cited findings on why a premium isn't worth paying, and where the cheap option lost. Each has at least
two sources, written in our own words with the numbers from the source. `categories` may include `"general"`, which puts a
finding on `/why` but not on swap pages. A swap page shows a finding only when the swap names it in `claims`, when the finding
lists the swap's subcategory, or when the finding lists the swap's category and no subcategories.

`nutrition.json` holds Open Food Facts records (ODbL) for catalogue products, written by `scripts/qa/extract_nutrition.py`:
`{source, license, licenseUrl, dump, items: {"<brand>|<product>": {code, page, name, modified, kcal, fat, saturates, sugars, salt, protein, fibre, ingredients}}}`,
per 100 g or 100 ml, null when unknown. The build attaches a record to each side of a food swap, and the swap page shows it
when both sides have one, credited and linked. Medicine and other aisles never get nutrition rows.

```json
{
  "id": "which-2025-own-label-beans",
  "title": "Own-label beans beat the brand in blind tests",
  "finding": "What was tested, by whom, and the result with its numbers.",
  "categories": ["food-pantry"],
  "subcategories": ["Canned food"],
  "markets": ["GB"],
  "caveat": "Where this stops applying, or what the brand won.",
  "sources": [{ "url": "https://...", "publisher": "Which?", "title": "...", "date": "2025-03" }]
}
```

`shelf-life.json` holds how long things keep, for the bulk view. `advice` is `stock_up` (keeps for years), `buy_to_use`
(fine if you get through it in time) or `buy_small` (goes off or weakens). Matching is by subcategory name.

```json
{
  "id": "alkaline-batteries",
  "label": "Alkaline batteries",
  "categories": ["batteries"],
  "subcategories": ["AA batteries", "AAA batteries"],
  "unopened": "Up to 10 years in storage",
  "opened": "",
  "storage": "Cool and dry, in the pack",
  "advice": "stock_up",
  "note": "",
  "sources": [{ "url": "https://...", "publisher": "...", "title": "...", "date": "2025" }]
}
```

## Example swap

```json
{
  "slug": "advil-vs-amazon-basic-care-ibuprofen-200mg",
  "market": "US",
  "category": "otc-medicine",
  "subcategory": "Pain relief",
  "title": "Advil vs Amazon Basic Care Ibuprofen 200mg",
  "brand":       { "brand": "Advil", "product": "Advil Tablets 200mg", "size": 200, "unit": "tablet",
                   "price": 17.97, "retailer": "amazon", "asin": null, "url": "https://www.amazon.com/s?k=advil+200",
                   "key_ingredients": [{ "name": "Ibuprofen", "amount": "200 mg" }] },
  "alternative": { "brand": "Amazon Basic Care", "product": "Ibuprofen Tablets 200mg", "size": 500, "unit": "tablet",
                   "price": 11.49, "retailer": "amazon", "asin": null, "url": "https://www.amazon.com/s?k=basic+care+ibuprofen",
                   "key_ingredients": [{ "name": "Ibuprofen", "amount": "200 mg" }] },
  "match_type": "identical_active",
  "confidence": "high",
  "summary": "One sentence on why they are the same.",
  "evidence": "What was checked and what matched.",
  "differences": "Honest differences, or an empty string.",
  "sources": ["https://dailymed.nlm.nih.gov/...", "https://..."],
  "price_checked": "2026-11"
}
```

## Country, currency and exchange rates

The selected country (picker, or the geo cookie) sets the currency, the prices that lead and the stores we name. The rules live in `src/lib/localize.ts` and are tested in `scripts/qa/country-rules.test.ts`.

- **Rates:** `data/fx/ecb-reference-rates.json`, from the [ECB's euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), which are for information only. Refresh by saving `eurofxref-daily.xml` to an empty folder and running `python3 -I scripts/fx/ecb-to-json.py <saved file> data/fx/ecb-reference-rates.json`. The date in the file shows on the site.
- **A converted price always says so:** "about €11.98 (£9.99 at a UK store, Nov 2026)". Cards have room for "about" and "UK prices", and the swap page shows the full form. Records hold a month, not a day, so that's the date shown.
- **Fallback:** a country with no market of its own leads with the nearest one, and a band at the top of each page says so. The UK for Ireland and the countries in `NEAREST_IS_UK`, Germany for the rest. US and Canadian records never show in a list outside the US and Canada.
- **No published rate:** Serbia, Bosnia, North Macedonia, Albania, Ukraine (German prices, in euro), the UAE, Saudi Arabia and Argentina (UK prices, in pounds). The band names the reason.
- **Stores:** a store that doesn't sell in the selected country isn't named or linked; the row says "A UK store" and points to the local search. Every link added to `LOCAL_STORES` must have been opened and returned a results page. On 7 Nov 2026 Tesco Ireland, Dunnes, Aldi Ireland and Boots Ireland refused automated checks, so they aren't listed.
- **Not localised, on purpose:** `<title>`, meta descriptions, social images and JSON-LD keep the record's own currency. Crawlers have no country, and those values have to match the record.

## Ratings

Owner's rule: nothing we recommend sits under 3 of 5 or 6 of 10. `npm run catalog` fails on a cheaper product under 0.6. The floor applies to the product we tell people to buy, not the brand it's compared with.

A `rating` stores the score as the source gives it: `{ "score", "scale", "count", "source", "date", "publisher" }`. `stars` is the older spelling of a `stars-5` score. Scales, in `src/lib/rating.ts`:

| Scale | Source's range | Share | Floor |
|---|---|---|---|
| `stars-5` | 0 to 5, higher is better | score / 5 | 3.0 |
| `out-of-10` | 0 to 10, higher is better | score / 10 | 6.0 |
| `percent` | 0 to 100, higher is better (Which?) | score / 100 | 60% |
| `de-grade` | 1.0 best to 5 or 6 worst (Stiftung Warentest, Öko-Test words: sehr gut = 1, gut = 2, befriedigend = 3) | (6 - score) / 5 | 3.0 |

German grades run backwards, so they can't share a formula. Grade 1 reads as 5 stars and grade 5 as 1 star, which puts grade 3.0 on the floor with 3 stars.

Scores the catalogue already quoted in its text live in `data/evidence/ratings.json`, written by `scripts/qa/mine_ratings.py`. Ratings read off a store's product page go in `data/evidence/ratings-read.json`, and the script copies them in. A rating in a pair's own record wins over that file. New pairs carry their rating in the record. Ratings follow the same rights rules as photos: quote the score and link the source, and don't copy review text.

An unrated product stays listed and reads "No rating found yet". It sorts behind rated ones, and doesn't lead the home page or baskets once a market has enough rated swaps. The owner can still choose to hide unrated products outright.

## Ireland

`IE` is a market with too few swaps of its own to lead (`THIN_MARKETS` in `src/lib/localize.ts`): it still falls back to UK prices under the seller rule, says so, and lists its own records as well. Take it out of `THIN_MARKETS` once it can fill the home page. Irish records so far come from zooplus.ie, whose terms show no bar on reading prices. Left out on purpose: Tesco and Aldi Ireland, Dunnes, Boots and Harvey Norman refuse automated requests; SuperValu's terms (clause 1.2) say personal, non-commercial use only; Woodie's terms bar copying without written approval. A new Irish record ships with a rating.
