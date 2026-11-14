# Affiliate feeds: from "approved" to fresh prices

Written for a phone. When an affiliate network approves the site, its product feed can keep that store's prices
current, mark what's out of stock, and make the buy buttons earn. You set one secret on GitHub. No code changes.

What a feed does once it's set up, every Monday (or when you run it):

- Prices of matched products are checked against the record. Small moves are applied; big ones wait for you.
- Products the feed lists as out of stock say so on their page and stop leading lists. Prices stay as they were.
- Buy buttons for matched products go through the feed's tracked link. The address on the page (`/go/...`) doesn't
  change.
- A record priced from a feed counts as licensed, so the "barred" count in `/admin` goes down.

A feed for a store whose programme allows a shown price to be at most 24 hours old (Walmart) is also read every day by
the Deploy workflow, which then rebuilds the site; the server withholds such a price by itself once it gets too old.
docs/prices-daily.md has how and what it costs.

Nothing has been tried against a real feed yet: no account is approved and the build machine can't reach the
networks. "What isn't tested yet" at the end lists what to watch on the first run.

## Once, before any network

1. GitHub, the repository, **Settings > Actions > General**. Under Workflow permissions, tick **Allow GitHub Actions
   to create and approve pull requests**. Save.
2. Every feed goes in one repository secret, **`PRICE_FEED_URLS`**: Settings > Secrets and variables > Actions >
   New repository secret (or edit the one there). One feed per line:

   ```
   network:store@COUNTRY=address
   ```

   `store` is our store id (walmart, chewy, target, zooplus, shopapotheke, pollin, crocus, tesco, and the others
   in `RETAILERS` in `src/lib/markets.ts`). `COUNTRY` is US, GB, DE, CA or IE. A line without `network:` means Awin,
   as before. The secret is never printed, not even in the run's log.

3. The site itself also needs the programme switched on for its pages to say links may earn us money (the
   `AFF_...` settings in `.env.example` and `docs/affiliate-playbook.md`). Do that on the server when you add a feed.

## Impact: Walmart, Chewy, Target (Target Partners)

Covers 88 Walmart swaps, Chewy and 14 Target swaps (docs/research/R7-resourcing.md).

1. **Apply**: impact.com as a partner, then each brand's programme: Walmart (affiliates.walmart.com), Chewy, Target
   Partners. Approval is per brand.
2. **Copy from Impact**: in Settings, the API page shows your **Account SID** and **Auth Token**. Then the
   **catalogue ID** of each brand's product catalogue: open
   `https://api.impact.com/Mediapartners/ACCOUNT_SID/Catalogs` in a browser (it asks for the SID and token as
   user name and password) and note the `Id` next to the brand's name.
3. **Secret line**, one per brand:

   ```
   impact:walmart@US=https://ACCOUNT_SID:AUTH_TOKEN@api.impact.com/Mediapartners/ACCOUNT_SID/Catalogs/CATALOG_ID/Items
   impact:chewy@US=https://ACCOUNT_SID:AUTH_TOKEN@api.impact.com/Mediapartners/ACCOUNT_SID/Catalogs/CATALOG_ID/Items
   ```

   Use the brand's own catalogue, never `ItemSearch` across all catalogues: a line says whose prices these are.
   The run pages through the catalogue 1,000 items at a time (up to a million). If Impact gives you a catalogue
   file to download instead, its address works too.
4. **On the server**: `AFF_WALMART_US` (and `AFF_CHEWY`, `AFF_TARGET`) set to the tracking link from the brand's
   page in Impact, so pages that link there say they may earn.

## Awin: zooplus, Shop Apotheke, Pollin, Crocus

Covers 49 swaps. zooplus publishes daily product data to Awin affiliates.

1. **Apply**: awin.com as a publisher, then join each advertiser's programme (zooplus DE, zooplus IE, Shop
   Apotheke DE, Pollin Electronic, Crocus). Approval is per advertiser.
