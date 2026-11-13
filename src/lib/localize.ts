/**
 * The selected country decides the currency, the prices that lead and the stores we name.
 *
 * Pure and shared by server and client. Rules, in order:
 * - A country's own market leads. A country with no market of its own falls back to the nearest one,
 *   and says so. US and Canadian records never show outside the US and Canada.
 * - A record from another market only lists if its seller operates in or ships to the country (see sellers.ts).
 *   In a fallback country the shopper can ask to see the rest, and in Canada the US records whose stores don't sell
 *   there. Baskets and kits need every seller to pass. Canada doesn't take US records on trust: Walmart.com and Target
 *   don't ship there, and walmart.ca and costco.ca are separate shops with their own range.
 * - Money is always in the country's currency. A price recorded in another currency is converted at the
 *   committed ECB reference rate and always reads "about", with the original beside it where there's room.
 * - A country whose currency the ECB doesn't publish keeps the fallback market's own currency, and says so.
 */
import fx from "../../data/fx/ecb-reference-rates.json";
import { money, ppu, type Currency } from "./format";
import { countryInSentence, isKnownCountry, isMarket, MARKET_CODES, MARKETS, type MarketCode } from "./markets";
import { deliversTo, namedSellers, sellsIn, shipsFrom } from "./sellers";
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

export const MARKET_ADJECTIVE: Record<MarketCode, string> = { US: "US", GB: "UK", CA: "Canadian", DE: "German", IE: "Irish" };

/** Markets with a few checked swaps of their own, too few to lead. They fall back as if they had none, and their own records list as well. */
const THIN_MARKETS: ReadonlySet<string> = new Set(["IE"]);

export function isThinMarket(country: string | null) {
  return country !== null && THIN_MARKETS.has(country);
}


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

const home = (country: string | null) => (isKnownCountry(country) ? country : "US");

/** The market whose prices lead for a country: its own, or the nearest we have. */
export function listMarketFor(country: string | null): MarketCode {
  const c = home(country);
  if (isMarket(c) && !isThinMarket(c)) return c;
  return NEAREST_IS_UK.has(c) ? "GB" : "DE";
}

/** Which markets a country sees in lists at all. US and Canadian records stay in the US and Canada. */
export function visibleMarkets(country: string | null): MarketCode[] {
  const c = home(country);
  if (c === "US" || c === "CA") return [...MARKET_CODES];
  return MARKET_CODES.filter((m) => m !== "US" && m !== "CA");
}

/**
 * Markets whose records a country with its own market can ask to see even where their stores don't sell there. Only Canada:
 * its own records are few, and the US is next door. A fallback country can ask for everything it can see.
 */
const OTHERS_FROM: Partial<Record<string, readonly MarketCode[]>> = { CA: ["US"] };

/** Anything a list can show: a swap, kit or basket, with who sells it, and the same swap's record in another market if it has one. */
export type Listed = { market: MarketCode; sellers: readonly string[]; twin?: { market: MarketCode } | null };

/** When neither record of a swap is from the shopper's market, the one whose names read in English lists. */
const TWIN_ORDER: MarketCode[] = ["GB", "IE", "US", "CA", "DE"];

/** For a shopper we can't place, or a page that lists whatever a brand has: one record of each swap. */
const firstOfTwins = (item: Listed) => !item.twin || TWIN_ORDER.indexOf(item.market) < TWIN_ORDER.indexOf(item.twin.market);

export function oneOfEachSwap<T extends Listed>(items: readonly T[]): T[] {
  return items.filter(firstOfTwins);
}

/** The items this shopper sees, keeping their order. */
export function forCountry<T extends Listed>(items: readonly T[], local: Local): T[] {
  return items.filter((i) => local.shows(i));
}

/** A record's written text with its prices in this shopper's currency. Display only: compare.ts reads the catalogue's own wording. */
export function localText<T extends { currency: Currency; summary: string; evidence: string; differences: string; why?: string }>(record: T, local: Local): T {
  const say = (text: string) => local.prose(text, record.currency);
  return {
    ...record,
    summary: say(record.summary),
    evidence: say(record.evidence),
    differences: say(record.differences),
    ...(record.why ? { why: say(record.why) } : {}),
  };
}

/** A cited finding with its prices in this shopper's currency. One that spans markets has no single currency to read, so it stays as written. */
export function localClaim<T extends { markets: MarketCode[]; title: string; finding: string; caveat: string }>(claim: T, local: Local): T {
  if (claim.markets.length !== 1) return claim;
  const from = MARKETS[claim.markets[0]].currency;
  return { ...claim, title: local.prose(claim.title, from), finding: local.prose(claim.finding, from), caveat: local.prose(claim.caveat, from) };
}

