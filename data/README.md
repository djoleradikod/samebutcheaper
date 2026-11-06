# Catalog data

Every swap lives in `data/pairs/*.json` (one file per research batch; any file name works).
Bundles (a brand's kit rebuilt from cheaper items) live in `data/bundles/*.json`.
Each file is a JSON array of pairs. `npm run catalog` validates all of them against
`src/lib/schema.ts` and writes `src/generated/catalog.json`, which the site reads.
It runs automatically before `npm run dev` and `npm run build`, and the build fails if any pair is invalid.

## Rules for a pair

- `match_type` is one of `identical_active`, `identical_formula`, `same_manufacturer`, `equivalent_spec`.
  See `/how-we-verify` on the site for what each one requires.
- `confidence` is `high` (both labels confirmed from primary sources) or `medium` (strong but secondary evidence).
- `brand.unit` and `alternative.unit` must be the same unit, because savings are computed per unit.
- At least 2 real `sources` URLs.
- The alternative must be at least 5% cheaper per unit, or the build rejects it.
- `market` is the country the prices were checked in: `US` (default), `GB`, `CA` or `DE`. `price` is in
  that country's currency (USD, GBP, CAD, EUR), and both sides of a pair must be priced in the same market.
  Slugs for non-US pairs end in `-gb`, `-ca` or `-de`. (Older files use `price_usd`; it still works and means USD.)
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
  the page), DailyMed (public domain) and others listed in `docs/research/R2-reuse.md`. Never brand or retailer photos
  unless their terms allow it. A swap with no record draws a pack tile and doesn't count as covered.
- `why`: one or two plain sentences on why this brand's premium isn't worth paying, specific to this swap.
- `claims`: ids from `data/evidence/claims.json` to show on this swap. Claims matching the category apply anyway.
- `shelf_life`: an id from `data/evidence/shelf-life.json`, when the subcategory match isn't the right record.
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
two sources, written in our own words with the numbers from the source. `categories` may include `"general"`.

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
