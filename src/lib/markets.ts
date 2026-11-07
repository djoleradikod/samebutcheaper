/**
 * Countries, markets and the stores that deliver in each.
 *
 * A *market* is a country where we verify prices ourselves (pairs and bundles
 * carry a `market` code, and their prices are in that market's currency). Any
 * other country still gets a "what to look for" note and links that search
 * stores which deliver there.
 *
 * This module is shared by server and client code, so it must stay free of
 * secrets and Node-only imports.
 */

export const MARKET_CODES = ["US", "GB", "CA", "DE"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

export type Market = {
  code: MarketCode;
  name: string;
  /** How the country is named in running text ("in the UK"). */
  short: string;
  currency: "USD" | "GBP" | "CAD" | "EUR";
  locale: string;
  amazon: string;
};

export const MARKETS: Record<MarketCode, Market> = {
  US: { code: "US", name: "United States", short: "the US", currency: "USD", locale: "en-US", amazon: "amazon.com" },
  GB: { code: "GB", name: "United Kingdom", short: "the UK", currency: "GBP", locale: "en-GB", amazon: "amazon.co.uk" },
  CA: { code: "CA", name: "Canada", short: "Canada", currency: "CAD", locale: "en-CA", amazon: "amazon.ca" },
  DE: { code: "DE", name: "Germany", short: "Germany", currency: "EUR", locale: "de-DE", amazon: "amazon.de" },
};

/** Short names for labels: "UK prices". */
export const MARKET_LABEL: Record<MarketCode, string> = { US: "US", GB: "UK", CA: "Canada", DE: "Germany" };

/** Rough USD value of one unit of each currency. Used only to rank savings across markets. */
export const APPROX_USD: Record<Market["currency"], number> = { USD: 1, GBP: 1.27, CAD: 0.72, EUR: 1.08 };

export function isMarket(code: string | null | undefined): code is MarketCode {
  return !!code && (MARKET_CODES as readonly string[]).includes(code);
}

/* ------------------------------------------------------------------------- */

type CountryInfo = {
  name: string;
  /** Amazon storefront that delivers there, if any. */
  amazon?: string;
  /** True when that storefront is in another country (delivery is per item). */
  amazonCrossBorder?: boolean;
};

const EU_VIA_DE = { amazon: "amazon.de", amazonCrossBorder: true };

export const COUNTRIES: Record<string, CountryInfo> = {
  US: { name: "United States", amazon: "amazon.com" },
  CA: { name: "Canada", amazon: "amazon.ca" },
  GB: { name: "United Kingdom", amazon: "amazon.co.uk" },
  DE: { name: "Germany", amazon: "amazon.de" },
  IE: { name: "Ireland", amazon: "amazon.ie" },
  AT: { name: "Austria", ...EU_VIA_DE },
  CH: { name: "Switzerland", ...EU_VIA_DE },
  FR: { name: "France", amazon: "amazon.fr" },
  BE: { name: "Belgium", amazon: "amazon.com.be" },
  NL: { name: "Netherlands", amazon: "amazon.nl" },
  LU: { name: "Luxembourg", ...EU_VIA_DE },
  IT: { name: "Italy", amazon: "amazon.it" },
  ES: { name: "Spain", amazon: "amazon.es" },
  PT: { name: "Portugal", amazon: "amazon.es", amazonCrossBorder: true },
  SE: { name: "Sweden", amazon: "amazon.se" },
  PL: { name: "Poland", amazon: "amazon.pl" },
  DK: { name: "Denmark", ...EU_VIA_DE },
  FI: { name: "Finland", ...EU_VIA_DE },
  NO: { name: "Norway" },
  CZ: { name: "Czechia", ...EU_VIA_DE },
  SK: { name: "Slovakia", ...EU_VIA_DE },
  HU: { name: "Hungary", ...EU_VIA_DE },
  SI: { name: "Slovenia", ...EU_VIA_DE },
  HR: { name: "Croatia", ...EU_VIA_DE },
  RO: { name: "Romania", ...EU_VIA_DE },
  BG: { name: "Bulgaria", ...EU_VIA_DE },
  GR: { name: "Greece", ...EU_VIA_DE },
  RS: { name: "Serbia" },
  BA: { name: "Bosnia and Herzegovina" },
  ME: { name: "Montenegro" },
  MK: { name: "North Macedonia" },
  AL: { name: "Albania" },
  UA: { name: "Ukraine" },
  TR: { name: "Türkiye", amazon: "amazon.com.tr" },
  IL: { name: "Israel" },
  AE: { name: "United Arab Emirates", amazon: "amazon.ae" },
  SA: { name: "Saudi Arabia", amazon: "amazon.sa" },
  IN: { name: "India", amazon: "amazon.in" },
  JP: { name: "Japan", amazon: "amazon.co.jp" },
  SG: { name: "Singapore", amazon: "amazon.sg" },
  PH: { name: "Philippines" },
  MY: { name: "Malaysia" },
  AU: { name: "Australia", amazon: "amazon.com.au" },
  NZ: { name: "New Zealand", amazon: "amazon.com.au", amazonCrossBorder: true },
  MX: { name: "Mexico", amazon: "amazon.com.mx" },
  BR: { name: "Brazil", amazon: "amazon.com.br" },
  AR: { name: "Argentina" },
  ZA: { name: "South Africa" },
};

/** Countries sorted for a picker: our markets first, then A to Z. */
export const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  ...MARKET_CODES.map((code) => ({ code, name: COUNTRIES[code].name })),
  ...Object.entries(COUNTRIES)
    .filter(([code]) => !isMarket(code))
    .map(([code, c]) => ({ code, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

export function countryName(code: string) {
  return COUNTRIES[code]?.name ?? code;
}

/** "the United States", "the Netherlands", "Germany": a country name that reads right mid-sentence. */
export function countryInSentence(code: string) {
  const name = countryName(code);
  return /^(United |Netherlands$|Philippines$)/.test(name) ? `the ${name}` : name;
}

export function isKnownCountry(code: string | null | undefined): code is string {
  return !!code && Object.hasOwn(COUNTRIES, code);
}

/** Emoji flag from an ISO 3166-1 alpha-2 code. */
export function flag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/* ------------------------------------------------------------------------- */

export const RETAILERS = [
  "amazon",
  "walmart",
  "target",
  "costco",
  "bestbuy",
  "apple",
  "cvs",
  "walgreens",
  "boots",
  "superdrug",
  "tesco",
  "asda",
  "sainsburys",
  "shoppers",
  "canadiantire",
  "loblaws",
  "dm",
  "rossmann",
  "mueller",
  "shopapotheke",
  "docmorris",
  "aponeo",
  "medikamente-per-klick",
  "homedepot",
  "lowes",
  "staples",
  "officedepot",
  "autozone",
  "kroger",
  "aldi",
  "lidl",
  "morrisons",
  "waitrose",
  "ocado",
  "wilko",
  "argos",
  "screwfix",
  "toolstation",
  "bandq",
  "halfords",
  "ryman",
  "rewe",
  "edeka",
  "kaufland",
  "hornbach",
  "obi",
  "bauhaus",
  "atu",
  "ikea",
  "chewy",
  "petsathome",
  "fressnapf",
  "safeway",
  "wholefoods",
  "sprouts",
  "winco",
  "batteryjunction",
  "netto",
  "penny",
  "tegut",
  "zooplus",
  "pollin",
  "alternate",
  "sevendayshop",
  "viking",
  "crocus",
  "coop",
  "marksandspencer",
  "iceland",
  "other",
] as const;
export type Retailer = (typeof RETAILERS)[number];

/**
 * Whether a listing at `retailer` in `market` can be delivered to `country`.
 * "maybe" means the store ships some items abroad (Amazon), so the shopper
 * should check at checkout.
 */
export function deliversTo(retailer: string, market: MarketCode, country: string): "yes" | "maybe" | "no" {
  if (country === market) return "yes";
  if (retailer === "amazon") return "maybe";
  return "no";
}

/* ------------------------------------------------------------------------- */

/** Where medicines are sold, for countries where it isn't the supermarket. */
export function pharmacyNote(country: string): string | null {
  if (country === "DE" || country === "AT" || country === "CH")
    return "Most medicines there are sold only by pharmacies (Apotheke), including online pharmacies.";
  return null;
}

export type Store = {
  id: string;
  name: string;
  search: string;
  /** Only worth searching in these aisles. Everything else searches everywhere. */
  aisles?: string[];
};

/** Stores with a reliable search URL. `{q}` is the URL-encoded query. */
const STORES: Record<string, Store> = {
  "walmart-us": { id: "walmart-us", name: "Walmart", search: "https://www.walmart.com/search?q={q}" },
  target: { id: "target", name: "Target", search: "https://www.target.com/s?searchTerm={q}" },
  "walmart-ca": { id: "walmart-ca", name: "Walmart.ca", search: "https://www.walmart.ca/en/search?q={q}" },
  boots: { id: "boots", name: "Boots", search: "https://www.boots.com/sitesearch?searchTerm={q}" },
  superdrug: { id: "superdrug", name: "Superdrug", search: "https://www.superdrug.com/search?text={q}" },
  tesco: { id: "tesco", name: "Tesco", search: "https://www.tesco.com/groceries/en-GB/search?query={q}" },
  "dm-de": { id: "dm-de", name: "dm", search: "https://www.dm.de/search?query={q}" },
  rossmann: { id: "rossmann", name: "Rossmann", search: "https://www.rossmann.de/de/search/?text={q}" },
  "dm-at": { id: "dm-at", name: "dm Österreich", search: "https://www.dm.at/search?query={q}" },
  // Opened on 7 Nov 2026: each returned a results page naming the query. Tesco, Dunnes, Aldi and Boots Ireland refuse
  // automated checks, so none of them is listed until someone has opened the link.
  supervalu: { id: "supervalu", name: "SuperValu", search: "https://shop.supervalu.ie/sm/delivery/rsid/5550/results?q={q}" },
  "lidl-ie": { id: "lidl-ie", name: "Lidl Ireland", search: "https://www.lidl.ie/q/search?q={q}" },
  woodies: { id: "woodies", name: "Woodie's", search: "https://www.woodies.ie/catalogsearch/result/?q={q}", aisles: ["tools-diy", "garden"] },
};

const LOCAL_STORES: Record<string, string[]> = {
  US: ["walmart-us", "target"],
  CA: ["walmart-ca"],
  GB: ["boots", "superdrug", "tesco"],
  DE: ["dm-de", "rossmann"],
  AT: ["dm-at"],
  IE: ["supervalu", "lidl-ie", "woodies"],
};

/** Stores to search in a country: its Amazon storefront, local chains, then Google Shopping. */
export function storesFor(country: string, aisle?: string): Store[] {
  const out: Store[] = [];
  const c = COUNTRIES[country];
  if (c?.amazon) {
    const label = c.amazon.charAt(0).toUpperCase() + c.amazon.slice(1);
    out.push({ id: "amazon", name: label, search: `https://www.${c.amazon}/s?k={q}` });
  }
  for (const id of LOCAL_STORES[country] ?? []) {
    const store = STORES[id];
    if (!aisle || !store.aisles || store.aisles.includes(aisle)) out.push(store);
  }
  out.push({
    id: "google",
    name: "Google Shopping",
    search: `https://www.google.com/search?tbm=shop&gl=${country.toLowerCase()}&q={q}`,
  });
  return out;
}

export function storeSearchUrl(store: Store, query: string) {
  return store.search.replace("{q}", encodeURIComponent(query));
}

/* ------------------------------------------------------------------------- */

/** Medicine names differ by country. US-only names map to the international one. */
/** US name -> international (INN) name, for shoppers outside the US and Canada. */
const INN_ALIASES: Record<string, string> = {
  acetaminophen: "paracetamol",
  acyclovir: "aciclovir",
  beclomethasone: "beclometasone",
  albuterol: "salbutamol",
  "polyethylene glycol 3350": "macrogol",
};

/** International name -> US name, for shoppers in the US and Canada. */
const US_ALIASES: Record<string, string> = Object.fromEntries(Object.entries(INN_ALIASES).map(([us, inn]) => [inn, us]));

function swapNames(name: string, map: Record<string, string>) {
  let n = name;
  for (const [from, to] of Object.entries(map)) {
    n = n.replace(new RegExp(`\\b${from}\\b`, "gi"), (m) =>
      m[0] === m[0].toUpperCase() ? to.charAt(0).toUpperCase() + to.slice(1) : to,
    );
  }
  return n;
}

/**
 * Localises an active ingredient for searching in `country`: US-only names
 * become the international ones, and German stores get German INN spelling
 * (Loratadine becomes Loratadin).
 */
export function localIngredientName(name: string, country: string) {
  let n = name.trim();
  n = swapNames(n, country === "US" || country === "CA" ? US_ALIASES : INN_ALIASES);
  if (country === "DE" || country === "AT" || country === "CH") {
    n = n.replace(/\b([A-Za-z]{4,}(?:ine|ole|one|ide|ate))\b/g, (w) => w.slice(0, -1));
  }
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export type LookFor = {
  /** Plain description, used when there are no actives to list. */
  text: string;
  actives?: { name: string; amount: string }[];
  /** "tablets", "capsules" ... appended to the actives. */
  form?: string;
};

const FORM_DE: Record<string, string> = {
  tablets: "Tabletten",
  caplets: "Tabletten",
  capsules: "Kapseln",
  softgels: "Kapseln",
  gelcaps: "Kapseln",
  gummies: "Gummis",
  lozenges: "Lutschtabletten",
};

/** The search phrase for a swap in a given country. */
export function lookForQuery(look: LookFor, country: string) {
  // Written phrases still get the local medicine names ("paracetamol" becomes "acetaminophen" in the US).
  if (!look.actives?.length) return swapNames(look.text, country === "US" || country === "CA" ? US_ALIASES : INN_ALIASES);
  const parts = look.actives.map((a) => `${localIngredientName(a.name, country)}${a.amount ? ` ${a.amount}` : ""}`);
  const german = country === "DE" || country === "AT" || country === "CH";
  const form = look.form ? (german ? FORM_DE[look.form] ?? "" : look.form) : "";
  return `${parts.join(" + ")}${form ? ` ${form}` : ""}`;
}
