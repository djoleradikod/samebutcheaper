/**
 * Writes data/prices/feed-runs.json after each real (not dry) run: per network, what was configured, rows read,
 * records matched, refreshed and sent to review, and the newest observation it ever produced. /admin and the
 * launch checklist read it (src/lib/feed-status.ts). Counts and labels only, never a feed URL.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeedRuns, NetworkRun } from "../../src/lib/feed-status";
import type { FeedStats } from "./adapters/feed";
import { feedNetworkOf } from "./attach";
import type { Decision } from "./decide";
import type { LicenceReport } from "./licence";
import { PRICES_DIR, type Observation } from "./observations";

export const FEED_RUNS_FILE = join(PRICES_DIR, "feed-runs.json");

export function readFeedRuns(path = FEED_RUNS_FILE): FeedRuns {
  if (!existsSync(path)) return { updated: null, networks: {}, licence: null };
  return JSON.parse(readFileSync(path, "utf8")) as FeedRuns;
}

export function writeFeedRuns(runs: FeedRuns, path = FEED_RUNS_FILE) {
  writeFileSync(path, JSON.stringify(runs, null, 2) + "\n");
}

/** The newest day each network's feed lines were seen, from the whole log. */
export function lastObservationByNetwork(observations: Observation[]) {
  const out = new Map<string, string>();
  for (const o of observations) {
    if (o.method !== "feed") continue;
    const n = feedNetworkOf(o.source);
    if (o.seen > (out.get(n) ?? "")) out.set(n, o.seen);
  }
  return out;
}

/** This run's numbers merged into what the file held. Networks not configured this run keep their old entry. */
export function mergeFeedRuns(current: FeedRuns, today: string, stats: FeedStats[], decision: Pick<Decision, "observations" | "review">, log: Observation[], licence: LicenceReport | null): FeedRuns {
  const lastSeen = lastObservationByNetwork([...log, ...decision.observations]);
  const networks: Record<string, NetworkRun> = { ...current.networks };
  for (const network of new Set(stats.map((s) => s.network))) {
    const mine = stats.filter((s) => s.network === network);
    const fromNet = (o: Observation) => o.method === "feed" && feedNetworkOf(o.source) === network;
    networks[network] = {
      feeds: mine.map((s) => s.label),
      lastRun: today,
      lastObservation: lastSeen.get(network) ?? null,
      rows: mine.reduce((n, s) => n + s.rows, 0),
      matched: {
        gtin: mine.reduce((n, s) => n + s.matched.gtin, 0),
        id: mine.reduce((n, s) => n + s.matched.id, 0),
        name: mine.reduce((n, s) => n + s.matched.name, 0),
      },
      refreshed: new Set(decision.observations.filter((o) => fromNet(o) && o.stock !== "out").map((o) => o.record)).size,
      review: decision.review.filter((r) => r.observations.some(fromNet)).length,
      outOfStock: mine.reduce((n, s) => n + s.outOfStock, 0),
      errors: mine.filter((s) => s.error).map((s) => `${s.label}: ${s.error}`),
    };
  }
  return { updated: stats.length ? today : current.updated, networks, licence: licence ? { swaps: licence.swaps, kits: licence.kits } : current.licence };
}
