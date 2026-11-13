/**
 * What a refresh does with the prices its sources found. Pure: records, candidates and the log in;
 * file edits, new observations and review cases out. A wrong automatic price is worse than an old one, so
 * anything doubtful goes to review and leaves the record as it was.
 *
 * - The same price as the record: logged, which makes the record current. Nothing else changes.
 * - A new price within MAX_MOVE of the old, with the swap still saving MIN_SAVING or more: the record's
 *   price and price_checked are rewritten in place.
 * - Anything else goes to data/prices/review.json: a bigger move (more often a multipack, a promotion or a
 *   wrong match than a real price change), a saving under 5% (the build would drop the swap, so a person
 *   decides), or a pack size that isn't the record's.
 */
import { createHash } from "node:crypto";
import type { ValueEdit } from "./json-edit";
import { observationKey, samePrice, type Method, type Observation } from "./observations";
import { savingPct, type PricedRecord, type PricedSide } from "./records";
import type { Candidate } from "./adapters/types";

/** Real shelf prices rarely move by a third between weekly reads; bigger jumps are usually a wrong match. */
export const MAX_MOVE = 0.35;
/** The catalogue's own floor (build-catalog.ts rejects a swap under it). */
export const MIN_SAVING = 5;

export type DecideOptions = { today: string; maxMove?: number; minSaving?: number };

export type PriceChange = {
  record: string;
  kind: PricedRecord["kind"];
  side: string;
  name: string;
  currency: string;
  from: number;
  to: number;
  changePct: number;
  source: string;
  seen: string;
};

export const REVIEW_REASONS = ["big-move", "saving-gone", "pack-mismatch"] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export type ReviewItem = {
  id: string;
  created: string;
  record: string;
  kind: PricedRecord["kind"];
  market: string;
  currency: string;
  reasons: ReviewReason[];
  /** Plain words for each reason, for the admin page and the pull request. */
  detail: string[];
  savingNow: number;
  savingAfter: number;
  changes: { side: string; name: string; from: number; to: number; changePct: number }[];
  /** What the sources reported. `refresh.ts --accept <id>` logs these and applies the prices. */
  observations: Observation[];
};

export type RecordUpdate = { record: PricedRecord; edits: ValueEdit[]; changes: PriceChange[] };

export type Decision = {
  updates: RecordUpdate[];
  /** Lines to add to the log: confirmations and applied prices. Never a price that went to review. */
  observations: Observation[];
  review: ReviewItem[];
  /** Sides whose price a source confirmed unchanged. */
  confirmed: number;
};

const METHOD_RANK: Record<Method, number> = { hand: 0, "shopper-report": 1, feed: 2, "open-prices": 3 };

/** Grams or millilitres for units that convert; null for counts and anything else. */
const TO_BASE: Record<string, [string, number]> = {
  g: ["g", 1],
  gram: ["g", 1],
  kg: ["g", 1000],
  oz: ["g", 28.3495],
  lb: ["g", 453.592],
  ml: ["ml", 1],
  cl: ["ml", 10],
  l: ["ml", 1000],
  litre: ["ml", 1000],
  liter: ["ml", 1000],
  "fl oz": ["ml", 29.5735],
};

function base(size: number, unit: string): [string, number] | null {
  const u = unit.toLowerCase().trim().replace(/\.$/, "").replace(/s$/, "");
  const f = TO_BASE[u];
  return f ? [f[0], size * f[1]] : null;
}

/** True when a source names a pack that's measurably not the record's (more than 2% apart in the same dimension). */
export function packMismatch(side: Pick<PricedSide, "size" | "unit">, pack: Candidate["pack"]) {
  if (!pack) return false;
  const a = base(side.size, side.unit);
  const b = base(pack.size, pack.unit);
  if (!a || !b || a[0] !== b[0]) return false;
  return Math.abs(a[1] - b[1]) / a[1] > 0.02;
}

