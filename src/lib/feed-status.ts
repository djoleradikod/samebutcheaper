/**
 * What the weekly price watch last did with each affiliate feed network. The refresh writes
 * data/prices/feed-runs.json (scripts/prices/feed-runs.ts); /admin shows it and the launch checklist warns from it.
 * The feeds' URLs live in a GitHub secret the site never sees, so this file is how the site knows which networks
 * are set up. It holds counts and labels like "awin:zooplus@DE", never a URL or key.
 */
import { daysBetween } from "./freshness";

export type NetworkRun = {
  /** Feed labels configured on the last run that read this network, e.g. "impact:walmart@US". */
  feeds: string[];
  /** The last day a run read this network (dry runs don't count). */
  lastRun: string;
  /** The newest feed observation from this network in the log, or null if it has never priced anything. */
  lastObservation: string | null;
  rows: number;
  /** Record sides matched, by how. */
  matched: { gtin: number; id: number; name: number };
  /** Records whose price a feed logged or changed on the last run. */
  refreshed: number;
  /** Records the last run sent to review because of this network. */
  review: number;
  outOfStock: number;
  /** Why a feed couldn't be read, if one couldn't. */
  errors: string[];
};

export type LicenceBuckets = { ok: number; unclear: number; barred: number };

export type FeedRuns = {
  /** The day of the last run that wrote this file. */
  updated: string | null;
  networks: Record<string, NetworkRun>;
  licence: { swaps: { verdicts: LicenceBuckets; withFeeds: LicenceBuckets }; kits: { verdicts: LicenceBuckets; withFeeds: LicenceBuckets } } | null;
};

/** The networks docs/feeds.md covers, in the order the owner is likely to join them, with what each one covers. */
export const FEED_NETWORK_INFO: { id: string; name: string; covers: string }[] = [
  { id: "impact", name: "Impact", covers: "Walmart, Chewy, Target" },
  { id: "awin", name: "Awin", covers: "zooplus, Shop Apotheke, Pollin, Crocus" },
  { id: "flexoffers", name: "FlexOffers", covers: "Tesco" },
  { id: "cj", name: "CJ", covers: "stores on CJ" },
  { id: "rakuten", name: "Rakuten", covers: "stores on Rakuten" },
  { id: "generic", name: "Other network (column map)", covers: "any feed with a column map" },
];

/** A configured feed that hasn't priced anything in this many days needs a look. */
export const FEED_SILENT_DAYS = 14;

export function configuredNetworks(runs: FeedRuns) {
  // Configured means read on the latest run: a network dropped from PRICE_FEED_URLS stops counting.
  return Object.entries(runs.networks).filter(([, n]) => runs.updated && n.lastRun === runs.updated && n.feeds.length > 0);
}

/** Configured networks whose feeds have produced no observation in FEED_SILENT_DAYS days. */
export function silentNetworks(runs: FeedRuns, today: string) {
  return configuredNetworks(runs)
    .filter(([, n]) => !n.lastObservation || daysBetween(n.lastObservation, today) > FEED_SILENT_DAYS)
    .map(([id, n]) => ({ id, lastObservation: n.lastObservation, errors: n.errors }));
}

/**
 * The launch checklist's line for price feeds (src/lib/readiness.ts). Optional until a network is set up, since
 * the site works without one; recommended once one is, if it has gone quiet, because then its stores' prices age.
 */
export function feedReadiness(runs: FeedRuns, today: string) {
  const configured = configuredNetworks(runs);
  const silent = silentNetworks(runs, today);
  const names = configured.map(([id, n]) => `${id} (${n.feeds.map((f) => f.split(":")[1]).join(", ")})`);
  return {
    id: "price-feeds",
    label: "Affiliate price feeds",
    level: (silent.length ? "recommended" : "optional") as "recommended" | "optional",
    ok: configured.length > 0 && silent.length === 0,
    detail: !configured.length
      ? "none configured: stores whose terms bar reading their pages keep their hand-checked prices, which age"
      : silent.length
        ? `configured: ${names.join("; ")}. No price in ${FEED_SILENT_DAYS} days from ${silent.map((s) => `${s.id} (last ${s.lastObservation ?? "never"}${s.errors.length ? `; ${s.errors[0]}` : ""})`).join(", ")}`
        : `configured: ${names.join("; ")}, each priced something in the last ${FEED_SILENT_DAYS} days`,
    fix: silent.length
      ? "Open the last Price watch run on GitHub (Actions) and read its Sources section: usually an expired feed URL or key. docs/feeds.md says what to copy again."
      : "When an affiliate network approves the site, add its feed to the PRICE_FEED_URLS secret on GitHub (docs/feeds.md).",
  };
}
