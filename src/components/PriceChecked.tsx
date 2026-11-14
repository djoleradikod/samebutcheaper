import type { ReactNode } from "react";
import { ageWarning, checkedDate, type Freshness, type PriceSeen } from "@/lib/freshness";
import type { Local } from "@/lib/localize";
import { stockNotes } from "@/lib/stock-notes";
import type { Bundle, Pair } from "@/lib/types";
import { getT, type Lang } from "@/lib/i18n";

/** The warning after an old price's date, in the page's language. */
function warningFor(tier: Freshness["tier"], lang: Lang) {
  const english = ageWarning(tier);
  if (!english || lang === "en") return english;
  return getT(lang)(tier === "stale" ? "prices.stale" : "prices.ageing");
}

/**
 * When a price was checked, to the day, and what its age means for the shopper. Dates come from the price
 * observation log (data/prices, see docs/prices.md). The tier is worked out when the catalogue is built.
 */

function DateLine({ freshness, children, lang }: { freshness: Freshness; children: ReactNode; lang: Lang }) {
  const warning = warningFor(freshness.tier, lang);
  return (
    <>
      <span className="text-[15px] font-medium text-ink-2">{children}</span>
      {warning && <span className="text-[15px] font-semibold text-different">{warning}</span>}
    </>
  );
}

function pairDates(pair: Pair, lang: Lang) {
  const t = getT(lang);
  const b = pair.prices.brand;
  const a = pair.prices.alternative;
  const day = (s: PriceSeen) => checkedDate(s.date, s.precision, lang);
  // A price a store's terms withhold isn't on the page, so its date doesn't read as a shown price's (programme terms).
  const shown = (["alternative", "brand"] as const).filter((s) => !pair.withheld?.[s]);
  if (!shown.length) return t("prices.checkedWithheld", day(b.date >= a.date ? b : a));
  if (shown.length === 1) return t("prices.checkedOne", pair[shown[0]].brand, day(pair.prices[shown[0]]));
  if (day(b) === day(a)) return t("prices.checked", day(b));
  return t("prices.checkedEach", pair.brand.brand, day(b), pair.alternative.brand, day(a));
}

/** The date line above a swap's offers, with the market tag beside it and the price history under it. */
export function PriceChecked({ pair, local, tag }: { pair: Pair; local: Local; tag?: ReactNode }) {
  const sides = [
    { name: pair.alternative.brand, seen: pair.prices.alternative, cheaper: true },
    { name: pair.brand.brand, seen: pair.prices.brand, cheaper: false },
  ];
  const charted = sides.filter((s) => s.seen.history.length >= 2);
  const lang = local.lang;
  return (
    <div className="pb-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <DateLine freshness={pair.freshness} lang={lang}>
          {pairDates(pair, lang)}
        </DateLine>
        {tag}
      </p>
      {stockNotes(pair, lang).map((note) => <p key={note} className="text-[15px] font-semibold text-different">{note}</p>)}
      {charted.length > 0 && (
        <details className="group mt-1">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[13px] font-medium text-cobalt underline underline-offset-2 md:min-h-0">
            {getT(lang)("prices.history")}
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {charted.map((s) => (
              <PriceHistory key={s.name} name={s.name} seen={s.seen} cheaper={s.cheaper} money={(n) => local.money(n, pair.currency)} lang={lang} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/** The "Prices checked" row in a kit's summary: the oldest piece's date sets it. */
export function KitPriceChecked({ bundle, lang = "en" }: { bundle: Bundle; lang?: Lang }) {
  const t = getT(lang);
  const dates = new Set(Object.values(bundle.prices).map((s) => checkedDate(s.date, s.precision)));
  const warning = warningFor(bundle.freshness.tier, lang);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-ink-2">{dates.size > 1 ? t("prices.oldestChecked") : t("prices.pricesChecked")}</dt>
      <dd className="text-[13px] font-medium">
        {checkedDate(bundle.freshness.date, bundle.freshness.precision, lang)}
        {warning && <span className="block font-semibold text-different">{warning}</span>}
        {stockNotes(bundle, lang).map((note) => <span key={note} className="block font-semibold text-different">{note}</span>)}
      </dd>
    </div>
  );
}

const W = 240;
const H = 64;
const PAD = 6;

/** One side's prices over time: a small line with a dot per check, and the same figures as a table for screen readers. */
export function PriceHistory({
  name,
  seen,
  cheaper,
  money,
  lang = "en",
}: {
  name: string;
  seen: PriceSeen;
  cheaper: boolean;
  money: (n: number) => string;
  lang?: Lang;
}) {
  const tr = getT(lang);
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
  const first = checkedDate(points[0].date, points[0].precision, lang);
  const id = `history-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const summary = hi === lo ? tr("prices.everyCheck", money(lo)) : tr("prices.lowHigh", money(lo), money(hi));
  return (
    <figure className="min-w-0">
      <figcaption id={id} className="text-[13px] font-semibold">
        {name}
        <span className="block font-medium text-muted">
          {tr("prices.checksSince", summary, points.length, first)}
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
        <span>{checkedDate(points[points.length - 1].date, points[points.length - 1].precision, lang)}</span>
      </span>
      <table className="sr-only">
        <caption>{tr("prices.pricesWeSaw", name)}</caption>
        <thead>
          <tr>
            <th scope="col">{tr("prices.date")}</th>
            <th scope="col">{tr("prices.price")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.date}-${i}`}>
              <td>{checkedDate(p.date, p.precision, lang)}</td>
              <td>{money(p.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
