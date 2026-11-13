/**
 * Turns the observation log into what a page shows for one side: the day its current price was last
 * seen, a short history, and, when its newest reading came from an affiliate feed, the feed's tracked link and
 * stock. Pure, used by scripts/build-catalog.ts and tested in scripts/tests/prices*.test.ts and feeds*.test.ts.
 */
import { feedLinkNetwork, type FeedInfo } from "../../src/lib/feed-links";
import { HISTORY_POINTS, type PriceSeen } from "../../src/lib/freshness";
import { samePrice, type Observation } from "./observations";

/** "2026-11" -> "2026-11-01"; a full day passes through. */
export function monthStart(priceChecked: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(priceChecked)) return priceChecked;
  const [y, m] = priceChecked.split("-");
  return `${y}-${(m ?? "01").padStart(2, "0")}-01`;
}

export type SideResult = { seen: PriceSeen; problem: string | null };

const bySeen = (a: Observation, b: Observation) => (a.seen < b.seen ? -1 : a.seen > b.seen ? 1 : a.logged < b.logged ? -1 : a.logged > b.logged ? 1 : 0);

/** "feed:awin" -> "awin"; lines from before the feed: prefix ("awin:9999") give their network too. */
export function feedNetworkOf(source: string) {
  return source.startsWith("feed:") ? source.slice(5).split(":")[0] : source.split(":")[0];
}

/**
 * The feed facts for a side, from its newest line, when that line came from a feed. A hand check or another
 * source read later wins: the record may have moved store since, and the feed's link would then be wrong.
 */
export function feedInfoFor(observations: Observation[], currentPrice: number): FeedInfo | undefined {
  const newest = [...observations].sort(bySeen).at(-1);
  if (!newest || newest.method !== "feed") return undefined;
  // An in-stock line at another price never reached the log unreviewed; if one did, the record wasn't updated to it.
  if (newest.stock !== "out" && !samePrice(newest.price, currentPrice)) return undefined;
  return {
    network: feedNetworkOf(newest.source),
    ...(newest.link && feedLinkNetwork(newest.link) ? { link: newest.link } : {}),
    seen: newest.seen,
    stock: newest.stock ?? "unknown",
  };
}

/**
 * The latest observation at the record's current price sets the date. With none at that price (a hand
 * edit nobody logged), the record's own month stands in, as a month, and the build warns. An out-of-stock
 * reading says nothing about the price, so it never dates one.
 */
export function priceSeenFor(observations: Observation[], currentPrice: number, priceChecked: string): SideResult {
  const feed = feedInfoFor(observations, currentPrice);
  const priced = observations.filter((o) => o.stock !== "out");
  const sorted = [...priced].sort(bySeen);
  const matching = sorted.filter((o) => samePrice(o.price, currentPrice));
  const latest = matching.at(-1);
  const points = new Map<string, Observation>();
  for (const o of sorted) points.set(`${o.seen}|${o.price.toFixed(2)}`, o);
  const history = [...points.values()].slice(-HISTORY_POINTS).map((o) => ({ date: o.seen, precision: o.precision, price: o.price, method: o.method, source: o.source }));
  if (!latest) {
    return {
      seen: { date: monthStart(priceChecked), precision: "month", history, ...(feed ? { feed } : {}) },
      problem: priced.length
        ? `price ${currentPrice} has no observation at that price (latest logged ${sorted.at(-1)!.price} on ${sorted.at(-1)!.seen})`
        : `no price observation; run npx tsx scripts/prices/seed.ts`,
    };
  }
  const newest = sorted.at(-1)!;
  const problem = !samePrice(newest.price, currentPrice) && newest.seen > latest.seen ? `record shows ${currentPrice} but ${newest.price} was seen later, on ${newest.seen}` : null;
  return { seen: { date: latest.seen, precision: latest.precision, history, ...(feed ? { feed } : {}) }, problem };
}
