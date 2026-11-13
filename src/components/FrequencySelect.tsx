"use client";

import { ChevronDown } from "lucide-react";
import { FREQUENCIES, isFrequency, type FrequencyId } from "@/lib/yearly";
import { useT } from "@/lib/i18n/client";
import { yearly } from "@/lib/i18n/en/client/yearly";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { yearly };

/**
 * How often the shopper buys a pack. A native select, so phones open their own picker. Every option is in it from
 * the first render, so its width doesn't change when a stored choice loads.
 */
export function FrequencySelect({
  value,
  onChange,
  label,
  className = "",
}: {
  value: FrequencyId;
  onChange: (often: FrequencyId) => void;
  /** What a screen reader hears, e.g. "How often you buy the Advil pack". */
  label: string;
  className?: string;
}) {
  const t = useT(TEXT);
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => {
          if (isFrequency(e.target.value)) onChange(e.target.value);
        }}
        className="h-11 cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-base font-semibold text-ink hover:border-ink-2 md:h-9 md:text-[15px]"
      >
        {FREQUENCIES.map((f) => (
          <option key={f.id} value={f.id}>
            {t(`yearly.frequencies.${f.id}`)}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </span>
  );
}
