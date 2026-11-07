import type { Market } from "./markets";

export type Currency = Market["currency"];

const SYMBOL: Record<Currency, string> = { USD: "$", GBP: "£", CAD: "CA$", EUR: "€" };
const CENTS: Record<Currency, string> = { USD: "¢", GBP: "p", CAD: "¢", EUR: " ct" };

/** A price in its own currency: $12.34, £12.34, CA$12.34, €12.34. Whole units from 100 up. */
const celsius = (f: string) => Math.round(((Number(f) - 32) * 5) / 9);

/** The storage records quote US extension services in Fahrenheit. "below 85 F" gives "below 29 °C (85 °F)". A figure that already has its Celsius stays as it is. */
export function withCelsius(text: string) {
  return text
    .replace(/\b(\d{2,3}) to (\d{2,3}) F\b(?! \()/g, (_, a, b) => `${celsius(a)} to ${celsius(b)} °C (${a} to ${b} °F)`)
    .replace(/\b(\d{2,3}) F\b(?! \()/g, (_, a) => `${celsius(a)} °C (${a} °F)`);
}

export function money(n: number, currency: Currency) {
  const sym = SYMBOL[currency];
  if (n >= 100) return `${sym}${Math.round(n).toLocaleString("en-US")}`;
  return `${sym}${n.toFixed(2)}`;
}

/** Price per unit: cents (or pence) for tiny values, whole currency otherwise. */
export function ppu(n: number, currency: Currency) {
  if (n < 0.01) return `${(n * 100).toFixed(2)}${CENTS[currency]}`;
  if (n < 1) return `${(n * 100).toFixed(1)}${CENTS[currency]}`;
  return `${SYMBOL[currency]}${n.toFixed(2)}`;
}

/** Sums amounts per currency: "$120 + £40". */
export function moneyTotals(items: { amount: number; currency: Currency }[]) {
  const totals = new Map<Currency, number>();
  for (const i of items) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.amount);
  if (!totals.size) return money(0, "USD");
  return [...totals].map(([c, n]) => money(n, c)).join(" + ");
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
