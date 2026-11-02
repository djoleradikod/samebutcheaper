"use client";

import { Check, MapPin, Search } from "lucide-react";
import {
  COUNTRIES,
  MARKETS,
  countryInSentence,
  deliversTo,
  flag,
  lookForQuery,
  pharmacyNote,
  storesFor,
  type LookFor,
  type MarketCode,
} from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { CountryPicker } from "./CountryPicker";

/**
 * Tells shoppers whether the listed store delivers to their country, and if
 * it doesn't, what to look for and where to search locally.
 */
export function WhereToBuy({
  slug,
  market,
  retailer,
  retailerLabel,
  lookFor,
  health = false,
  compareWith,
}: {
  slug: string;
  market: MarketCode;
  retailer: string;
  retailerLabel: string;
  lookFor: LookFor;
  /** Medicines and supplements: add the "rules differ by country" caveat. */
  health?: boolean;
  /** Brand-name product to compare labels against, for non-ingredient matches. */
  compareWith?: string;
}) {
  const country = useCountry();
  if (!country) return null;
  const delivery = deliversTo(retailer, market, country);

  if (delivery === "yes") {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Check className="h-3.5 w-3.5 text-accent" /> {retailerLabel} delivers in {MARKETS[market].short}
      </p>
    );
  }

  const query = lookForQuery(lookFor, country);
  const amazon = COUNTRIES[country]?.amazon;
  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-accent" />
          Buying in {countryInSentence(country)} {flag(country)}
        </p>
        <CountryPicker />
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-ink-2">
          {delivery === "maybe"
            ? `${retailerLabel} in ${MARKETS[market].short} ships many items abroad, so check delivery and import fees at checkout. It's usually cheaper to buy locally:`
            : `${retailerLabel} in ${MARKETS[market].short} doesn't deliver to ${countryInSentence(country)}. Here's what to look for locally:`}
        </p>
        <p className="rounded-xl border border-accent/30 bg-accent-soft/50 px-3 py-2 font-semibold text-accent-strong">
          {query}
        </p>
        <p className="text-xs leading-relaxed text-muted">
          {lookFor.actives?.length
            ? "Any brand that lists exactly these active ingredients at the same strength is the same product. Store brands are usually the cheapest."
            : compareWith
              ? `Compare the label with ${compareWith} before you buy. Store brands are usually the cheapest.`
              : "Store brands are usually the cheapest."}
          {health &&
            ` Medicine rules differ by country: something sold off the shelf in ${MARKETS[market].short} may need a pharmacist or a prescription where you live.`}
          {health && pharmacyNote(country) && ` ${pharmacyNote(country)}`}
        </p>
        <ul className="grid gap-2">
          {storesFor(country).map((s) => (
            <li key={s.id}>
              <a
                href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(query)}&from=${slug}`}
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
        {!amazon && (
          <p className="text-xs text-muted">
            We don&apos;t know a big online store that delivers to {countryInSentence(country)} yet. Your local pharmacy
            or supermarket will have the same thing under its own label.
          </p>
        )}
        <p className="text-xs text-muted">Prices on this page were checked in {MARKETS[market].short}.</p>
      </div>
    </div>
  );
}
