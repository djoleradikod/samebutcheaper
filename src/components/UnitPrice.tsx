"use client";

import { useLocal } from "@/lib/client/country";
import type { Currency } from "@/lib/format";
import { unitDisplay } from "@/lib/unit-format";

const SIZES = {
  sm: { alt: "text-lg leading-none", brand: "text-[13px]", unit: "text-xs" },
  md: { alt: "text-[1.375rem]", brand: "text-[15px]", unit: "text-xs" },
  lg: { alt: "text-[2rem]", brand: "text-lg leading-none", unit: "text-sm" },
} as const;

/** A small drawn arrow, because the Latin font subset has none. Screen readers hear "to". */
export function ToArrow({ className = "" }: { className?: string }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 14 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={`mx-[0.2em] inline-block h-[0.62em] w-[0.86em] align-[0.04em] ${className}`}
      >
        <path d="M0 5h12.5M8.5 1l4 4-4 4" />
      </svg>
      <span className="sr-only"> to </span>
    </>
  );
}

/**
 * The cheaper unit price, big and condensed, with the brand's beside it in muted and
 * no strike-through, then the unit: "13.83 vs 53.23 per 100 g".
 */
export function UnitPrice({
  unit,
  alt,
  brand,
  currency,
  size = "md",
  className = "",
}: {
  /** The catalogue's unit, as on the pair. */
  unit: string;
  /** Cheaper product's price per unit. */
  alt: number;
  /** Brand's price per unit. */
  brand: number;
  currency: Currency;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { label } = unitDisplay(unit);
  const local = useLocal();
  const about = local.converts(currency);
  const cheaper = local.unitBare(alt, unit, currency);
  const dearer = local.unitBare(brand, unit, currency);
  const s = SIZES[size];
  return (
    <p className={`flex flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <span className="sr-only">
        {about && "About: "}Cheaper one {cheaper} {label}, brand {dearer} {label}.
      </span>
      <span aria-hidden="true" className={`price text-ink ${s.alt}`}>
        {about && <span className="text-[0.55em] font-medium">about </span>}
        {cheaper}
      </span>
      <span aria-hidden="true" className={`price font-semibold text-muted ${s.brand}`}>
        vs {dearer}
      </span>
      <span aria-hidden="true" className={`leading-tight font-medium text-muted ${s.unit}`}>
        {label}
      </span>
    </p>
  );
}
