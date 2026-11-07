"use client";

import { useId, useState } from "react";
import { useLocal } from "@/lib/client/country";
import type { Currency } from "@/lib/format";
import { SaveTicket } from "./Ticket";

/** Slider positions. Low usage gets most of the track, because a light user needs the precision. */
const TRACK = 200;
const WEEKS_A_YEAR = 52;
const MONTHS_PER_WEEK = 12 / WEEKS_A_YEAR;

function lasts(weeks: number) {
  if (weeks < 1) return "Under a week";
  if (weeks < 1.5) return "About a week";
  if (weeks < 8) return `About ${Math.round(weeks)} weeks`;
  const months = weeks * MONTHS_PER_WEEK;
  if (months < 1.5) return "About a month";
  if (months < 24) return `About ${Math.round(months)} months`;
  return `About ${Math.round((months / 12) * 2) / 2} years`;
}

function keeps(months: number) {
  const weeks = months / MONTHS_PER_WEEK;
  if (weeks >= 1) return lasts(weeks).toLowerCase();
  const days = Math.max(1, Math.round(weeks * 7));
  return `about ${days} day${days === 1 ? "" : "s"}`;
}

function shelfWarning(months: number, unopened: number | null, opened: number | null, pack: string) {
  if (unopened !== null && months > unopened)
    return `At this rate ${pack} outlasts its shelf life. The shortest figure on file is ${keeps(unopened)} unopened.`;
  if (opened !== null && months > opened)
    return `If ${pack} is one container, it stays open longer than it keeps. The shortest figure on file is ${keeps(opened)} once opened.`;
  return null;
}

/**
 * Units used per week: how long a pack lasts, whether that outlasts its shelf life, and what a
 * year costs on each side. The prices and shelf figures all come from the catalogue.
 */
export function SavingsCalculator({
  brandName,
  altName,
  brandPpu,
  altPpu,
  packSize,
  biggerSize,
  one,
  many,
  usage,
  unopenedMonths,
  openedMonths,
  health = false,
  currency,
}: {
  brandName: string;
  altName: string;
  brandPpu: number;
  altPpu: number;
  /** The cheaper pack, in units. */
  packSize: number;
  biggerSize?: number;
  one: string;
  many: string;
  usage: { min: number; max: number; step: number; start: number };
  /** Shortest figure in the shelf-life record, or null when it gives no usable number. */
  unopenedMonths: number | null;
  openedMonths: number | null;
  health?: boolean;
  currency: Currency;
}) {
  const id = useId();
  const local = useLocal();
  const money = (n: number) => local.money(n, currency);
  const { min, max, step, start } = usage;

  const toValue = (pos: number) => {
    const raw = min + (max - min) * (pos / TRACK) ** 2;
    return Math.min(max, Math.max(min, Number((Math.round(raw / step) * step).toFixed(2))));
  };

  // The thumb keeps its own position, so arrow keys still move it where rounding gives the same value.
  const [pos, setPos] = useState(() => Math.round(TRACK * Math.sqrt((start - min) / (max - min))));
  const perWeek = toValue(pos);
  const word = perWeek === 1 ? one : many;
  const weeks = packSize / perWeek;
  const brandYear = brandPpu * perWeek * WEEKS_A_YEAR;
  const altYear = altPpu * perWeek * WEEKS_A_YEAR;
  const warning =
    shelfWarning(weeks * MONTHS_PER_WEEK, unopenedMonths, openedMonths, "this pack") ??
    (biggerSize
      ? shelfWarning((biggerSize / perWeek) * MONTHS_PER_WEEK, unopenedMonths, openedMonths, "the bigger pack")
      : null);

  return (
    <div className="card min-w-0 p-4 md:p-5">
      <h3 className="text-lg leading-snug">How long a pack lasts you</h3>

      <label htmlFor={id} className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-sm text-ink-2">
        You use
        <output htmlFor={id} className="price text-[1.75rem] text-ink">
          {perWeek.toLocaleString("en-US")}
        </output>
        {word} a week
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={TRACK}
        step={1}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-valuetext={`${perWeek} ${word} a week`}
        className="mt-1 h-11 w-full cursor-pointer accent-[var(--ink)]"
      />

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3">
        <div className={biggerSize ? "" : "col-span-2"}>
          <dt className="text-[13px] font-medium text-muted">{altName} pack lasts</dt>
          <dd className="price mt-1 text-xl">{lasts(weeks)}</dd>
        </div>
        {biggerSize && (
          <div>
            <dt className="text-[13px] font-medium text-muted">Bigger pack lasts</dt>
            <dd className="price mt-1 text-xl">{lasts(biggerSize / perWeek)}</dd>
          </div>
        )}
        <div>
          <dt className="text-[13px] font-medium text-muted">A year of {brandName}</dt>
          <dd className="price mt-1 text-xl font-semibold text-ink-2">{money(brandYear)}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-medium text-muted">A year of {altName}</dt>
          <dd className="price mt-1 text-xl">{money(altYear)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <SaveTicket size="md" amount={brandYear - altYear} currency={currency} sub="a year at this rate" />
      </div>

      <div aria-live="polite">
        {warning && (
          <p className="mt-3 rounded-tile border border-different/30 bg-different-soft px-3 py-2 text-sm font-medium text-different">
            {warning}
          </p>
        )}
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Worked out from the unit prices on this page. Your prices may differ.
        {health && " It only does the sums. For how much to take or use, follow the label."}
      </p>
    </div>
  );
}
