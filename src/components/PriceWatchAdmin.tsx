import Link from "next/link";
import reviewJson from "../../data/prices/review.json";
import { getAllBundles, getAllPairs } from "@/lib/catalog";
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
};

/**
 * Read-only: how current the catalogue's prices are, and what the weekly price watch couldn't apply on its
 * own. Cases are settled with `npx tsx scripts/prices/refresh.ts --accept <id>` or `--dismiss <id>`. See docs/prices.md.
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
