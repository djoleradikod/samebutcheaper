"use client";

import { ChevronDown, Globe } from "lucide-react";
import { COUNTRY_OPTIONS, MARKET_LABEL, countryName, type MarketCode } from "@/lib/markets";
import { setCountry, useCountry } from "@/lib/client/country";

/**
 * Country picker. A transparent native <select> sits over a styled label, so
 * it stays accessible and opens the platform picker on phones.
 */
export function CountryPicker({ className = "", withName = false }: { className?: string; withName?: boolean }) {
  const country = useCountry();
  return (
    <span
      className={`relative inline-flex h-11 items-center gap-1.5 rounded-tile border border-line bg-paper px-2.5 text-sm font-medium text-ink-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt hover:border-ink-2 hover:text-ink md:h-9 ${className}`}
    >
      {(withName || !country) && <Globe className="h-4 w-4 text-muted" aria-hidden="true" />}
      {country ? (
        <span className="whitespace-nowrap">{withName ? countryName(country) : country}</span>
      ) : (
        withName && <span className="whitespace-nowrap">Country</span>
      )}
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

/** "UK prices", in plain text, on anything priced somewhere other than where the shopper is. */
export function MarketNote({ market, className = "" }: { market: MarketCode; className?: string }) {
  const country = useCountry() ?? "US";
  if (country === market) return null;
  return (
    <span className={`whitespace-nowrap text-muted ${className}`} title={`Prices checked in ${MARKET_LABEL[market]} stores`}>
      {MARKET_LABEL[market]} prices
    </span>
  );
}
