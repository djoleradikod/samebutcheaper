"use client";

import { MapPin, Search } from "lucide-react";
import { COUNTRIES, countryInSentence, flag, lookForQuery, pharmacyNote, storesFor, type LookFor } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { CountryPicker } from "./CountryPicker";

/** "Find the same thing where you live": the search phrase plus store links for the shopper's country. */
export function LocalSearch({
  lookFor,
  from,
  note,
  medicine = false,
}: {
  lookFor: LookFor;
  from: string;
  note?: string;
  medicine?: boolean;
}) {
  const country = useCountry();
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 text-accent" />
          {country ? `Find it in ${countryInSentence(country)} ${flag(country)}` : "Find it where you live"}
        </p>
        <CountryPicker withName />
      </div>
      {country ? (
        <div className="space-y-3 p-5 text-sm">
          <p className="text-ink-2">Search for this, then compare the price per unit:</p>
          <p className="rounded-xl border border-accent/30 bg-accent-soft/50 px-3 py-2 font-semibold text-accent-strong">
            {lookForQuery(lookFor, country)}
          </p>
          {note && <p className="text-xs leading-relaxed text-muted">{note}</p>}
          {medicine && pharmacyNote(country) && (
            <p className="text-xs leading-relaxed text-muted">{pharmacyNote(country)}</p>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {storesFor(country).map((s) => (
              <li key={s.id}>
                <a
                  href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(lookForQuery(lookFor, country))}&from=${from}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-accent"
                >
                  <span className="font-medium">Search {s.name}</span>
                  <Search className="h-4 w-4 shrink-0 text-accent" />
                </a>
              </li>
            ))}
          </ul>
          {!COUNTRIES[country]?.amazon && (
            <p className="text-xs text-muted">
              Your local pharmacy or supermarket will usually have the same thing under its own label.
            </p>
          )}
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">Choose your country to see stores that deliver there.</p>
      )}
    </div>
  );
}
