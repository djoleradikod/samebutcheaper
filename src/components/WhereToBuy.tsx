"use client";

import {
  COUNTRIES,
  MARKETS,
  countryInSentence,
  deliversTo,
  lookForQuery,
  pharmacyNote,
  storesFor,
  type LookFor,
  type MarketCode,
} from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { sellsIn } from "@/lib/sellers";
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
  aisle,
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
  /** Leaves out specialist stores for other aisles. */
  aisle?: string;
}) {
  const country = useCountry();

  if (!country) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
        These prices are from {MARKETS[market].short}. Pick your country to see what to look for there.
        <CountryPicker withName />
      </p>
    );
  }

  const delivery = deliversTo(retailer, market, country);

  if (delivery === "yes") {
    return (
      <p className="text-[13px] font-medium text-ink-2">
        {retailerLabel} sells this in {MARKETS[market].short}. Check the store for delivery or collection.
      </p>
    );
  }

  const query = lookForQuery(lookFor, country);
  const amazon = COUNTRIES[country]?.amazon;
  const stores = storesFor(country, aisle);
  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <p className="text-sm font-semibold">Buying in {countryInSentence(country)}</p>
        <CountryPicker />
      </div>
      <div className="grid gap-x-6 gap-y-3 p-4 text-sm md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <p className="text-ink-2">
            {delivery === "maybe"
              ? `${retailerLabel} in ${MARKETS[market].short} ships many items abroad, so check delivery and import fees at checkout. It's usually cheaper to buy locally. Look for:`
              : sellsIn(retailer, country)
                ? `We priced this at ${retailerLabel} in ${MARKETS[market].short}. ${retailerLabel} sells in ${countryInSentence(country)} too, so look for it there and check the price, as its range and prices can differ.`
                : `The store we priced this at in ${MARKETS[market].short} doesn't deliver to ${countryInSentence(country)}. Look for this locally:`}
          </p>
          <p className="rounded-tile border border-line-strong bg-canvas px-3 py-2 font-semibold break-words">{query}</p>
          <p className="text-[13px] text-muted">
            {lookFor.actives?.length
              ? "Any brand that lists exactly these active ingredients at the same strength is the same product. Store brands are usually the cheapest."
              : compareWith
                ? `Compare the label with ${compareWith} before you buy. Store brands are usually the cheapest.`
                : "Store brands are usually the cheapest."}
            {health &&
              ` Medicine rules differ by country: something sold off the shelf in ${MARKETS[market].short} may need a pharmacist or a prescription where you live.`}
            {health && pharmacyNote(country) && ` ${pharmacyNote(country)}`}
          </p>
        </div>
        <div className="min-w-0">
          {stores.length > 0 && (
            <ul className="divide-y divide-line border-y border-line">
              {stores.map((s) => (
                <li key={s.id}>
                  <a
                    href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(query)}&from=${slug}`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="flex min-h-11 items-center font-medium text-cobalt hover:underline"
                  >
                    Search {s.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {!amazon && (
            <p className="mt-2 text-[13px] text-muted">
              We don&apos;t know a big online store that delivers to {countryInSentence(country)} yet. Your local
              pharmacy or supermarket will have the same thing under its own label.
            </p>
          )}
          <p className="mt-2 text-[13px] text-muted">Prices on this page were checked in {MARKETS[market].short}.</p>
        </div>
      </div>
    </div>
  );
}