2. **Copy from Awin**: Toolbox > **Create-a-Feed**. Pick the advertiser's feed, then these columns:
   `aw_deep_link, merchant_deep_link, product_name, brand_name, merchant_product_id, aw_product_id, search_price,
   currency, ean, product_GTIN, upc, in_stock, stock_status, last_updated, merchant_id, merchant_name`.
   Format CSV, compression **gzip** (or none; zip isn't read). Copy the download address it shows.
3. **Secret line**, one per advertiser and country:

   ```
   awin:zooplus@DE=https://productdata.awin.com/datafeed/download/apikey/...
   awin:zooplus@IE=https://productdata.awin.com/datafeed/download/apikey/...
   awin:shopapotheke@DE=https://...
   awin:pollin@DE=https://...
   awin:crocus@GB=https://...
   ```

   The commas inside an Awin address are fine.
4. **On the server**: `AWIN_PUBLISHER_ID`, and `AFF_ZOOPLUS_DE=1` and so on for each programme (`AFF_POLLIN_DE=1`
   for Pollin, Awin 15965). A product whose newest price came from a feed with a tracked link says it may earn
   even before these are set, because its buy button already goes through the feed's link.

## FlexOffers or Sale Gains: Tesco

Covers 49 Tesco swaps. affi.io lists Tesco Groceries on these two; no product feed was confirmed.

- **FlexOffers**: apply at flexoffers.com, then Tesco's programme. In Data Feeds > Web Services > API Keys, make a
  key and save it as a second secret, **`FLEXOFFERS_API_KEY`**. Add the product feed address for Tesco:

  ```
  flexoffers:tesco@GB=https://...products/full?...
  ```

  FlexOffers only shows its field names to signed-in publishers, so ours are a guess. Run it with Report only
  first (below). If the Sources section says nothing matched, open the address once in a browser, see what the
  fields are called, and set **`PRICE_FEED_COLUMNS`** (next section) for `tesco@GB`.
- **Sale Gains**, or any network without its own reader: use `generic:` and a column map, below.

## CJ and Rakuten

For stores that turn up there later. Lines look like `cj:store@US=<feed download address>` and
`rakuten:store@US=<feed file address>`. If the download needs a user name and password, put them in the address:
`https://user:password@...`. CJ's own field list couldn't be read from here; if a CJ feed matches nothing, set a
column map.

## Another network: a column map

Any CSV, TSV, pipe or semicolon file, or JSON, works with `generic:` and one line in the secret
**`PRICE_FEED_COLUMNS`** saying which column is which:

```
PRICE_FEED_URLS:     generic:tesco@GB=https://network.example/feed.csv
PRICE_FEED_COLUMNS:  tesco@GB: name=Product Name; price=Sale Price|Price; link=Tracking URL; gtin=EAN|UPC; sku=SKU; url=Product URL; stock=Availability; currency=Currency; brand=Brand; updated=Last Updated
```

`name`, `price` and `link` are needed; the rest help. `|` gives alternatives, first non-empty wins. The same line
can also correct one column of a named network (say only `price=...`), and the rest keep their defaults.

## Running it by hand

1. GitHub > **Actions** > **Price watch** > **Run workflow**.
2. Tick **Report only**, choose **feed** under "Which sources", Run. Nothing is changed.
3. Open the run, scroll to its summary. The **Sources** list has one line per feed:
   `feed: awin:zooplus@DE: 48211 rows, 31 of 33 record sides matched (24 by barcode, 7 by store number, 0 by name
   for review), 31 usable`. Problems (an expired address, a missing column) are named there too.
4. If that looks right, run it again without Report only. It opens (or updates) a pull request named
   **Price watch: refreshed prices**.

## Reading the pull request

- **Prices that moved**: applied, each within 35% and still saving 5% or more.
- **Savings under 5%**: records that would stop saving. Not changed; they wait in review.
- **Sent to review**: big moves, other pack sizes, and products matched by name only. Not changed.
- **Out of stock / Back in stock**: what the page will now say.
- **Tracked links**: products whose buy button now goes through the feed.
- **Sources we may use**: ok / unclear / barred before and after counting feeds.

Merge it to publish. A review case: `npx tsx scripts/prices/refresh.ts --accept <id>` once you've checked it, or
`--dismiss <id>`. `/admin` lists the cases and has an **Affiliate price feeds** card per network: set up or not,
last run, rows read, records matched, refreshed and in review, and the last price it gave. The launch checklist
warns when a set-up network hasn't priced anything for 14 days.

`npx tsx scripts/prices/refresh.ts --report` prints the same buckets and feed summary on a computer.

## How products are matched

A wrong match is worse than none, so in this order only: the barcode (the record's `gtin`: EAN-13, UPC-A, EAN-8 or
GTIN-14, compared as GTIN-14); then the store's own product number, read from the link the record already has
(Walmart `/ip/.../<number>`, Target `A-<number>`, zooplus `activeVariant`, Shop Apotheke, Chewy, Tesco, Pollin, Crocus
numbers), or for a German medicine its PZN, against the feed's SKU or its product link; then brand, name and pack
size, only when exactly one row in the whole feed fits, and those always wait for you. A record linked to a store
search page has no number, so it needs a barcode or goes to review. A side priced per wash, per day or per 100 ml
("price per wash" in its name) is never matched: it names a product, not a pack a feed row could be.

Rates on synthetic feeds built from the real catalogue (`npx tsx scripts/prices/feed-report.ts`, 13 Nov 2026):

| Store | Sides | Automatic | Review | None | Wrong |
|---|---:|---:|---:|---:|---:|
| Walmart US (Impact) | 205 | 185 | 5 | 15 | 0 |
| Chewy US (Impact) | 6 | 6 | 0 | 0 | 0 |
| Target US (Impact) | 65 | 64 | 1 | 0 | 0 |
| zooplus DE (Awin) | 25 | 24 | 0 | 1 | 0 |
| zooplus IE (Awin) | 36 | 32 | 4 | 0 | 0 |
| Shop Apotheke DE (Awin) | 5 | 5 | 0 | 0 | 0 |
| Pollin DE (Awin) | 18 | 18 | 0 | 0 | 0 |
| Crocus GB (Awin) | 12 | 12 | 0 | 0 | 0 |
| Tesco GB (FlexOffers) | 42 | 38 | 0 | 4 | 0 |

Read these as a best case. The synthetic feeds assume the merchant's SKU or product link carries the same number
as the store's web address, and that the feed's name holds every word of ours. By barcode alone (if a real feed's
numbers turn out different) the automatic column would be: Walmart 10, Target 16, zooplus DE 20, zooplus IE 11,
Pollin 6, Tesco 8, the rest 0 (13 Nov 2026, after the barcode check below took nine codes that sat on two pack sizes
off zooplus records). Adding barcodes to records is what makes matching robust.

## Barcodes on records

`gtin` on a swap side or kit piece is the pack's GS1 barcode. The catalogue build checks every one:

- **Check digit.** A code that isn't 8, 12, 13 or 14 digits with a valid check digit fails `npm run catalog`
  (`src/lib/gtin.ts`, `src/lib/schema.ts`). Before, a bad code was silently dropped; now it has to be fixed.
- **One code, one pack.** The same code on two sides with the same unit but different sizes fails the build: one
  of them is wrong, and it would take the other pack's price from a feed. The same roll counted in sheets on one
  record and in square metres on another is fine.
- **PZN is not a GTIN.** A German medicine's Pharmazentralnummer goes in `pzn` (8 digits, mod-11 check digit), or
  stays in `license_id` as `PZN 01234567`, where the feed matcher reads it too. Only when the record's own sources
  state it. Never put a PZN in `gtin`.

How a code gets onto a record (never guessed, never from a name search):

1. Candidates come from the record's own Open Facts links: the Open Food Facts record in
   `data/evidence/nutrition.json` and the product page in `data/images.json`, both keyed by brand and product.
2. Each candidate's page on Open Food Facts, Open Beauty Facts, Open Products Facts or Open Pet Food Facts is read
   (ODbL; a barcode is a fact, quoted with the page as its source). It's kept only when the page shows a pack size
   and brand, product and pack size all agree with the record. A page with no pack size, another size ("Advil 360"
   for a 50-tablet record), another flavour or line ("Lemsip Cold and Flu" for "Lemsip Max"), or another country's
   pack (a Dutch Nurofen code for a German record) is left out.
3. `scripts/fetch-images.ts` no longer writes a barcode it found by searching for a name: a search hit names a
   product, not this pack. That is how the codes on two pack sizes got in.

Run on 13 Nov 2026: 65 candidates read, 18 kept (US 12, GB 4, DE 1, IE 1). Taken off: one code that failed its
check digit (an Open Food Facts internal code on Heinz ketchup, US) and nine zooplus codes that sat on two pack sizes
(DE 4, IE 5); one of those was confirmed as the 2 kg bag and kept there. Swap sides with a barcode now:

| Market | Sides | With a barcode | Before |
|---|---:|---:|---:|
| US | 318 | 92 | 80 |
| DE | 366 | 170 (and 74 with a PZN in `license_id`) | 173 |
| GB | 240 | 93 | 89 |
| IE | 36 | 12 | 16 |
| CA | 22 | 0 | 0 |
| Kit pieces (all markets) | 151 | 0 | 0 |

The next barcodes are cheapest from a feed itself: once a network approves us, a row matched by store number
carries the merchant's own EAN, which can be copied to the record after a person checks the pack.

## Saying a link may earn

Whether a buy button may earn is decided per link (`src/lib/disclosure.ts`, `mayEarn` in `src/lib/affiliate.ts`),
with the same choice `/go` makes: it earns when a programme's `AFF_...` setting tags the store link, or when the
side's newest price came from a feed with a tracked link, which `/go` sends shoppers through. Otherwise the page says
we earn nothing from it, in English and German. The footer and `/disclosure` also count feed links: the catalogue
build writes how many there are to `src/generated/feed-links.json`.

## Revenue report

On a computer with the database address, read only:

```
DATABASE_URL=postgres://... npm run report:revenue                    # last 28 days, per week
npm run report:revenue -- --days 14 --by day --top 20
npm run report:revenue -- --exports ~/Downloads/commissions           # Awin or Impact commission CSVs
```

It prints outbound clicks per day or week by store, programme (`walmart-us`, `feed:awin`, or untagged), shopper's
country, page (swap, kit, basket, check, list, other) and swap; then the untagged clicks ranked by store with the
network and sign-up page from `data/sellers/programmes.json`, so the next programme to join is the one at the top.
Earnings per click come from sales joined to clicks by our click ID: postbacks already in the database, and any
commission export dropped as CSV in `reports/commissions/` (ignored by git) or the folder given. An export row wins
over a postback for the same order; declined and reversed sales are left out; currencies are never added together.

- **Exports are untested against real files.** The Awin reader follows the Publisher API transactions fields
  (`clickRef`, `commissionAmount`, `commissionStatus`, ...) and the Impact reader the Partner API Actions fields
  (`SubId1`, `Payout`, `State`, ...), with the dashboards' spaced spellings as aliases. Fixtures written from those
  docs are in `scripts/revenue/fixtures`. A file that matches neither is named in the report, not guessed at.
- **Page type** comes from the click's referrer (the site sends its full address to its own `/go` and `/out`), and
  without one from the link itself: a swap's buy link is only on its swap page, a kit piece's only on its kit page.
  Baskets link to swaps rather than out, so a basket shopper's click counts on the swap page they click from. The
  clicks table already held everything this needs (`program` null means untagged), so there is no migration.
- `npx tsx scripts/revenue/rank-programmes.ts` prints the programme ranking in `docs/research/R9-programmes.md`,
  with each programme's click share when `DATABASE_URL` is set.

## What isn't tested yet

- No real feed from any network has been read. Every reader is tested on a synthetic file written from the network's
  public documentation: Awin (help.awin.com, "hosting feeds", and the PM Feed Column Descriptions), Impact (the
  catalog item object and Catalogs endpoints on integrations.impact.com), Rakuten (its pipe-delimited catalogue
  specification). CJ's and FlexOffers' field names could not be read and are educated guesses.
- Impact's API answering in JSON to `Accept: application/json`, its paging, and Basic auth with the Account SID
  and Auth Token follow its documentation but haven't been called.
- FlexOffers' `apiKey` header is assumed.
- Whether a merchant's SKU equals the number in its web address: unknown until the first feed.
