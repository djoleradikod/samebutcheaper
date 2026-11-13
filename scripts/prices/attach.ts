/**
 * Turns the observation log into what a page shows for one side: the day its current price was last
 * seen, and a short history. Pure, used by scripts/build-catalog.ts and tested in scripts/tests/prices-*.test.ts.
 */
import { HISTORY_POINTS, type PriceSeen } from "../../src/lib/freshness";
import { samePrice, type Observation } from "./observations";

/** "2026-11" -> "2026-11-01"; a full day passes through. */
export function monthStart(priceChecked: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(priceChecked)) return priceChecked;
  const [y, m] = priceChecked.split("-");
  return `${y}-${(m ?? "01").padStart(2, "0")}-01`;
}

export type SideResult = { seen: PriceSeen; problem: string | null };

/**
 * The latest observation at the record's current price sets the date. With none at that price (a hand
 * edit nobody logged), the record's own month stands in, as a month, and the build warns.
 */
export function priceSeenFor(observations: Observation[], currentPrice: number, priceChecked: string): SideResult {
  const sorted = [...observations].sort((a, b) => (a.seen < b.seen ? -1 : a.seen > b.seen ? 1 : 0));
  const matching = sorted.filter((o) => samePrice(o.price, currentPrice));
  const latest = matching.at(-1);
  const points = new Map<string, Observation>();
  for (const o of sorted) points.set(`${o.seen}|${o.price.toFixed(2)}`, o);
  const history = [...points.values()].slice(-HISTORY_POINTS).map((o) => ({ date: o.seen, precision: o.precision, price: o.price, method: o.method, source: o.source }));
  if (!latest) {
    return {
      seen: { date: monthStart(priceChecked), precision: "month", history },
      problem: observations.length
        ? `price ${currentPrice} has no observation at that price (latest logged ${sorted.at(-1)!.price} on ${sorted.at(-1)!.seen})`
        : `no price observation; run npx tsx scripts/prices/seed.ts`,
    };
  }
  const newest = sorted.at(-1)!;
  const problem = !samePrice(newest.price, currentPrice) && newest.seen > latest.seen ? `record shows ${currentPrice} but ${newest.price} was seen later, on ${newest.seen}` : null;
  return { seen: { date: latest.seen, precision: latest.precision, history }, problem };
}