export function toObservation(c: Candidate, today: string): Observation {
  return {
    record: c.record,
    side: c.side,
    price: Math.round(c.price * 100) / 100,
    currency: c.currency as Observation["currency"],
    seen: c.seen,
    precision: "day",
    source: c.source,
    url: c.url,
    method: c.method,
    logged: today,
    ...(c.attribution ? { attribution: c.attribution } : {}),
    ...(c.note ? { note: c.note } : {}),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The latest day each side's current price was seen, after this run. The oldest of those is the record's date. */
export function checkedMonth(record: PricedRecord, log: Map<string, Observation[]>, extra: Observation[], prices: Map<string, number>) {
  let oldest: string | null = null;
  for (const s of record.sides) {
    const price = prices.get(s.side) ?? s.price;
    const all = [...(log.get(`${record.slug}|${s.side}`) ?? []), ...extra.filter((o) => o.side === s.side)].filter((o) => samePrice(o.price, price));
    if (!all.length) return null; // a side with no observation: leave price_checked as it is
    const latest = all.reduce((d, o) => (o.seen > d ? o.seen : d), "");
    if (oldest === null || latest < oldest) oldest = latest;
  }
  return oldest?.slice(0, 7) ?? null;
}

export function reviewId(record: string, observations: Observation[]) {
  return createHash("sha1")
    .update([record, ...observations.map(observationKey)].join("\n"))
    .digest("hex")
    .slice(0, 10);
}

export function decide(records: PricedRecord[], candidates: Candidate[], existing: Observation[], opts: DecideOptions): Decision {
  const maxMove = opts.maxMove ?? MAX_MOVE;
  const minSaving = opts.minSaving ?? MIN_SAVING;
  const known = new Set(existing.map(observationKey));
  const log = new Map<string, Observation[]>();
  for (const o of existing) log.set(`${o.record}|${o.side}`, [...(log.get(`${o.record}|${o.side}`) ?? []), o]);
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const decision: Decision = { updates: [], observations: [], review: [], confirmed: 0 };

  const grouped = new Map<string, Map<string, Candidate[]>>();
  for (const c of candidates) {
    const record = bySlug.get(c.record);
    const side = record?.sides.find((s) => s.side === c.side);
    if (!record || !side || c.currency !== record.currency) continue; // adapters check this too; money is checked twice
    if (known.has(observationKey(toObservation(c, opts.today)))) continue; // already logged on an earlier run
    // An older reading never overrides a newer one.
    const latestLogged = (log.get(`${c.record}|${c.side}`) ?? []).reduce((d, o) => (o.seen > d ? o.seen : d), "");
    if (c.seen < latestLogged) continue;
    const sides = grouped.get(c.record) ?? new Map<string, Candidate[]>();
    sides.set(c.side, [...(sides.get(c.side) ?? []), c]);
    grouped.set(c.record, sides);
  }

  for (const [slug, sides] of grouped) {
    const record = bySlug.get(slug)!;
    const chosen = new Map<string, Candidate>();
    for (const [side, list] of sides) {
      // The newest reading, and on the same day a person's over a feed's over the crowd's.
      const best = [...list].sort((a, b) => (a.seen !== b.seen ? (a.seen < b.seen ? 1 : -1) : METHOD_RANK[a.method] - METHOD_RANK[b.method]))[0];
      chosen.set(side, best);
    }
    const reasons = new Set<ReviewReason>();
    const detail: string[] = [];
    const newPrices = new Map<string, number>();
    const changes: ReviewItem["changes"] = [];
    const confirmations: Observation[] = [];
    for (const s of record.sides) {
      const c = chosen.get(s.side);
      if (!c) continue;
      if (packMismatch(s, c.pack)) {
        reasons.add("pack-mismatch");
        detail.push(`${s.name}: the source priced a ${c.pack!.size} ${c.pack!.unit} pack, the record is ${s.size} ${s.unit}`);
        continue;
      }
      if (samePrice(c.price, s.price)) {
        confirmations.push(toObservation(c, opts.today));
        continue;
      }
      const changePct = round1(((c.price - s.price) / s.price) * 100);
      newPrices.set(s.side, Math.round(c.price * 100) / 100);
      changes.push({ side: s.side, name: s.name, from: s.price, to: Math.round(c.price * 100) / 100, changePct });
      if (Math.abs(c.price - s.price) / s.price > maxMove) {
        reasons.add("big-move");
        detail.push(`${s.name}: ${s.price} to ${c.price} (${changePct > 0 ? "+" : ""}${changePct}%), more than ${Math.round(maxMove * 100)}%`);
      }
    }
    const savingNow = round1(savingPct(record));
    const savingAfter = round1(savingPct(record, newPrices));
    if (newPrices.size && savingAfter < minSaving) {
      reasons.add("saving-gone");
      detail.push(`the swap would save ${savingAfter}%, under the ${minSaving}% floor`);
    }
    decision.confirmed += confirmations.length;
    decision.observations.push(...confirmations);

    if (reasons.size) {
      const observations = [...chosen.values()].filter((c) => !confirmations.some((o) => o.side === c.side)).map((c) => toObservation(c, opts.today));
      decision.review.push({
        id: reviewId(slug, observations),
        created: opts.today,
        record: slug,
        kind: record.kind,
        market: record.market,
        currency: record.currency,
        reasons: [...reasons],
        detail,
        savingNow,
        savingAfter,
        changes,
        observations,
      });
      continue;
    }
    const applied = [...newPrices.keys()].map((side) => toObservation(chosen.get(side)!, opts.today));
    decision.observations.push(...applied);
    const edits: ValueEdit[] = [...newPrices].map(([side, price]) => {
      const s = record.sides.find((x) => x.side === side)!;
      return { path: [...s.path, s.priceKey], value: price };
    });
    const month = checkedMonth(record, log, [...confirmations, ...applied], newPrices);
    if (month && month > record.priceChecked.slice(0, 7)) edits.push({ path: [record.index, "price_checked"], value: month });
    if (!edits.length) continue;
    decision.updates.push({
      record,
      edits,
      changes: changes.map((ch) => {
        const c = chosen.get(ch.side)!;
        return { record: slug, kind: record.kind, side: ch.side, name: ch.name, currency: record.currency, from: ch.from, to: ch.to, changePct: ch.changePct, source: c.source, seen: c.seen };
      }),
    });
  }
  return decision;
}
