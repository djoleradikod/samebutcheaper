import { atStore, tagUrl } from "@/lib/affiliate";
import { inSentence, withCelsius } from "@/lib/format";
import type { Local } from "@/lib/localize";
import { Money, UnitAmount } from "./Money";
import type { Pair, ShelfLife } from "@/lib/types";
import { unitDisplay } from "@/lib/unit-format";
import { HEALTH_CATEGORIES } from "./Evidence";
import { citationDate } from "./Finding";
import { SavingsCalculator } from "./SavingsCalculator";

const MEASURE = /^(fl ?oz|oz|ml|cl|l|litre|liter|g|gram|gramme|mg|kg|kilo|kilogram|lb)\b/i;
const GENERIC = /^(count|piece|each|item|unit)$/i;
const DOSE_LIKE = /tablet|caplet|capsule|softgel|gelcap|gumm|lozenge|chewable|pill|dose|spray|patch|packet|sachet|piece|serving|scoop/i;

/** The catalogue strips a trailing "s" from units, which breaks a few words. These put them back. */
const SINGULAR: Record<string, string> = {
  stylu: "stylus",
  glas: "glass",
  gummie: "gummy",
  nappie: "nappy",
  boxe: "box",
  pouche: "pouch",
  brushe: "brush",
  batterie: "battery",
  washe: "wash",
};

function plural(word: string) {
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** How to say the unit in a sentence: "caplet" and "caplets", "oz" and "oz", "serving (5 g)" and "servings (5 g)". */
export function unitWords(unit: string) {
  const raw = unit.trim();
  const one = SINGULAR[raw.toLowerCase()] ?? raw;
  if (MEASURE.test(one) || /^(count|each)$/i.test(one)) return { one, many: one };
  const bracket = one.match(/^([^(]+?)(\s*\(.*\))$/);
  return { one, many: bracket ? `${plural(bracket[1])}${bracket[2]}` : plural(one) };
}

const amount = (n: number) => Number(n.toFixed(2)).toLocaleString("en-US");

/** "225 caplets", "3.74 kg", "1 stylus". */
export function packText(size: number, unit: string) {
  const { one, many } = unitWords(unit);
  return `${amount(size)} ${size === 1 ? one : many}`;
}

/** A charger or a pot: you buy it once, so stocking up and yearly costs mean nothing. */
export function buysOnce(unit: string, size: number) {
  if (MEASURE.test(unit.trim())) return false;
  if (size <= 1) return true;
  return unitDisplay(unit).label === "each" && !GENERIC.test(unit.trim());
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  eighteen: 18,
  twenty: 20,
  thirty: 30,
};
const NUMBER = `\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join("|")}`;
const DURATION = new RegExp(`\\b(${NUMBER})(?:\\s*(?:to|-|\\u2013)\\s*(?:${NUMBER}))?[\\s-]*(year|month|week|day)s?\\b`, "gi");
const MONTHS_IN: Record<string, number> = { year: 12, month: 1, week: 12 / 52, day: 12 / 365 };

/**
 * The shortest time a shelf-life record states, in months. Records are prose and often
 * disagree, so the warning uses the most cautious figure, and says so. Null when the
 * record has no number ("until the date on the tub").
 */
export function shortestMonths(text: string): number | null {
  let shortest: number | null = null;
  for (const m of text.matchAll(DURATION)) {
    const n = NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1]);
    const months = n * MONTHS_IN[m[2].toLowerCase()];
    if (months > 0 && (shortest === null || months < shortest)) shortest = months;
  }
  return shortest;
}

/** The range and starting point for the usage slider. The start only places the thumb. */
function usageRange(size: number, unit: string) {
  const steps = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];
  const step = MEASURE.test(unit.trim()) ? (steps.find((s) => s >= size / 200) ?? 100) : size <= 12 ? 0.25 : 1;
  const min = step;
  const doseLike = DOSE_LIKE.test(unit);
  const max = Math.max(min * 14, doseLike ? Math.min(size, 70) : size);
  // A pack that lasts about two months, or one a day for pills and doses, whichever is less.
  const target = doseLike ? Math.min(7, size / 8) : size / 8;
  const start = Math.min(max, Math.max(min, Number((Math.round(target / step) * step).toFixed(2))));
  return { min, max, step, start };
}

const ADVICE: Record<ShelfLife["advice"], string> = {
  stock_up: "Worth stocking up on. It keeps for years.",
  buy_to_use: "Buy big only if you'll use it in time.",
  buy_small: "Buy small. It goes off or weakens.",
};