/** Whether a cited finding shows here. A US finding names US stores, and from elsewhere a finding only shows if the chains it names sell here. */
export function findingShows(claim: { markets: MarketCode[]; title: string; finding: string; caveat: string; sources: { title: string }[] }, local: Local) {
  if (!local.known) return true;
  if (claim.markets.includes(local.country as MarketCode)) return true;
  const seen: readonly string[] = visibleMarkets(local.country);
  if (claim.markets.length && !claim.markets.some((m) => seen.includes(m))) return false;
  if (local.others && claim.markets.some((m) => local.othersFrom.includes(m))) return true;
  const written = [claim.title, claim.finding, claim.caveat, ...claim.sources.map((s) => s.title)].join(" ");
  return namedSellers(written).every((s) => sellsIn(s, local.country));
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
  /** Whether a list shows this record here. */
  shows(item: Listed): boolean;
  /** The shopper asked to see swaps from stores we can't place in their country. A fallback country and Canada have the choice. */
  others: boolean;
  /** The markets that choice brings back: everything a fallback country can see, the US for Canada, nothing elsewhere. */
  othersFrom: readonly MarketCode[];
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
  /** Written catalogue text, with each price in it converted and the original beside it. Unchanged when nothing converts. */
  prose(text: string, from: Currency): string;
};

