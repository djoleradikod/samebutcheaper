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
     that would fall under 5%, a source that priced a different pack size, or a feed row matched by name only.
     A doubtful price isn't logged as
     seen either. The report always has a "Savings under 5%" section, so a swap that stopped saving is never
     kept quietly.
   - An older reading never overrides a newer one, and a reading already in the log is ignored.
4. **Weekly run** (`.github/workflows/price-watch.yml`): Mondays and on demand, on GitHub's runner. It runs the
   refresh, then `npm run catalog` and `npm test`, and opens (or updates) one pull request on the `price-watch`
   branch with the report as its description. If nothing changed it stops. With no feeds configured it reads
   Open Prices alone.
5. **Review**: `/admin` lists the cases and the count of records per tier. Settle a case with
   `npx tsx scripts/prices/refresh.ts --accept <id>` (logs the source's price and applies it, after checking
   the 5% floor again; when the source is another store, the side's link and retailer move to it, and anything
   else in the record that names the old store is listed to fix by hand) or `--dismiss <id>`. A pack mismatch can't be accepted: fix the record's pack by hand,
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
  which the network's publisher agreement lets us use. Readers for Impact, Awin, CJ, Rakuten, FlexOffers and any
  CSV or JSON with a column map (`scripts/prices/feeds/formats.ts`), streamed, gzip or plain. A feed only prices
  records at its own retailer in its own market, matched by barcode first (GTIN, EAN, UPC, compared as GTIN-14),
  then by the store's product number read from the record's URL (`scripts/prices/feeds/ids.ts`) or the same
  product page, then by brand, name and pack only when exactly one row fits, and those always go to review
  (`scripts/prices/feeds/match.ts`). Rows in another currency and rows not updated in 30 days
  (`PRICE_FEED_MAX_AGE_DAYS`) are skipped.
  - **Out of stock**: logged with `"stock": "out"`, never used as a price. The side's page says "out of stock at
    the store when its feed was read", and the record is treated like a stale one for leading positions (`priceOld`
    for swaps, a hundredth of the score for kits). The next in-stock row clears it.
  - **Tracked link**: the row's affiliate deep link is logged as `link`. When the newest observation of a side is a
    feed line at the record's price and the link is on the network's click host (`src/lib/feed-links.ts`), `/go/`
    sends the click there, with our click id in the network's sub-id. The `/go/` address doesn't change.
  - **Licence**: a side whose current price came from a feed counts as licensed whatever the store's own terms say
    (`scripts/prices/licence.ts`); the report prints ok / unclear / barred before and after.
- **Manual** (`--manual file.csv`): hand checks. Columns `record, side, price, seen, url`, and optionally
  `currency`, `method` (`hand` or `shopper-report`), `source`, `note`. Same rules as any other source.
- A new source needs a licence or agreement that allows reuse, written in its adapter's header and `licence`.

## Adding a feed

The owner's steps, network by network, are in `docs/feeds.md`. In short, `PRICE_FEED_URLS` holds one entry per
feed, on its own line (a comma also separates entries, but only when the next entry follows it, so the commas in
an Awin download address are safe):

```
[network:]<retailer>@<market>=<url or local path>
awin:zooplus@DE=https://productdata.awin.com/datafeed/download/apikey/<key>/...
impact:walmart@US=https://<sid>:<token>@api.impact.com/Mediapartners/<sid>/Catalogs/<id>/Items
```

`network` is `awin` (the default), `impact`, `cj`, `rakuten`, `flexoffers` or `generic`. `retailer` is an id
from `RETAILERS` in `src/lib/markets.ts` and `market` a market code. Feed URLs hold API keys, so they live in a
secret and the tool never prints them; a user name and password in the URL are sent as Basic auth. Impact's
catalogue API is paged; FlexOffers takes `FLEXOFFERS_API_KEY`. `PRICE_FEED_COLUMNS` corrects a network's column
names, or maps a `generic` feed: `tesco@GB: name=Product Name; price=Sale Price|Price; link=Tracking URL`.

Each run writes what every network did to `data/prices/feed-runs.json` (rows, matches, refreshed, in review,
out of stock, errors, the licence counts), which `/admin` and the launch checklist read. A configured network
that has given no price in 14 days is flagged.

Every reader is tested on a synthetic file written from the network's public documentation
(`scripts/prices/fixtures/feeds/`, and `scripts/prices/fixtures/awin-feed.synthetic.csv`); no real feed has been
read. CJ's and FlexOffers' column names couldn't be confirmed. Replace the fixtures with a few rows of a real
feed once there is one. `scripts/prices/fixtures/make-feed-fixtures.ts` builds feeds from the real catalogue
records (a true row, a decoy pack, fillers) and `scripts/prices/feed-report.ts` prints the match rate per store
against them. The Open Prices fixture is a recorded real response (Nutella 450 g, barcode 4008400401621,
13 Nov 2026), with long tag lists cut to three entries.

Pull requests opened with the workflow's own token don't start other workflows, so CI doesn't run on them by
itself; the price watch runs the catalogue build and the tests before it opens one. Close and reopen the pull
request to start CI if you want it too.

## Commands

```
npm run prices:refresh                    # every source that's configured
npm run prices:refresh -- --only feed     # one source
npm run prices:refresh -- --dry-run       # report only
npm run prices:refresh -- --manual c.csv  # hand checks
npm run prices:refresh -- --report        # buckets, licence counts and feed summary; rewrites feed-runs.json's licence
npx tsx scripts/prices/feed-report.ts     # match rate per store on the synthetic catalogue feeds
npx tsx scripts/prices/fixtures/make-feed-fixtures.ts  # rebuild those feeds from the records
npx tsx --test scripts/tests/feeds.test.ts scripts/tests/feeds-match.test.ts
npm run prices:seed                       # back any unlogged price with a hand observation
npx tsx --test scripts/tests/prices.test.ts
```

`prices:seed` filled the log on 13 Nov 2026 from every record. The records kept only a month, so the day is
the day the commit that last wrote that price line was made, when that's inside the record's month; otherwise
the observation keeps the month alone (`"precision": "month"`, dated the 1st) and the page shows the month.
