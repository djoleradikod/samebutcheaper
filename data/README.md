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
- `image`: a product photo. **Only Open Facts photos** (`images.openfoodfacts.org`, `images.openbeautyfacts.org`,
  `images.openpetfoodfacts.org`, `images.openproductsfacts.org`), which are CC BY-SA and credited on the page.
  Never paste brand or retailer photos: they are copyrighted. The schema drops any other host to `null`
  (see `IMAGE_HOSTS` in `src/lib/schema.ts`), and the site draws a colour tile instead. Affiliate API hosts get
  added there once those APIs are live.
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

## Example

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