function ShelfRecord({ record }: { record: ShelfLife }) {
  const rows = [
    ["Unopened", record.unopened],
    ["Once opened", record.opened],
    ["Storage", withCelsius(record.storage)],
  ].filter(([, text]) => text);
  return (
    <div className="p-4 md:p-5">
      <h3 className="text-base leading-snug">How long it keeps</h3>
      <p className="mt-1.5 text-lg leading-snug font-semibold">{ADVICE[record.advice]}</p>
      <dl className="mt-3 space-y-2.5 text-sm">
        {rows.map(([label, text]) => (
          <div key={label} className="sm:grid sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-3">
            <dt className="font-medium text-ink">{label}</dt>
            <dd className="text-ink-2">{text}</dd>
          </div>
        ))}
      </dl>
      {record.note && <p className="mt-2.5 text-sm text-ink-2">{record.note}</p>}
      <p className="mt-3 text-[13px] text-muted">From our record for {inSentence(record.label)}.</p>
      <ul className="mt-1 flex flex-wrap gap-x-4 text-[13px] font-medium">
        {record.sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              title={s.title}
              className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2 md:min-h-6"
            >
              {s.publisher}, {citationDate(s.date)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakEven({ pair }: { pair: Pair }) {
  const { brand: b, alternative: a, bulkView, currency } = pair;
  const { many } = unitWords(a.unit);
  const units = bulkView.breakEvenUnits;
  const shown = units >= 10 ? Math.round(units) : amount(units);
  const share = Math.min(100, Math.max(1, (units / a.size) * 100));
  return (
    <div className="p-4 md:p-5">
      <h3 className="text-lg leading-snug md:text-[1.375rem]">
        This pack pays for itself after {shown} of {packText(a.size, a.unit)}.
      </h3>
      <div aria-hidden="true" className="mt-3 flex h-2.5 gap-0.5">
        <span className="rounded-l-tile bg-ink" style={{ width: `${share}%` }} />
        <span className="flex-1 rounded-r-tile bg-ticket" />
      </div>
      <p className="mt-2 text-sm text-ink-2">
        At {b.brand}&apos;s unit price, <Money n={a.price} from={currency} prose /> buys {shown} {Number(shown) === 1 ? unitWords(a.unit).one : many}.
        Everything after that in this pack is the saving.
        {a.price > b.price &&
          <>
            {" "}
            You pay <Money n={a.price - b.price} from={currency} prose /> more at the till than for the {b.brand} pack, for {amount(a.size / b.size)} times as much.
          </>}
      </p>
    </div>
  );
}

function BiggerPack({ pair, local }: { pair: Pair; local: Local }) {
  const { brand: b, alternative: a, bulkView, currency } = pair;
  const bigger = bulkView.bigger;
  if (!bigger) return null;
  const { label } = unitDisplay(a.unit);
  const againstBrand = Math.round((1 - bigger.ppu / b.ppu) * 100);
  return (
    <div className="p-4 md:p-5">
      <h3 className="text-base leading-snug">The bigger pack</h3>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2">{bigger.product}</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
            <span className="price text-[1.75rem]"><Money n={bigger.price} from={currency} /></span>
            <span className="text-sm font-medium text-ink-2">{packText(bigger.size, a.unit)}</span>
            <span className="price text-lg"><UnitAmount ppu={bigger.ppu} unit={a.unit} from={currency} /></span>
            <span className="text-[13px] font-medium text-muted">{label}</span>
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            {bigger.extraSavingPct > 0
              ? `${Math.round(bigger.extraSavingPct)}% less ${label} than the ${packText(a.size, a.unit)} pack, and ${againstBrand}% less than ${b.brand}.`
              : `It costs no less ${label} than the ${packText(a.size, a.unit)} pack.`}
          </p>
        </div>
        {local.sells(bigger.retailer, pair.market) && (
          <a
            href={tagUrl(bigger.url)}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="btn btn-ghost w-full sm:w-auto"
          >
            {bigger.retailer === "other" ? "See it online" : `See it ${atStore(bigger.retailer)}`}
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Whether buying more makes sense: when the pack pays for itself, the bigger pack, how long it
 * keeps, and a slider that turns all of that into months and a year's cost.
 */
export function BulkBox({ pair, local, className = "" }: { pair: Pair; local: Local; className?: string }) {
  const { brand: b, alternative: a, bulkView, shelfLife: shelf, currency } = pair;
  const once = buysOnce(a.unit, a.size);
  if (once && !bulkView.bigger && !shelf) return null;
  const { one, many } = unitWords(a.unit);

  return (
    <section aria-labelledby="bulk" className={className}>
      <div className="container-page py-8 md:py-10">
        <h2 id="bulk" className="display text-[22px] md:text-2xl">
          Buying in bulk
        </h2>
        <div className={`mt-4 grid gap-4 lg:gap-6 ${once ? "max-w-3xl" : "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"}`}>
          <div className="card min-w-0 divide-y divide-line self-start">
            {/* A pack that costs less at the till has nothing to pay back. */}
            {!once && a.price > b.price && <BreakEven pair={pair} />}
            <BiggerPack pair={pair} local={local} />
            {shelf ? (
              <ShelfRecord record={shelf} />
            ) : (
              !once && (
                <p className="p-4 text-sm text-ink-2 md:p-5">
                  We have no shelf-life record for this yet. Check the date on the pack before buying a lot.
                </p>
              )
            )}
          </div>
          {!once && (
            <SavingsCalculator
              brandName={b.brand}
              altName={a.brand}
              brandPpu={b.ppu}
              altPpu={a.ppu}
              packSize={a.size}
              biggerSize={bulkView.bigger?.size}
              one={one}
              many={many}
              usage={usageRange(a.size, a.unit)}
              unopenedMonths={shelf ? shortestMonths(shelf.unopened) : null}
              openedMonths={shelf ? shortestMonths(shelf.opened) : null}
              health={HEALTH_CATEGORIES.has(pair.category)}
              currency={currency}
            />
          )}
        </div>
      </div>
    </section>
  );
}
