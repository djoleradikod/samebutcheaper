/**
 * Holding the space a shopper's own view adds to a record page, before it arrives.
 *
 * On /compare/<slug> the static HTML carries the record's own view (its market's prices, nothing converted) and the
 * shopper's view replaces it once it streams in (RecordPart in src/components/ForCountry.tsx). A shopper whose country
 * converts the price, or doesn't list the record, gets lines the stand-in doesn't have: "(£9.99 at a UK store, Nov
 * 2026)" under each price, "These are UK prices, shown in euros..." over the offers, and "We priced this at UK stores and
 * couldn't confirm..." over the title. Without a reservation, everything under those lines jumps when they arrive.
 *
 * The browser knows the shopper's country before it paints (the cookie), so the root layout's first script puts it on
 * <html> as `data-cc`, with its currency as `data-cur` (one of RESERVED_CURRENCIES, or OTHER). globals.css then shows
 * invisible copies of exactly those lines in the stand-in ("Reserved space for the shopper's view"), and a small script
 * in the note's stand-in decides whether this record is listed there. Crawlers and visitors we can't place have no
 * cookie, so nothing is reserved and they read the record's own view as before.
 *
 * Pure: shared by the root layout, server components and tests.
 */
import { localFor, type Listed } from "./localize";
import { COUNTRIES, MARKETS, type MarketCode } from "./markets";

/** The record currencies, each with its own CSS rule. Any other shopper currency is OTHER. */
export const RESERVED_CURRENCIES = ["USD", "GBP", "EUR", "CAD"] as const;
export type CurrencyToken = (typeof RESERVED_CURRENCIES)[number] | "OTHER";

export function currencyToken(country: string): CurrencyToken {
  const c = localFor(country).currency;
  return (RESERVED_CURRENCIES as readonly string[]).includes(c) ? (c as CurrencyToken) : "OTHER";
}

/** Every country we know, grouped by the token of the currency its shopper sees prices in. */
export function countriesByToken(): Record<CurrencyToken, string[]> {
  const out = { USD: [], GBP: [], EUR: [], CAD: [], OTHER: [] } as Record<CurrencyToken, string[]>;
  for (const c of Object.keys(COUNTRIES)) out[currencyToken(c)].push(c);
  return out;
}

/**
 * The part of the root layout's first script that sets `data-cc` and `data-cur` from `c`, the country it read (the
 * URL's, else the cookie's). Unknown codes set nothing.
 */
export function shopperAttributesScript() {
  const groups = Object.entries(countriesByToken()).map(([token, list]) => `${token}:${JSON.stringify(list.join(" "))}`);
  return `if(c){var g={${groups.join(",")}};for(var t in g)if((" "+g[t]+" ").indexOf(" "+c+" ")>=0){document.documentElement.setAttribute("data-cc",c);document.documentElement.setAttribute("data-cur",t)}}`;
}

/** The countries whose shoppers see this record listed: with only confirmed stores, and with other countries' swaps shown too. */
export function listedIn(record: Listed): { strict: string[]; wide: string[] } {
  const all = Object.keys(COUNTRIES);
  return { strict: all.filter((c) => localFor(c).shows(record)), wide: all.filter((c) => localFor(c, true).shows(record)) };
}

/**
 * For the stand-in of the "isn't listed here" note: marks its own element `data-on` when the shopper's country (from
 * <html data-cc>) doesn't list the record, so globals.css gives it the note's height.
 */
export function noteSlotScript(listed: { strict: string[]; wide: string[] }) {
  const s = JSON.stringify(` ${listed.strict.join(" ")} `);
  const w = JSON.stringify(` ${listed.wide.join(" ")} `);
  return `(function(e){var c=document.documentElement.getAttribute("data-cc");if(!c||!e)return;var l=/(?:^|; )sbc_others=1(?:;|$)/.test(document.cookie)?${w}:${s};if(l.indexOf(" "+c+" ")<0)e.setAttribute("data-on","")})(document.currentScript&&document.currentScript.parentNode)`;
}

/**
 * Which of a record's market tags ("These are UK prices, shown in euros...") a shopper's token gets, with a country to
 * render it for. "same": a shopper in another country with the market's own currency (an Irish shopper on a German
 * record), whose tag converts nothing. Tokens that can't happen for this market (a shopper in it) are left out.
 */
export function tagVariants(market: MarketCode): { token: CurrencyToken | "same"; country: string }[] {
  const own = MARKETS[market].currency;
  const groups = countriesByToken();
  const out: { token: CurrencyToken | "same"; country: string }[] = [];
  for (const token of [...RESERVED_CURRENCIES, "OTHER"] as CurrencyToken[]) {
    const pick = groups[token].find((c) => c !== market);
    if (!pick) continue;
    out.push({ token: token === own ? "same" : token, country: pick });
  }
  return out;
}
