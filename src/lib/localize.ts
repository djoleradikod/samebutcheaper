/**
 * The selected country decides the currency, the prices that lead and the stores we name.
 *
 * Pure and shared by server and client. Rules, in order:
 * - A country's own market leads. A country with no market of its own falls back to the nearest one,
 *   and says so. US and Canadian records never show outside the US and Canada.
 * - Money is always in the country's currency. A price recorded in another currency is converted at the
 *   committed ECB reference rate and always reads "about", with the original beside it where there's room.
 * - A country whose currency the ECB doesn't publish keeps the fallback market's own currency, and says so.
 */
import fx from "../../data/fx/ecb-reference-rates.json";
import { money, type Currency } from "./format";
import { COUNTRIES, countryInSentence, deliversTo, isMarket, MARKET_CODES, MARKETS, type MarketCode } from "./markets";
import { unitPrice, unitPriceFine } from "./unit-format";

/** Euro-based: one euro buys this much of each currency. */
const RATES: Partial<Record<Currency, number>> = { ...(fx.rates as Partial<Record<Currency, number>>), EUR: 1 };

export const FX_SOURCE = { name: "ECB", date: fx.date, url: fx.url };

const EURO_COUNTRIES = ["DE", "IE", "AT", "FR", "BE", "NL", "LU", "IT", "ES", "PT", "FI", "SK", "SI", "HR", "GR", "BG", "ME"];

/** Every country whose own currency has an ECB reference rate. Each code here is checked against the rates file by a test. */
export const COUNTRY_CURRENCY: Record<string, Currency> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR" as Currency])),
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  CH: "CHF",
  SE: "SEK",
  PL: "PLN",
  DK: "DKK",
  NO: "NOK",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  IL: "ILS",
  IN: "INR",
  JP: "JPY",
  SG: "SGD",
  PH: "PHP",
  MY: "MYR",
  AU: "AUD",
  NZ: "NZD",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
};

/** No ECB rate for these, so they keep the fallback market's own currency and the page names the reason. */
export const NO_RATE: Record<string, string> = {
  RS: "the Serbian dinar",
  BA: "the Bosnian mark",
  MK: "the Macedonian denar",
  AL: "the Albanian lek",
  UA: "the Ukrainian hryvnia",
  AE: "the UAE dirham",
  SA: "the Saudi riyal",
  AR: "the Argentine peso",
};

/** Countries whose nearest market is the UK. Every other country outside the US and Canada falls back to Germany. */
const NEAREST_IS_UK = new Set(["IE", "AU", "NZ", "SG", "MY", "PH", "IN", "ZA", "AE", "SA", "IL", "JP", "MX", "BR", "AR"]);

export const MARKET_ADJECTIVE: Record<MarketCode, string> = { US: "US", GB: "UK", CA: "Canadian", DE: "German" };

const CURRENCY_NAME: Partial<Record<Currency, string>> = {
  EUR: "euro",
  GBP: "pounds",
  USD: "US dollars",
  CAD: "Canadian dollars",
  CHF: "Swiss francs",
  AUD: "Australian dollars",
  NZD: "New Zealand dollars",
  JPY: "yen",
  INR: "rupees",
};

export function currencyName(currency: Currency) {
  return CURRENCY_NAME[currency] ?? currency;
}

const home = (country: string | null) => (country && country in COUNTRIES ? country : "US");

/** The market whose prices lead for a country: its own, or the nearest we have. */
export function listMarketFor(country: string | null): MarketCode {
  const c = home(country);
  if (isMarket(c)) return c;
  return NEAREST_IS_UK.has(c) ? "GB" : "DE";
}

/** Which markets a country sees in lists at all. US and Canadian records stay in the US and Canada. */
export function visibleMarkets(country: string | null): MarketCode[] {
  const c = home(country);
  if (c === "US" || c === "CA") return [...MARKET_CODES];
  return MARKET_CODES.filter((m) => m !== "US" && m !== "CA");
}

/** The items a country sees, keeping their order. */
export function forCountry<T extends { market: MarketCode }>(items: T[], country: string | null) {
  const markets = visibleMarkets(country);
  return items.filter((i) => markets.includes(i.market));
}

/** One unit of `from` in `to`, at the committed rates. Throws if either has no rate: a silent 1:1 would be a false price. */
export function rate(from: Currency, to: Currency) {
  if (from === to) return 1;
  const a = RATES[from];
  const b = RATES[to];
  if (!a || !b) throw new Error(`No reference rate for ${from} to ${to}`);
  return b / a;
}

