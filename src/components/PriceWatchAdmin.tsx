import Link from "next/link";
import reviewJson from "../../data/prices/review.json";
import feedRunsJson from "../../data/prices/feed-runs.json";
import { getAllBundles, getAllPairs } from "@/lib/catalog";
import { configuredNetworks, FEED_NETWORK_INFO, FEED_SILENT_DAYS, silentNetworks, type FeedRuns, type LicenceBuckets } from "@/lib/feed-status";
import { FRESHNESS_TIERS, TIER_LABEL, type FreshnessTier } from "@/lib/freshness";

/** What data/prices/review.json holds. scripts/prices/refresh.ts validates it before it writes. */
type ReviewCase = {
  id: string;
  created: string;
  record: string;
  kind: "swap" | "kit";
  currency: string;
  reasons: string[];
  detail: string[];
  savingNow: number;
  savingAfter: number;
  changes: { side: string; name: string; from: number; to: number; changePct: number }[];
  observations: { url: string; source: string; seen: string }[];
};

const REASON: Record<string, string> = {
  "big-move": "Price moved more than 35%",
  "saving-gone": "Saving would fall under 5%",
  "pack-mismatch": "Source priced another pack",
  "name-match": "Feed matched by name only",
};

/**
 * Read-only: how current the catalogue's prices are, what each affiliate feed did on the last price watch, and
 * what the price watch couldn't apply on its own. Cases are settled with
 * `npx tsx scripts/prices/refresh.ts --accept <id>` or `--dismiss <id>`. See docs/prices.md and docs/feeds.md.
 */
