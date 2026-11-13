"use client";

import { COUNTRIES, MARKETS, countryInSentence, lookForQuery, pharmacyNote, storesFor, type LookFor, type MarketCode } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { deliversTo, separateSite, sellsIn } from "@/lib/sellers";
import { CountryPicker } from "./CountryPicker";

/** "walmart.ca" from the chain's national address, for a link that says where it goes. */
function siteName(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/(?:en-ca|en)?\/?$/, "");
  } catch {
    return url;
  }
}

/**
 * Tells shoppers whether the listed store delivers to their country, and if it doesn't, what to look for and where to search
 * locally. The rule is deliversTo in sellers.ts, the same one that decides whether the page links the store at all.
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
  /** The seller as sellerOf gives it, or the retailer when they're the same. */
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
  const where = countryInSentence(country);

  if (delivery === "yes") {
    return (
      <p className="text-[13px] font-medium text-ink-2">
        {country === market
          ? `${retailerLabel} sells this in ${MARKETS[market].short}. Check the store for delivery or collection.`
          : `${retailerLabel} delivers from ${MARKETS[market].short} to ${where}, by its own delivery page. Delivery there is charged at its own rate, so check it at checkout.`}
      </p>
    );
  }

  const query = lookForQuery(lookFor, country);
  const amazon = COUNTRIES[country]?.amazon;
  const stores = storesFor(country, aisle);
  const ownSite = separateSite(retailer, country);
  const status =
    delivery === "maybe"
      ? `${retailerLabel} in ${MARKETS[market].short} ships many items abroad, so check delivery and import fees at checkout. It's usually cheaper to buy locally.`
      : ownSite
        ? `${retailerLabel} sells in ${where} only through its own site there, with a different range and prices, so the listing we priced in ${MARKETS[market].short} isn't sold there. Look for the same thing there or at the stores below.`
        : sellsIn(retailer, country)
          ? `We priced this at ${retailerLabel} in ${MARKETS[market].short}. ${retailerLabel} sells in ${where} too, so look for it there and check the price, as its range and prices can differ.`
          : `The store we priced this at in ${MARKETS[market].short} doesn't deliver to ${where}. ${
              lookFor.actives?.length
                ? "The same thing is usually on the shelf there under another name."
                : "Look for it there, or for the same thing under another name."
            }`;
  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <p className="text-sm font-semibold">Buying in {where}</p>
        <CountryPicker />
      </div>
      <div className="grid gap-x-6 gap-y-4 p-4 text-sm md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <p className="text-ink-2">{status}</p>
          <div>
            <p className="text-[13px] font-semibold text-ink-2">What to look for in {where}</p>
            <p className="mt-1 rounded-tile border border-line-strong bg-canvas px-3 py-2 text-base font-semibold break-words">{query}</p>
          </div>
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
          <p className="text-[13px] font-semibold text-ink-2">Search stores that deliver to {where}</p>
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {ownSite && (
              <li>
                <a
                  href={ownSite}
                  target="_blank"
                  rel="nofollow noopener"
                  className="flex min-h-11 items-center font-medium text-cobalt hover:underline"
                >
                  Go to {retailerLabel} at {siteName(ownSite)}
                </a>
              </li>
            )}
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
          {!amazon && (
            <p className="mt-2 text-[13px] text-muted">
              We don&apos;t know a big online store that delivers to {where} yet. Your local pharmacy or supermarket will
              have the same thing under its own label.
            </p>
          )}
          <p className="mt-2 text-[13px] text-muted">Prices on this page were checked in {MARKETS[market].short}.</p>
        </div>
      </div>
    </div>
  );
}
