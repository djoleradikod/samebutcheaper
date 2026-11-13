/**
 * How old a price is, and what that does to a swap. Pure, so the catalogue build, the pages and the
 * tests share one rule. See docs/prices.md.
 *
 * A record's tier comes from its OLDEST side: a swap is only as current as the price we checked longest ago.
 */

import type { FeedInfo } from "./feed-links";

export const FRESHNESS_TIERS = ["fresh", "recent", "ageing", "stale"] as const;
export type FreshnessTier = (typeof FRESHNESS_TIERS)[number];

/** Upper bound in days for each tier. Anything over the last one is stale. */
export const TIER_DAYS = { fresh: 30, recent: 90, ageing: 180 } as const;

/** "day" when we know the day the price was seen; "month" for older records that only kept a month. */
export type DatePrecision = "day" | "month";

/** One price we saw, for the history view. */
export type PricePoint = { date: string; precision: DatePrecision; price: number; method: string; source: string };

/** What the build attaches to one side (or one kit piece): the day its current price was last seen, and its history. */
export type PriceSeen = {
  /** ISO day. With precision "month" it's the first of that month, the earliest it could have been. */
  date: string;
  precision: DatePrecision;
  /** Oldest first, at most HISTORY_POINTS. */
  history: PricePoint[];
  /**
   * Set when the side's newest reading came from an affiliate feed (docs/feeds.md): the price is licensed, /go
   * uses the feed's tracked link, and a feed that lists it out of stock says so on the page.
   */
  feed?: FeedInfo;
};

export type Freshness = {
  tier: FreshnessTier;
  /** The oldest side's date, which sets the tier. */
  date: string;
  precision: DatePrecision;
  /** Days between that date and the day the catalogue was built. */
  days: number;
};

export const HISTORY_POINTS = 12;

const DAY_MS = 86_400_000;

function dayNumber(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / DAY_MS);
}

/** Whole days from `from` to `to`, both ISO days. Never negative: a date in the future counts as today. */
export function daysBetween(from: string, to: string) {
  return Math.max(0, dayNumber(to) - dayNumber(from));
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function tierFor(days: number): FreshnessTier {
  if (days <= TIER_DAYS.fresh) return "fresh";
  if (days <= TIER_DAYS.recent) return "recent";
  if (days <= TIER_DAYS.ageing) return "ageing";
  return "stale";
}

/** The tier of a record from its sides' dates: the oldest side decides. */
export function freshnessOf(sides: { date: string; precision: DatePrecision }[], today: string): Freshness {
  const oldest = [...sides].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[0];
  if (!oldest) return { tier: "stale", date: today, precision: "month", days: 9999 };
  const days = daysBetween(oldest.date, today);
  // A month-only date is stored as the 1st, so it's never called fresher than its month allows.
  const precision = sides.some((s) => s.date === oldest.date && s.precision === "month") ? "month" : "day";
  return { tier: tierFor(days), date: oldest.date, precision, days };
}

/**
 * What a price's age does to a ranking score, from 1 down. Fresh and recent prices keep their score.
 * Ageing ones lose up to a quarter, in a straight line from day 90 to day 180. Stale ones start at half and
 * keep falling to a floor of a tenth at two years, so an old price sinks under every current one of similar size.
 */
export function freshnessWeight(days: number) {
  if (days <= TIER_DAYS.recent) return 1;
  if (days <= TIER_DAYS.ageing) return 1 - (0.25 * (days - TIER_DAYS.recent)) / (TIER_DAYS.ageing - TIER_DAYS.recent);
  return Math.max(0.1, 0.5 - (0.4 * (days - TIER_DAYS.ageing)) / (730 - TIER_DAYS.ageing));
}

/** A stale price never leads the home page or the top of a ranked list. */
export function canLead(tier: FreshnessTier) {
  return tier !== "stale";
}

/** Sort helper for ranked lists: anything that can lead goes ahead of anything that can't, otherwise no opinion. */
export function leadFirst(a: { stale?: boolean }, b: { stale?: boolean }) {
  return Number(Boolean(a.stale)) - Number(Boolean(b.stale));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "3 Nov 2026", or "November 2026" when we only know the month. */
export function checkedDate(date: string, precision: DatePrecision) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m) return date;
  return precision === "month" || !d ? `${LONG_MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The warning that goes after the date once a price is old enough to doubt. Null while it's current. */
export function ageWarning(tier: FreshnessTier) {
  if (tier === "ageing") return "Checked over 3 months ago, so check the price at the store.";
  if (tier === "stale") return "Checked over 6 months ago, so check the price at the store.";
  return null;
}

export const TIER_LABEL: Record<FreshnessTier, string> = {
  fresh: "Checked in the last 30 days",
  recent: "Checked 1 to 3 months ago",
  ageing: "Checked 3 to 6 months ago",
  stale: "Checked over 6 months ago",
};

/** The sides a feed last listed as out of stock. Such a record keeps its page but never leads, like a stale one. */
export function outOfStockSides(prices: Record<string, PriceSeen>) {
  return Object.entries(prices)
    .filter(([, s]) => s.feed?.stock === "out")
    .map(([side, s]) => ({ side, seen: s.feed!.seen }));
}

/** A stale price or an out-of-stock listing: either keeps a record off the home page and the top of lists. */
export function priceDoubtful(freshness: Freshness, prices: Record<string, PriceSeen>) {
  return freshness.tier === "stale" || outOfStockSides(prices).length > 0;
}

/** "Out of stock at Walmart when its product feed was read on 12 Nov 2026." for one side, or null. */
export function stockNote(seen: PriceSeen | undefined, name: string, store: string) {
  if (seen?.feed?.stock !== "out") return null;
  return `${name} was out of stock at ${store} when its product feed was read on ${checkedDate(seen.feed.seen, "day")}.`;
}
