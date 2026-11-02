"use client";

import { Check, MapPin } from "lucide-react";
import {
  MARKETS,
  countryInSentence,
  deliversTo,
  flag,
  lookForQuery,
  storesFor,
  type LookFor,
  type MarketCode,
} from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { CountryPicker } from "./CountryPicker";

type Item = { retailer: string; retailerLabel: string; replaces: string; lookFor: LookFor };

/** Bundle version of WhereToBuy: one search phrase per item. */
export function BundleWhereToBuy({
  slug,
  market,
  items,
  health = false,
}: {
  slug: string;
  market: MarketCode;
  items: Item[];
  health?: boolean;
}) {
  const country = useCountry();
  if (!country) return null;
  const blocked = items.filter((i) => deliversTo(i.retailer, market, country) !== "yes");

  if (!blocked.length) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Check className="h-3.5 w-3.5 text-accent" /> Every store on this list delivers in {MARKETS[market].short}
      </p>
    );
  }

  const stores = storesFor(country).slice(0, 2);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-accent" />
          Buying in {countryInSentence(country)} {flag(country)}
        </p>
        <CountryPicker />
      </div>
      <div className="space-y-3 p-4 text-sm">
        <p className="text-ink-2">
          Prices here were checked in {MARKETS[market].short}, and some of these stores don&apos;t deliver to{" "}
          {countryInSentence(country)}. Look for these locally:
        </p>
        <ul className="space-y-3">
          {blocked.map((item, i) => {
            const q = lookForQuery(item.lookFor, country);
            return (
              <li key={i} className="rounded-xl border border-line p-3">
                <p className="text-xs text-muted">Instead of: {item.replaces}</p>
                <p className="mt-0.5 font-semibold text-accent-strong">{q}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {stores.map((s) => (
                    <a
                      key={s.id}
                      href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(q)}&from=${slug}`}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="font-medium text-accent underline-offset-2 hover:underline"
                    >
                      Search {s.name}
                    </a>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
        {health && (
          <p className="text-xs leading-relaxed text-muted">
            Medicine rules differ by country: something sold off the shelf in {MARKETS[market].short} may need a
            pharmacist or a prescription where you live.
          </p>
        )}
      </div>
    </div>
  );
}
