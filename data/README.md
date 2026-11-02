# Catalog data

Every swap lives in `data/pairs/*.json` (one file per research batch; any file name works).
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
- `asin` is optional. When it is set, Amazon links go to `amazon.com/dp/<ASIN>?tag=<AMAZON_ASSOCIATE_TAG>`.

## Example

```json
{
  "slug": "advil-vs-amazon-basic-care-ibuprofen-200mg",
  "category": "otc-medicine",
  "subcategory": "Pain relief",
  "title": "Advil vs Amazon Basic Care Ibuprofen 200mg",
  "brand":       { "brand": "Advil", "product": "Advil Tablets 200mg", "size": 200, "unit": "tablet",
                   "price_usd": 17.97, "retailer": "amazon", "asin": null, "url": "https://www.amazon.com/s?k=advil+200",
                   "key_ingredients": [{ "name": "Ibuprofen", "amount": "200 mg" }] },
  "alternative": { "brand": "Amazon Basic Care", "product": "Ibuprofen Tablets 200mg", "size": 500, "unit": "tablet",
                   "price_usd": 11.49, "retailer": "amazon", "asin": null, "url": "https://www.amazon.com/s?k=basic+care+ibuprofen",
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
