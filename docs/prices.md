# Prices that stay true

Every price on the site was read by hand in early November 2026. Prices move, and most stores' terms bar
automated reading (`docs/research/R4-source-audit.md`). This is the loop that keeps prices current from
sources we're allowed to use, and tells the shopper honestly how old each one is. No database: the
catalogue and its price log are JSON in git, and every change arrives as a pull request.

## The loop

1. **Observation log** (`data/prices/observations/*.jsonl`). One line per price seen: which record and side,
   price, currency, the day it was seen, the source, a link, and how (`hand`, `open-prices`, `feed`,
   `shopper-report`). Append-only. Format in `data/README.md`, "Price observations". The build validates every
   line and fails on a bad one.
2. **Build** (`npm run catalog`). For each swap side and each kit piece, the date shown is the latest observation
   *at the record's current price*, and the last 12 observations make its history. The record's tier comes from
   its oldest side (`src/lib/freshness.ts`):

   | Tier | Age of the oldest side | On the page | Ranking |
   |---|---|---|---|
   | fresh | 30 days or less | "Prices checked 3 Nov 2026." | full score |
   | recent | 31 to 90 days | the date | full score |
   | ageing | 91 to 180 days | the date and "Checked over 3 months ago, so check the price at the store." | loses up to a quarter, in a straight line |
   | stale | over 180 days | the date and "Checked over 6 months ago, so check the price at the store." | half or less, falling to a tenth at two years; `priceOld`, so never on the home page and always last in its group on lists such as /biggest-savings |

   The tier is worked out when the catalogue is built, so a deploy at least weekly keeps it right. A price with
   no observation at its value (someone edited a record and didn't log it) falls back to the record's
   `price_checked` month, and the build warns.
3. **Refresh** (`npm run prices:refresh`, `scripts/prices/refresh.ts`) asks each source, then decides
   (`scripts/prices/decide.ts`):
   - Same price as the record: logged. The record is now current; its `price_checked` month moves forward
     once every side has been seen in a later month.
   - A new price within 35% of the old one, with the swap still saving 5% or more: the record's price and
     `price_checked` are rewritten in place (a one-line diff in whatever formatting the file uses, checked by
     re-parsing) and the observation is logged.
   - Anything else goes to `data/prices/review.json` and the record is left as it was: a move over 35%, a saving
     that would fall under 5%, or a source that priced a different pack size. A doubtful price isn't logged as
     seen either. The report always has a "Savings under 5%" section, so a swap that stopped saving is never
     kept quietly.
   - An older reading never overrides a newer one, and a reading already in the log is ignored.
4. **Weekly run** (`.github/workflows/price-watch.yml`): Mondays and on demand, on GitHub's runner. It runs the
   refresh, then `npm run catalog` and `npm test`, and opens (or updates) one pull request on the `price-watch`
   branch with the report as its description. If nothing changed it stops. With no feeds configured it reads
   Open Prices alone.
5. **Review**: `/admin` lists the cases and the count of records per tier. Settle a case with
   `npx tsx scripts/prices/refresh.ts --accept <id>` (logs the source's price and applies it, after checking
   the 5% floor again) or `--dismiss <id>`. A pack mismatch can't be accepted: fix the record's pack by hand,
   then log a manual check.

### Why 35%

Shelf prices for the same pack rarely move by a third between weekly reads. When a source says they did, it is
more often a multipack, a promotion, a different size under one barcode, or a wrong match, and a wrong
automatic price is worse than an old one. A person looks at those. Change it with `PRICE_MAX_MOVE` (a fraction).

## Sources, and the rules about them

- **Never fetch a store's own pages.** Not for prices, not to "check". The audit found most of them bar it.
- **Open Prices** (`scripts/prices/adapters/open-prices.ts`): the Open Food Facts project's crowd-sourced price
  log, by barcode, for records with a `gtin`. Licence ODbL 1.0: every observation carries the credit in
  `attribution`. A price counts only when it's at a physical store in the record's market, in its currency,
  seen in the last 60 days (`OPEN_PRICES_MAX_AGE_DAYS`), at full price, with a proof photo or receipt, not a
  duplicate, and at the same chain when the record names one (`scripts/prices/chains.ts`). One request per
  barcode, a second apart (`OPEN_PRICES_DELAY_MS`), with the app named in the User-Agent as Open Food Facts asks.
- **Affiliate feeds** (`scripts/prices/adapters/feed.ts`): price files a merchant publishes for its affiliates,
  which the network's publisher agreement lets us use. A feed only prices records at its own retailer in its own
  market, matched by barcode first (GTIN, EAN, UPC, compared as GTIN-14), then by the merchant's product URL.
  Out-of-stock rows, rows in another currency and rows not updated in 30 days (`PRICE_FEED_MAX_AGE_DAYS`) are skipped.
- **Manual** (`--manual file.csv`): hand checks. Columns `record, side, price, seen, url`, and optionally
  `currency`, `method` (`hand` or `shopper-report`), `source`, `note`. Same rules as any other source.
- A new source needs a licence or agreement that allows reuse, written in its adapter's header and `licence`.

## Adding a feed

`PRICE_FEED_URLS` holds one entry per feed, separated by new lines or commas:

```
[network:]<retailer>@<market>=<url or local path>
awin:boots@GB=https://productdata.awin.com/datafeed/download/apikey/<key>/...
```

`retailer` is an id from `RETAILERS` in `src/lib/markets.ts` and `market` a market code. The network defaults to
`awin`. Feed URLs hold API keys, so they live in a secret and the tool never prints them.

Awin's CSV is read by the columns Awin documents: `search_price` (or `price`), `currency`, `merchant_deep_link`
(or `deep_link`), `product_GTIN`, `ean`, `upc`, `in_stock`, `last_updated`, `merchant_id`, `product_name`. In
Create-a-Feed, pick those columns, CSV format, and gzip or no compression (zip isn't read). To add Impact or CJ,
write a row reader beside `awinRow` and add it to `FEED_FORMATS`.

The Awin test fixture (`scripts/prices/fixtures/awin-feed.synthetic.csv`) is synthetic: made from the documented
column names, with test products, because a real feed needs an approved account. Replace it with a few rows of a
real feed once there is one. The Open Prices fixture is a recorded real response (Nutella 450 g, barcode
4008400401621, 13 Nov 2026), with long tag lists cut to three entries.

## What the owner does once Awin approves

1. In Awin, join each merchant's programme you want prices from (approval is per merchant).
2. Create-a-Feed: choose the merchant's feed, the columns above, CSV, gzip. Copy the download URL.
3. In GitHub, Settings > Secrets and variables > Actions, add a repository secret **`PRICE_FEED_URLS`** with one
   line per feed, for example `awin:boots@GB=<the URL>`.
4. Settings > Actions > General: under "Workflow permissions", allow GitHub Actions to create pull requests.
5. Actions > Price watch > Run workflow, with "Report only" ticked first. Read the summary, then run it for real.

Pull requests opened with the workflow's own token don't start other workflows, so CI doesn't run on them by
itself; the price watch runs the catalogue build and the tests before it opens one. Close and reopen the pull
request to start CI if you want it too.

## Commands

```
npm run prices:refresh                    # every source that's configured
npm run prices:refresh -- --only feed     # one source
npm run prices:refresh -- --dry-run       # report only
npm run prices:refresh -- --manual c.csv  # hand checks
npm run prices:seed                       # back any unlogged price with a hand observation
npx tsx --test scripts/tests/prices.test.ts
```

`prices:seed` filled the log on 13 Nov 2026 from every record. The records kept only a month, so the day is
the day the commit that last wrote that price line was made, when that's inside the record's month; otherwise
the observation keeps the month alone (`"precision": "month"`, dated the 1st) and the page shows the month.
