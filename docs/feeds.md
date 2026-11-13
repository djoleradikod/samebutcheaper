# Affiliate feeds: from "approved" to fresh prices

Written for a phone. When an affiliate network approves the site, its product feed can keep that store's prices
current, mark what's out of stock, and make the buy buttons earn. You set one secret on GitHub. No code changes.

What a feed does once it's set up, every Monday (or when you run it):

- Prices of matched products are checked against the record. Small moves are applied; big ones wait for you.
- Products the feed lists as out of stock say so on their page and stop leading lists. Prices stay as they were.
- Buy buttons for matched products go through the feed's tracked link. The address on the page (`/go/...`) doesn't
  change.
- A record priced from a feed counts as licensed, so the "barred" count in `/admin` goes down.

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
4. **On the server**: `AWIN_PUBLISHER_ID`, and `AFF_ZOOPLUS_DE=1` and so on for each programme (Pollin has no
   programme entry in `src/lib/affiliate-programs.ts` yet: its links will earn through the feed, but its pages
   won't say so until one is added).

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

A wrong match is worse than none, so in this order only: the barcode (GTIN, EAN, UPC); then the store's own
product number, read from the link the record already has (Walmart `/ip/.../<number>`, Target `A-<number>`, zooplus
`activeVariant`, Shop Apotheke, Chewy, Tesco, Pollin, Crocus numbers), against the feed's SKU or its product link;
then brand, name and pack size, only when exactly one row in the whole feed fits, and those always wait for you.
A record linked to a store search page has no number, so it needs a barcode or goes to review.

Rates on synthetic feeds built from the real catalogue (`npx tsx scripts/prices/feed-report.ts`, 13 Nov 2026):

| Store | Sides | Automatic | Review | None | Wrong |
|---|---:|---:|---:|---:|---:|
| Walmart US (Impact) | 205 | 186 | 4 | 15 | 0 |
| Chewy US (Impact) | 6 | 6 | 0 | 0 | 0 |
| Target US (Impact) | 65 | 64 | 1 | 0 | 0 |
| zooplus DE (Awin) | 25 | 24 | 0 | 1 | 0 |
| zooplus IE (Awin) | 36 | 34 | 2 | 0 | 0 |
| Shop Apotheke DE (Awin) | 5 | 5 | 0 | 0 | 0 |
| Pollin DE (Awin) | 18 | 18 | 0 | 0 | 0 |
| Crocus GB (Awin) | 12 | 12 | 0 | 0 | 0 |
| Tesco GB (FlexOffers) | 42 | 38 | 0 | 4 | 0 |

Read these as a best case. The synthetic feeds assume the merchant's SKU or product link carries the same number
as the store's web address, and that the feed's name holds every word of ours. By barcode alone (if a real feed's
numbers turn out different) the automatic column would be: Walmart 11, Target 16, zooplus DE 24, zooplus IE 16,
Pollin 6, Tesco 8, the rest 0. Adding barcodes to records is what makes matching robust.

## What isn't tested yet

- No real feed from any network has been read. Every reader is tested on a synthetic file written from the network's
  public documentation: Awin (help.awin.com, "hosting feeds", and the PM Feed Column Descriptions), Impact (the
  catalog item object and Catalogs endpoints on integrations.impact.com), Rakuten (its pipe-delimited catalogue
  specification). CJ's and FlexOffers' field names could not be read and are educated guesses.
- Impact's API answering in JSON to `Accept: application/json`, its paging, and Basic auth with the Account SID
  and Auth Token follow its documentation but haven't been called.
- FlexOffers' `apiKey` header is assumed.
- Whether a merchant's SKU equals the number in its web address: unknown until the first feed.
