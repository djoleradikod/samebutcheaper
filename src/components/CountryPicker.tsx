"use client";

import { ChevronDown, Globe } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MARKET_ADJECTIVE } from "@/lib/localize";
import { COUNTRY_OPTIONS, MARKET_LABEL, countryName, type MarketCode } from "@/lib/markets";
import { countryOfPath, switchCountryPath } from "@/lib/country-url";
import { setCountry, useCountry, useCountryOrBlank } from "@/lib/client/country";

type PickerProps = { className?: string; withName?: boolean };

/**
 * Country picker. A transparent native <select> sits over a styled label, so
 * it stays accessible and opens the platform picker on phones.
 *
 * On a prefixed page (/de/..., see src/lib/country-url.ts) it shows the URL's country, and a choice goes to the same page
 * under the new country's prefix, or to the unprefixed page for a country without one. The choice is remembered either way.
 *
 * The URL's country is read in a small Suspense part that renders only the label: the path is known at build time for
 * prerendered pages, and at request time for one rendered on demand. Everything else stays outside it, so the label is
 * in the first HTML of a prerendered page (React sends a finished boundary over 500 bytes later in the stream).
 */
export function CountryPicker({ className = "", withName = false }: PickerProps) {
  const router = useRouter();
  const chosen = useCountryOrBlank();
  const [fromPath, setFromPath] = useState<string | null>(null);
  const country = fromPath ?? chosen;
  return (
    <span
      className={`relative inline-flex h-11 items-center gap-1.5 rounded-tile border border-line bg-paper px-2.5 text-sm font-medium text-ink-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cobalt hover:border-ink-2 hover:text-ink md:h-9 ${className}`}
    >
      {withName && <Globe className="h-4 w-4 text-muted" aria-hidden="true" />}
      <Suspense fallback={<Label country={chosen} withName={withName} />}>
        <PathLabel chosen={chosen} withName={withName} report={setFromPath} />
      </Suspense>
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      <select
        aria-label="Country you shop in"
        title="Country you shop in"
        value={country ?? ""}
        onChange={(e) => {
          const code = e.target.value;
          if (!code) return;
          const next = switchCountryPath(window.location.pathname, code, window.location.search);
          // Prices on the page follow at once. CountryProvider then asks the server for the lists and stores.
          setCountry(code);
          if (next) router.push(next);
        }}
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

/** The label for the URL's country, else the shopper's. Tells the picker the URL's country, for its select. */
function PathLabel({ chosen, withName, report }: { chosen: string | null; withName: boolean; report: (c: string | null) => void }) {
  const fromPath = countryOfPath(usePathname());
  useEffect(() => report(fromPath), [fromPath, report]);
  return <Label country={fromPath ?? chosen} withName={withName} />;
}

function Label({ country, withName }: { country: string | null; withName: boolean }) {
  if (country) return <span className="whitespace-nowrap">{withName ? countryName(country) : country}</span>;
  if (withName) return <span className="whitespace-nowrap">Country</span>;
  return <Globe className="h-4 w-4 text-muted" aria-hidden="true" />;
}

/** "UK prices", in plain text, on anything priced somewhere other than where the shopper is. */
export function MarketNote({ market, className = "" }: { market: MarketCode; className?: string }) {
  const country = useCountry() ?? "US";
  if (country === market) return null;
  return (
    <span className={`whitespace-nowrap text-muted ${className}`} title={`Prices checked in ${MARKET_LABEL[market]} stores`}>
      {MARKET_ADJECTIVE[market]} prices
    </span>
  );
}
