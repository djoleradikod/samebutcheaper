"use client";

import { ChevronDown, Globe } from "lucide-react";
import { COUNTRY_OPTIONS, countryName, flag } from "@/lib/markets";
import { setCountry, useCountry } from "@/lib/client/country";

/**
 * Country picker. A transparent native <select> sits over a styled label, so
 * it stays accessible and opens the platform picker on phones.
 */
export function CountryPicker({ className = "", withName = false }: { className?: string; withName?: boolean }) {
  const country = useCountry();
  return (
    <span
      className={`relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink-2 focus-within:border-accent hover:text-ink ${className}`}
    >
      {country ? (
        <span className="text-base leading-none" aria-hidden="true">
          {flag(country)}
        </span>
      ) : (
        <Globe className="h-4 w-4 text-muted" aria-hidden="true" />
      )}
      <span>{country ? (withName ? countryName(country) : country) : "Country"}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      <select
        aria-label="Country you shop in"
        title="Country you shop in"
        value={country ?? ""}
        onChange={(e) => e.target.value && setCountry(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Choose your country
        </option>
        {COUNTRY_OPTIONS.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </span>
  );
}
