"use client";

import { MARKETS, countryInSentence, deliversTo, lookForQuery, storesFor, type LookFor, type MarketCode } from "@/lib/markets";
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
    return <p className="text-[13px] text-ink-2">Every store on this list sells in {countryInSentence(country)}. Check each one for delivery.</p>;
  }

  const stores = storesFor(country)
    .filter((s) => !s.aisles)
    .slice(0, 2);
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 className="text-sm">Buying in {countryInSentence(country)}</h2>
        <CountryPicker />
      </div>
      <div className="p-4 text-sm">
        <p className="text-ink-2">
          These prices were checked in {MARKETS[market].short}, and some of the stores don&apos;t deliver to{" "}
          {countryInSentence(country)}. Look for these locally:
        </p>
        <ul className="mt-2 divide-y divide-line">
          {blocked.map((item, i) => {
            const q = lookForQuery(item.lookFor, country);
            return (
              <li key={i} className="py-2">
                <p className="text-xs text-muted">Instead of {item.replaces}</p>
                <p className="mt-0.5 font-semibold">{q}</p>
                <p className="flex flex-wrap gap-x-3 text-[13px]">
                  {stores.map((s) => (
                    <a
                      key={s.id}
                      href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(q)}&from=${slug}`}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-7"
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
          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            Medicine rules differ by country. Something sold off the shelf in {MARKETS[market].short} may need a pharmacist or a
            prescription where you live.
          </p>
        )}
      </div>
    </div>
  );
}
