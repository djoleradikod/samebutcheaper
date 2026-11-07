import type { Market } from "./markets";

/** What a catalogue record is priced in. */
export type MarketCurrency = Market["currency"];

/** What a shopper can be shown a price in. */
export type Currency =
  | MarketCurrency
  | "AUD" | "BRL" | "CHF" | "CZK" | "DKK" | "HUF" | "ILS" | "INR" | "JPY" | "MXN" | "MYR"
  | "NOK" | "NZD" | "PHP" | "PLN" | "RON" | "SEK" | "SGD" | "TRY" | "ZAR";

const SYMBOL: Record<Currency, string> = {
  USD: "$", GBP: "£", CAD: "CA$", EUR: "€", AUD: "A$", BRL: "R$", CHF: "CHF ", CZK: "CZK ", DKK: "DKK ", HUF: "HUF ",
  ILS: "₪", INR: "₹", JPY: "¥", MXN: "MX$", MYR: "RM", NOK: "NOK ", NZD: "NZ$", PHP: "PHP ", PLN: "PLN ", RON: "RON ",
  SEK: "SEK ", SGD: "S$", TRY: "TRY ", ZAR: "R ",
};
/** Only where shoppers read small amounts in the smaller unit. Everywhere else stays in whole currency. */
const CENTS: Partial<Record<Currency, string>> = { USD: "¢", GBP: "p", CAD: "¢", EUR: " ct" };

/** A price in its own currency: $12.34, £12.34, CA$12.34, €12.34. Whole units from 100 up. */
const celsius = (f: string) => Math.round(((Number(f) - 32) * 5) / 9);

/** The storage records quote US extension services in Fahrenheit. "below 85 F" gives "below 29 °C (85 °F)". A figure that already has its Celsius stays as it is. */
export function withCelsius(text: string) {
  return text
    .replace(/\b(\d{2,3}) to (\d{2,3}) F\b(?! \()/g, (_, a, b) => `${celsius(a)} to ${celsius(b)} °C (${a} to ${b} °F)`)
    .replace(/\b(\d{2,3}) F\b(?! \()/g, (_, a) => `${celsius(a)} °C (${a} °F)`);
}

/** "tesco.com" from a store or source URL. A value that isn't a URL comes back as it is. */
export function hostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function money(n: number, currency: Currency) {
  const sym = SYMBOL[currency];
  if (n >= 100) return `${sym}${Math.round(n).toLocaleString("en-US")}`;
  return `${sym}${n.toFixed(2)}`;
}

/** Price per unit: cents (or pence) for tiny values, whole currency otherwise. */
export function ppu(n: number, currency: Currency) {
  const small = CENTS[currency];
  if (small && n < 0.01) return `${(n * 100).toFixed(2)}${small}`;
  if (small && n < 1) return `${(n * 100).toFixed(1)}${small}`;
  return `${SYMBOL[currency]}${n.toFixed(n < 0.1 ? 3 : 2)}`;
}

/** True when `ppu` writes small amounts in cents or pence. */
export function hasCents(currency: Currency) {
  return Boolean(CENTS[currency]);
}

export function pct(n: number) {
  return `${Math.round(n)}%`;
}

export function unitLabel(unit: string, size = 1) {
  if (size === 1) return unit;
  if (/(oz|ml|g|mg|lb|kg|mah)$/i.test(unit)) return unit;
  if (/s$|x$|ch$|sh$/.test(unit)) return unit + "es";
  return unit + "s";
}

export function formatSize(size: number, unit: string) {
  const n = Number.isInteger(size) ? size.toString() : size.toFixed(1);
  return `${n} ${unitLabel(unit, size)}`;
}

export function monthYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A title-case name for use mid-sentence: "OTC Medicine" -> "OTC medicine", "Vitamin D3" -> "vitamin D3". */
export function inSentence(name: string) {
  return name
    .split(" ")
    .map((w) => (/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w))
    .join(" ");
}
