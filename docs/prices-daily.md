# Prices a programme lets us show for 24 hours

Walmart's terms (§8, §13) and Amazon's (Participation Requirements 2(b)) let an affiliate show a price only while it
is at most 24 hours old, and only when it comes from the programme itself (Walmart's feed, Amazon's API). The rules
and the quotes are in docs/research/R11-programme-terms.md; the registry is `data/sellers/programmes.json`.

## What the site does

Two parts, so that neither a late deploy nor a failed one leaves a price up too long.

1. **A price is withheld by itself when its window closes.** The catalogue build records, for every side priced from
   a programme's feed, the moment its reading turns 24 hours old minus one hour (`limited.until`,
   `EXPIRY_MARGIN_MS` in `src/lib/price-expiry.ts`). The running server keeps a price clock
   (`src/lib/server/price-clock.ts`): at start and every 5 minutes it checks whether one of those moments has passed,
   and if so it withholds those sides (`expireCatalog`: no price, no saving, no score, no price sentences, lists
   re-sorted) and asks Next to render every page again (`/api/prices/expired`, a loopback call with a per-process
   token, then `revalidatePath("/", "layout")`). Pages, the search index and share images are all rendered from the
   catalogue view the clock picks, so they change together. A build without any time-limited price starts no clock.
2. **The feed is read and the site rebuilt every day, but only when it has to be.** `scripts/ci/price-schedule.mjs`
   reads the registry and the `PRICE_FEED_URLS` secret, and says "daily" only when a feed line names a store whose
   programme has a `prices.maxAgeHours` rule. The Deploy workflow's schedule fires every day at 06:30 UTC; on a day
   with nothing to refresh it stops after a few seconds and only Monday's run builds, as before. On a daily day the
   image job reads that feed first (`scripts/prices/refresh.ts --only feed`, into this build only; nothing is
   committed), then builds and deploys. A price read at 06:30 shows until about 05:30 the next day, then is withheld
   until the next build replaces it, normally an hour later.

Nothing is fetched until `PRICE_FEED_URLS` is set. Without a feed, Walmart and Amazon prices stay withheld once their
programmes are joined, which is safe.

Before launch, `npm run preflight` (and /admin, /api/health) fails the `daily-prices` check when a joined programme
with a feed rule has no feed line, or when the served build is more than 26 hours old while it shows a time-limited
price. Amazon's rule needs its API, which needs qualifying sales first; until then every Amazon price is withheld, and
the check only notes it.

## What it costs

- **Actions minutes.** One Deploy run a day instead of one a week, each with a feed read (bounded at 20 minutes) and
  the image build. `npm run build` with every programme's rules on took 2 min 23 s here (catalogue and 3,504 pages, on a 4-core machine shared with other jobs); the Docker image build around it adds the dependency install and image layers. GitHub's runners
  differ; read the real figure off the first scheduled runs (Actions > Deploy). On a private repository that is
  minutes billed daily instead of weekly; on a public one it is free.
- **Images.** Each run pushes an image tagged `sha-<commit>-r<run number>`, so a daily build of an unchanged commit is
  still its own image and `rollback` goes back to yesterday's. The server keeps only the two it runs
  (`prune_images`); GHCR keeps every one, so prune old package versions there now and then.
- **The server.** A deploy a day: a pre-deploy backup, migrations (none, usually) and a blue/green switch. The page
  cache starts cold after each deploy.

## Limits

- **Restarts.** The clock starts with the server and moves at once if an expiry has passed while it was down; it
  retries the re-render for up to a minute while the server comes up. A page served in that first minute after a
  restart can show a price the clock has already expired.
- **CDNs.** The re-render reaches pages served by this server. A CDN or proxy in front that caches HTML for longer
  than the 1-hour margin would keep serving the old page; don't cache HTML at the edge beyond a few minutes.
- **The weekly price watch** still keeps the committed record. The daily read applies small moves at once and holds
  big ones for review, as the watch does.