export function PriceWatchAdmin() {
  const review = reviewJson as { updated: string | null; items: ReviewCase[] };
  const count = (list: { freshness: { tier: FreshnessTier } }[], tier: FreshnessTier) => list.filter((x) => x.freshness.tier === tier).length;
  const pairs = getAllPairs();
  const bundles = getAllBundles();
  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold">Price freshness</h2>
      <p className="mt-1 text-sm text-muted">
        From the oldest side of each record, as of the last catalogue build. Stale records never lead the home page or the top of a list.
      </p>
      <table className="card num mt-3 w-full overflow-hidden text-sm">
        <thead className="bg-surface-2 text-left text-xs text-muted">
          <tr>
            <th className="p-3">Tier</th>
            <th className="p-3 text-right">Swaps</th>
            <th className="p-3 text-right">Kits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {FRESHNESS_TIERS.map((tier) => (
            <tr key={tier}>
              <td className="p-3">
                <span className="font-semibold capitalize">{tier}</span> <span className="text-muted">{TIER_LABEL[tier].toLowerCase()}</span>
              </td>
              <td className="p-3 text-right font-semibold">{count(pairs, tier)}</td>
              <td className="p-3 text-right font-semibold">{count(bundles, tier)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PriceFeeds runs={feedRunsJson as FeedRuns} />

      <h3 className="mt-6 text-lg font-semibold">Prices waiting for review ({review.items.length})</h3>
      <p className="mt-1 text-sm text-muted">
        The price watch left these records as they were.{review.updated ? ` Last case added ${review.updated}.` : ""}
      </p>
      {review.items.length === 0 ? (
        <p className="card mt-3 p-6 text-center text-sm text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="card num w-full min-w-[40rem] overflow-hidden text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="p-3">Record</th>
                <th className="p-3">Why</th>
                <th className="p-3">Price change</th>
                <th className="p-3 text-right">Saving</th>
                <th className="p-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {review.items.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 align-top">
                    <Link href={`/${c.kind === "kit" ? "bundle" : "compare"}/${c.record}`} className="font-medium text-cobalt underline underline-offset-2">
                      {c.record}
                    </Link>
                    <span className="block font-mono text-xs text-muted">{c.id}</span>
                  </td>
                  <td className="p-3 align-top">
                    {c.reasons.map((r) => (
                      <span key={r} className="block font-semibold text-different">
                        {REASON[r] ?? r}
                      </span>
                    ))}
                    <span className="block text-xs text-muted">{c.detail.join("; ")}</span>
                  </td>
                  <td className="p-3 align-top">
                    {c.changes.map((ch) => (
                      <span key={ch.side} className="block">
                        {ch.name}: {c.currency} {ch.from.toFixed(2)} to {ch.to.toFixed(2)} ({ch.changePct > 0 ? "+" : ""}
                        {ch.changePct}%)
                      </span>
                    ))}
                  </td>
                  <td className="p-3 text-right align-top">
                    {c.savingNow}% now
                    <span className="block text-muted">{c.savingAfter}% after</span>
                  </td>
                  <td className="p-3 align-top">
                    {c.observations.map((o) => (
                      <a key={o.url} href={o.url} target="_blank" rel="noopener noreferrer" className="block text-cobalt underline underline-offset-2">
                        {o.source}, {o.seen}
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const buckets = (b: LicenceBuckets) => `${b.ok} ok, ${b.unclear} unclear, ${b.barred} barred`;

/**
 * One card per affiliate network: set up or not, and what the last weekly run did with it. The feed URLs are a
 * GitHub secret this site never sees, so this comes from data/prices/feed-runs.json, which each run writes.
 */
function PriceFeeds({ runs }: { runs: FeedRuns }) {
  const configured = new Set(configuredNetworks(runs).map(([id]) => id));
  // Quiet is judged against the last run's day, not today: this part of the page is built ahead of time.
  const silent = new Set(runs.updated ? silentNetworks(runs, runs.updated).map((s) => s.id) : []);
  return (
    <section aria-labelledby="price-feeds" className="mt-8">
      <h3 id="price-feeds" className="text-lg font-semibold">
        Affiliate price feeds
      </h3>
      <p className="mt-1 text-sm text-muted">
        {runs.updated ? `As of the last price watch run, ${runs.updated}.` : "No run has read a feed yet."} How to add one: docs/feeds.md.
      </p>
      {runs.licence && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Sources we may use.</span> Swaps: {buckets(runs.licence.swaps.withFeeds)} (store terms alone: {buckets(runs.licence.swaps.verdicts)}).
          Kits: {buckets(runs.licence.kits.withFeeds)}.
        </p>
      )}
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {FEED_NETWORK_INFO.map((net) => {
          const n = runs.networks[net.id];
          const on = configured.has(net.id);
          const quiet = silent.has(net.id);
          return (
            <li key={net.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-semibold">
                  {net.name} <span className="font-normal text-muted">{net.covers}</span>
                </p>
                <p className={`font-semibold ${on && !quiet ? "text-same" : on ? "text-different" : "text-muted"}`}>
                  {!on ? "Not set up" : quiet ? `Set up, no price in ${FEED_SILENT_DAYS} days` : "Set up"}
                </p>
              </div>
              {n && (
                <>
                  <p className="mt-1 break-words text-xs text-muted">{n.feeds.join(", ")}</p>
                  <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <Fact label="Last run" value={n.lastRun} />
                    <Fact label="Rows read" value={n.rows.toLocaleString("en-GB")} />
                    <Fact label="Records matched" value={`${n.matched.gtin + n.matched.id + n.matched.name}`} hint={`${n.matched.gtin} barcode, ${n.matched.id} store number, ${n.matched.name} name`} />
                    <Fact label="Records refreshed" value={`${n.refreshed}`} />
                    <Fact label="In review" value={`${n.review}`} />
                    <Fact label="Last price from it" value={n.lastObservation ?? "never"} />
                  </dl>
                  {n.outOfStock > 0 && <p className="mt-2 text-xs">{n.outOfStock} matched side(s) out of stock in the feed.</p>}
                  {n.errors.map((e) => (
                    <p key={e} className="mt-2 text-xs font-semibold text-different">
                      {e}
                    </p>
                  ))}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}
