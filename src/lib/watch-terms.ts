/**
 * Which sides of a swap a price watch may follow, by the affiliate terms of the store each price comes from
 * (data/sellers/programmes.json `terms`). Walmart's terms bar "price tracking and/or price alerting functionality" for
 * products sold on its sites, so a Walmart price is never watched. Only programmes whose terms page the registry cites
 * are restricted; nothing is guessed for the rest.
 *
 * A watch is about the cheaper product's price (src/lib/watches.ts):
 *  - the cheaper side's store bars alerts: no watch is offered, and existing watches are not emailed;
 *  - only the brand side's store does: the watch follows the cheaper product's price alone, never the saving against
 *    the brand's price, and its emails leave the brand's price out.
 * Pure, so the page, the form's server action and the daily run agree.
 */
import { storeName } from "./affiliate";
import { linkStore, programmeOf } from "./programmes";
import type { MarketCode } from "./markets";

type Side = { retailer: string; url?: string | null };

/** A side whose store's terms bar price alerts, with the store's name and the terms page that says so. */
export type Barred = { store: string; name: string; source: string };

export type WatchTerms = {
  /** The cheaper product's price may not be watched: no watch at all. */
  alternative: Barred | null;
  /** The brand's price may not be watched: the watch leaves the saving out. */
  brand: Barred | null;
};

/** The side's store, when its programme's terms bar price alerts in this market. */
export function barredSide(side: Side, market: MarketCode | string): Barred | null {
  const store = linkStore({ retailer: side.retailer, url: side.url ?? null });
  const entry = programmeOf(store);
  if (entry.terms?.priceAlerts !== false) return null;
  // A programme pays for its own countries' sites: walmart.ca is another programme, whose terms we haven't read.
  if (entry.markets.length && !entry.markets.includes(market)) return null;
  return { store, name: storeName(side.retailer, side.url ?? ""), source: entry.terms.source };
}

export function watchTerms(pair: { market: MarketCode | string; brand: Side; alternative: Side }): WatchTerms {
  return { alternative: barredSide(pair.alternative, pair.market), brand: barredSide(pair.brand, pair.market) };
}