/** A number as the catalogue's writers put it: 1,500 or 1,500.50, 4.39 or 4,39, 29. */
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+[.,]\d{1,2}(?!\d)|\d+`;
const SMALL = String.raw`\d{1,2}(?:\.\d+)?`;
const JOIN = String.raw`(?:\s(?:and|to|or)\s|\s?[-–]\s?)`;
const ABOUT = "(?:(?:about|around|roughly|approximately) )?";
/** Not part of a longer figure or word, so £1.5m, 16:9 and 1080p stay as they are. */
const ENDS = String.raw`(?![\w%]|[.,]\d)`;

/** Written forms of each record currency: before the number, after it, and the smaller unit after it. */
const WRITTEN_FORMS: Partial<Record<Currency, { before: string; after: string; small?: string }>> = {
  GBP: { before: "£|GBP\\s?", after: "GBP\\b|pounds?\\b", small: "p\\b" },
  EUR: { before: "€|EUR\\s?", after: "EUR\\b|€|[Ee]uros?\\b", small: "\\s?cents?\\b" },
  USD: { before: "US\\$|USD\\s?|(?<![A-Za-z])\\$", after: "USD\\b|dollars?\\b", small: "\\s?cents?\\b|¢" },
  CAD: { before: "CA?\\$|CAD\\s?|(?<![A-Za-z])\\$", after: "CAD\\b", small: "\\s?cents?\\b|¢" },
};

/** One pattern per currency. Groups: a price and a range's end after a symbol, a pair before a word, one before a word, then the same two in the smaller unit. */
function writtenPattern(from: Currency) {
  const form = WRITTEN_FORMS[from];
  if (!form) return null;
  const start = String.raw`(?<![\w.,£€$])`;
  const parts = [
    `${ABOUT}(?:${form.before})\\s?(${NUM})(?:\\s?[-–]\\s?(?:${form.before})?\\s?(${NUM}))?${ENDS}`,
    `${ABOUT}${start}(${NUM})${JOIN}(${NUM})\\s?(?:${form.after})`,
    `${ABOUT}${start}(${NUM})\\s?(?:${form.after})`,
  ];
  if (form.small) {
    parts.push(`${ABOUT}${start}(${SMALL})${JOIN}(${SMALL})(?:${form.small})`, `${ABOUT}${start}(${SMALL})(?:${form.small})`);
  }
  return new RegExp(parts.join("|"), "g");
}

const toNumber = (written: string) => (/,\d{3}/.test(written) ? Number(written.replaceAll(",", "")) : Number(written.replace(",", ".")));

/** "Nov 2026" from the catalogue's "2026-11" or "2026-11-06". The same on server and client. */
export function shortMonth(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function build(country: string, askedForOthers: boolean): Local {
  const listMarket = listMarketFor(country);
  const fallback = listMarket !== country;
  const markets = visibleMarkets(country);
  const othersFrom: readonly MarketCode[] = fallback ? markets : (OTHERS_FROM[country] ?? []);
  const others = askedForOthers && othersFrom.length > 0;
  const currency = COUNTRY_CURRENCY[country] ?? MARKETS[listMarket].currency;
  const amount = (n: number, from: Currency) => n * rate(from, currency);
  const about = (from: Currency, text: string) => (from === currency ? text : `about ${text}`);
  const local: Local = {
    country,
    known: true,
    sells: (retailer, market) => deliversTo(retailer, market, country) !== "no",
    shows: (item) => {
      if (item.market === country) return true;
      if (!markets.includes(item.market)) return false;
      // One swap lists once: the record from this shopper's market, then from the market they lead with. A twin they can't see doesn't count.
      const twin = item.twin?.market;
      if (twin && markets.includes(twin)) {
        if (twin === country) return false;
        if (item.market !== listMarket && (twin === listMarket || TWIN_ORDER.indexOf(twin) < TWIN_ORDER.indexOf(item.market))) return false;
      }
      // Sold there with the same range, or delivered there from the market it was priced in.
      if (item.sellers.every((s) => sellsIn(s, country) || shipsFrom(s, item.market, country))) return true;
      return others && othersFrom.includes(item.market);
    },
    others,
    othersFrom,
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
    prose: (text, from) => {
      const pattern = from === currency ? null : writtenPattern(from);
      if (!pattern) return text;
      return text.replace(pattern, (written: string, ...groups: (string | undefined)[]) => {
        const [a, b, c, d, e, f, g, h] = groups;
        const scale = f || g || h ? 0.01 : 1;
        const first = a ?? c ?? e ?? f ?? h;
        const second = b ?? d ?? g;
        if (!first) return written;
        const show = (n: string) => ppu(amount(toNumber(n) * scale, from), currency);
        const shown = second ? `${show(first)} to ${show(second)}` : show(first);
        return `about ${shown} (${written.replace(/^(?:about|around|roughly|approximately) /, "").trim()})`;
      });
    },
  };
  return local;
}

const CACHE = new Map<string, Local>();

/** With no country, lists lead with the US, but each record keeps its own currency and store: we can't say it's foreign. */
const UNKNOWN: Local = {
  ...build("US", false),
  known: false,
  sells: () => true,
  shows: firstOfTwins,
  converts: () => false,
  amount: (n) => n,
  bare: (n, from) => money(n, from),
  money: (n, from) => money(n, from),
  unitBare: (ppu, unit, from) => unitPrice(ppu, unit, from),
  unit: (ppu, unit, from) => unitPrice(ppu, unit, from),
  unitFine: (ppu, unit, from) => unitPriceFine(ppu, unit, from),
  original: () => null,
  prose: (text) => text,
};

export function localFor(country: string | null, others = false): Local {
  if (!isKnownCountry(country)) return UNKNOWN;
  const key = `${country}${others ? "+" : ""}`;
  let local = CACHE.get(key);
  if (!local) {
    local = build(country, others);
    CACHE.set(key, local);
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

/** Whether the band shows for a country. The layout holds its space before the first paint from this. */
export function hasBand(country: string) {
  return fallbackNotice(localFor(country)) !== null;
}

/** What the band at the top of the page says. Null when the country has its own prices and nothing else to ask for. */
export function fallbackNotice(local: Local): { text: string; rate: string | null } | null {
  const where = countryInSentence(local.country);
  if (!local.fallback) {
    // Canada: its own prices lead, and the US ones it can ask for are converted.
    const next = local.othersFrom[0];
    if (!local.known || !next) return null;
    const from = MARKETS[next].currency;
    return {
      text: `We've priced only a few swaps in ${where} so far. The others were priced in other countries and are shown in ${currencyName(local.currency)}.`,
      rate: from === local.currency ? null : `Converted at the ECB rate of ${rateDate()}, ${rateText(from, local.currency)}, so treat them as approximate.`,
    };
  }
  const market = MARKET_ADJECTIVE[local.listMarket];
  const from = MARKETS[local.listMarket].currency;
  const noRate = NO_RATE[local.country];
  if (noRate) {
    return {
      text: `We haven't checked prices in ${where} yet, so these are ${market} prices, in ${currencyName(local.currency)}. We have no reference rate for ${noRate}.`,
      rate: null,
    };
  }
  const shown = isThinMarket(local.country)
    ? `We've only started checking prices in ${where}, so most of these are ${market} prices, shown in ${currencyName(local.currency)}.`
    : `We haven't checked prices in ${where} yet, so these are ${market} prices, shown in ${currencyName(local.currency)}.`;
  if (from === local.currency) return { text: shown, rate: null };
  return { text: shown, rate: `Converted at the ECB rate of ${rateDate()}, ${rateText(from, local.currency)}, so treat them as approximate.` };
}
