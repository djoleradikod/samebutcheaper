import type { ReactNode } from "react";
import { ageWarning, checkedDate, type Freshness, type PriceSeen } from "@/lib/freshness";
import type { Local } from "@/lib/localize";
import type { Bundle, Pair } from "@/lib/types";

/**
 * When a price was checked, to the day, and what its age means for the shopper. Dates come from the price
 * observation log (data/prices, see docs/prices.md). The tier is worked out when the catalogue is built.
 */

function DateLine({ freshness, children }: { freshness: Freshness; children: ReactNode }) {
  const warning = ageWarning(freshness.tier);
  return (
    <>
      <span className="text-[15px] font-medium text-ink-2">{children}</span>
      {warning && <span className="text-[15px] font-semibold text-different">{warning}</span>}
    </>
  );
}

function pairDates(pair: Pair) {
  const b = pair.prices.brand;
  const a = pair.prices.alternative;
  const day = (s: PriceSeen) => checkedDate(s.date, s.precision);
  if (day(b) === day(a)) return `Prices checked ${day(b)}.`;
  return `${pair.brand.brand} price checked ${day(b)}, ${pair.alternative.brand} ${day(a)}.`;
}

/** The date line above a swap's offers, with the market tag beside it and the price history under it. */
export function PriceChecked({ pair, local, tag }: { pair: Pair; local: Local; tag?: ReactNode }) {
  const sides = [
    { name: pair.alternative.brand, seen: pair.prices.alternative, cheaper: true },
    { name: pair.brand.brand, seen: pair.prices.brand, cheaper: false },
  ];
  const charted = sides.filter((s) => s.seen.history.length >= 2);
  return (
    <div className="pb-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <DateLine freshness={pair.freshness}>{pairDates(pair)}</DateLine>
        {tag}
      </p>
      {charted.length > 0 && (
        <details className="group mt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[13px] font-medium text-cobalt underline underline-offset-2 md:min-h-0">
            Price history
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {charted.map((s) => (
              <PriceHistory key={s.name} name={s.name} seen={s.seen} cheaper={s.cheaper} money={(n) => local.money(n, pair.currency)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The "Prices checked" row in a kit's summary: the oldest piece's date sets it. */
export function KitPriceChecked({ bundle }: { bundle: Bundle }) {
  const dates = new Set(Object.values(bundle.prices).map((s) => checkedDate(s.date, s.precision)));
  const warning = ageWarning(bundle.freshness.tier);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-ink-2">{dates.size > 1 ? "Oldest price checked" : "Prices checked"}</dt>
      <dd className="text-[13px] font-medium">
        {checkedDate(bundle.freshness.date, bundle.freshness.precision)}
        {warning && <span className="block font-semibold text-different">{warning}</span>}
      </dd>
    </div>
  );
}

const W = 240;
const H = 64;
const PAD = 6;

/** One side's prices over time: a small line with a dot per check, and the same figures as a table for screen readers. */
export function PriceHistory({ name, seen, cheaper, money }: { name: string; seen: PriceSeen; cheaper: boolean; money: (n: number) => string }) {
  const points = seen.history;
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const t = points.map((p) => Date.parse(`${p.date}T00:00:00Z`));
  const t0 = t[0];
  const span = t[t.length - 1] - t0 || 1;
  const x = (i: number) => PAD + ((t[i] - t0) / span) * (W - 2 * PAD);
  const y = (price: number) => (hi === lo ? H / 2 : PAD + (1 - (price - lo) / (hi - lo)) * (H - 2 * PAD));
  const coords = points.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const first = checkedDate(points[0].date, points[0].precision);
  const id = `history-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const summary = hi === lo ? `${money(lo)} at every check` : `Low ${money(lo)}, high ${money(hi)}`;
  return (
    <figure className="min-w-0">
      <figcaption id={id} className="text-[13px] font-semibold">
        {name}
        <span className="block font-medium text-muted">
          {summary}, {points.length} checks since {first}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={`mt-1 h-auto w-60 max-w-full ${cheaper ? "text-cobalt" : "text-ink-2"}`}
        role="img"
        aria-labelledby={id}
      >
        <line x1={PAD} x2={W - PAD} y1={H - 1} y2={H - 1} stroke="var(--line-strong)" strokeWidth="1" />
        <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(i)} cy={y(p.price)} r="3" fill="currentColor" />
        ))}
      </svg>
      <span className="flex w-60 max-w-full justify-between text-xs text-muted" aria-hidden="true">
        <span>{first}</span>
        <span>{checkedDate(points[points.length - 1].date, points[points.length - 1].precision)}</span>
      </span>
      <table className="sr-only">
        <caption>{name}: prices we saw</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.date}-${i}`}>
              <td>{checkedDate(p.date, p.precision)}</td>
              <td>{money(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
