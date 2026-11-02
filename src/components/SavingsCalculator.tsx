"use client";

import { useId, useState } from "react";
import { money as fmt, type Currency } from "@/lib/format";

export function SavingsCalculator({
  brandPpu,
  altPpu,
  unit,
  defaultMonthly,
  currency = "USD",
}: {
  brandPpu: number;
  altPpu: number;
  unit: string;
  defaultMonthly: number;
  currency?: Currency;
}) {
  const id = useId();
  const money = (n: number) => fmt(n, currency);
  const [monthly, setMonthly] = useState(() => Math.max(1, Math.round(defaultMonthly)));
  const diff = Math.max(0, brandPpu - altPpu);
  const yearly = diff * monthly * 12;
  const fiveYear = yearly * 5;
  const max = Math.max(60, Math.round(defaultMonthly * 4));

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">What would you save?</h2>
      <label htmlFor={id} className="mt-4 block text-sm text-ink-2">
        I use about{" "}
        <input
          type="number"
          min={1}
          max={100000}
          value={monthly}
          onChange={(e) => setMonthly(Math.max(0, Number(e.target.value) || 0))}
          className="num mx-1 w-24 rounded-lg border border-line-strong bg-paper px-2 py-1 text-center font-semibold text-ink focus:border-accent focus:outline-none"
          aria-label={`${unit} per month`}
        />{" "}
        {unit}
        {monthly === 1 ? "" : "s"} a month
      </label>
      <input
        id={id}
        type="range"
        min={1}
        max={max}
        value={Math.min(monthly, max)}
        onChange={(e) => setMonthly(Number(e.target.value))}
        className="mt-4 w-full accent-[var(--accent)]"
        aria-label="Monthly usage"
      />
      <div className="num mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-accent-soft p-4">
          <p className="text-xs text-accent-strong">Per year</p>
          <p className="text-2xl font-semibold text-accent-strong">{money(yearly)}</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-4">
          <p className="text-xs text-muted">Over 5 years</p>
          <p className="text-2xl font-semibold">{money(fiveYear)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Based on the per-unit prices shown above. Your prices may differ.</p>
    </div>
  );
}