export type Local = {
  /** The selected country, or the US when we don't know one. */
  country: string;
  /** False when we don't know the country: crawlers and first visits with no location. See localFor. */
  known: boolean;
  /** Whether we may name and link a store for this shopper. */
  sells(retailer: string, market: MarketCode): boolean;
  /** The market that leads. */
  listMarket: MarketCode;
  /** True when that market isn't the country itself. */
  fallback: boolean;
  currency: Currency;
  /** Whether a price recorded in `from` gets converted here, and so reads "about". */
  converts(from: Currency): boolean;
  /** The amount in this country's currency, unlabelled: for sums and sorting. */
  amount(n: number, from: Currency): number;
  /** "€11.70", with no marking. Callers show the marking beside it, see Money. */
  bare(n: number, from: Currency): string;
  /** "about €11.70", or "€11.70" when nothing was converted. For sentences. */
  money(n: number, from: Currency): string;
  unitBare(ppu: number, unit: string, from: Currency): string;
  unit(ppu: number, unit: string, from: Currency): string;
  unitFine(ppu: number, unit: string, from: Currency): string;
  /** "£9.99 at a UK store, Nov 2026", or null when nothing was converted. */
  original(n: number, from: Currency, market: MarketCode, checked: string): string | null;
};

/** "Nov 2026" from the catalogue's "2026-11" or "2026-11-06". The same on server and client. */
export function shortMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function build(country: string): Local {
  const listMarket = listMarketFor(country);
  const fallback = !isMarket(country);
  const currency = COUNTRY_CURRENCY[country] ?? MARKETS[listMarket].currency;
  const amount = (n: number, from: Currency) => n * rate(from, currency);
  const about = (from: Currency, text: string) => (from === currency ? text : `about ${text}`);
  const local: Local = {
    country,
    known: true,
    sells: (retailer, market) => deliversTo(retailer, market, country) !== "no",
    listMarket,
    fallback,
    currency,
    converts: (from) => from !== currency,
    amount,
    bare: (n, from) => money(amount(n, from), currency),
    money: (n, from) => about(from, money(amount(n, from), currency)),
    unitBare: (ppu, unit, from) => unitPrice(amount(ppu, from), unit, currency),
    unit: (ppu, unit, from) => about(from, unitPrice(amount(ppu, from), unit, currency)),
    unitFine: (ppu, unit, from) => about(from, unitPriceFine(amount(ppu, from), unit, currency)),
    original: (n, from, market, checked) =>
      from === currency ? null : `${money(n, from)} at a ${MARKET_ADJECTIVE[market]} store, ${shortMonth(checked)}`,
  };
  return local;
}

const CACHE = new Map<string, Local>();

/** With no country, lists lead with the US, but each record keeps its own currency and store: we can't say it's foreign. */
const UNKNOWN: Local = {
  ...build("US"),
  known: false,
  sells: () => true,
  converts: () => false,
  amount: (n) => n,
  bare: (n, from) => money(n, from),
  money: (n, from) => money(n, from),
  unitBare: (ppu, unit, from) => unitPrice(ppu, unit, from),
  unit: (ppu, unit, from) => unitPrice(ppu, unit, from),
  unitFine: (ppu, unit, from) => unitPriceFine(ppu, unit, from),
  original: () => null,
};

export function localFor(country: string | null): Local {
  if (!country || !(country in COUNTRIES)) return UNKNOWN;
  let local = CACHE.get(country);
  if (!local) {
    local = build(country);
    CACHE.set(country, local);
  }
  return local;
}

/** "the ECB rate of 6 Nov 2026" */
export function rateDate() {
  return new Date(`${fx.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "£1 = €1.20", for telling people what a conversion used. */
export function rateText(from: Currency, to: Currency) {
  const r = rate(from, to);
  return `${money(1, from).replace(/\.00$/, "")} = ${money(r, to)}`;
}

/** What the band at the top of the page says. Null when the country has its own prices. */
export function fallbackNotice(local: Local): { text: string; rate: string | null } | null {
  if (!local.fallback) return null;
  const where = countryInSentence(local.country);
  const market = MARKET_ADJECTIVE[local.listMarket];
  const from = MARKETS[local.listMarket].currency;
  const noRate = NO_RATE[local.country];
  if (noRate) {
    return {
      text: `We haven't checked prices in ${where} yet, so these are ${market} prices, in ${currencyName(local.currency)}. We have no reference rate for ${noRate}.`,
      rate: null,
    };
  }
  const shown = `We haven't checked prices in ${where} yet, so these are ${market} prices, shown in ${currencyName(local.currency)}.`;
  if (from === local.currency) return { text: shown, rate: null };
  return { text: shown, rate: `Converted at the ECB rate of ${rateDate()}, ${rateText(from, local.currency)}, so treat them as approximate.` };
}
