/**
 * Numbers, dates and plurals in the page's language, through Intl. German reads 1.234,56 €, 88 %, 13. November 2026.
 * English output is never routed through here where it would change: the English pages keep their own helpers in
 * src/lib/format.ts, byte for byte. Pure, shared by server and client.
 */
import { INTL_LOCALE, type Lang } from "./lang";

const cache = new Map<string, Intl.NumberFormat>();
function nf(lang: Lang, opts: Intl.NumberFormatOptions) {
  const key = `${lang}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(INTL_LOCALE[lang], opts);
    cache.set(key, f);
  }
  return f;
}

/** 1.234,5 in German, 1,234.5 in English. `digits` fixes the decimals; without it, up to two, as needed. */
export function formatNumber(n: number, lang: Lang, digits?: number) {
  return nf(lang, digits === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

/** "88 %" in German (a no-break space before the sign, as DIN 5008 and Duden write it), "88%" in English. */
export function formatPercent(n: number, lang: Lang) {
  const whole = Math.round(n);
  return lang === "de" ? `${formatNumber(whole, lang, 0)} %` : `${whole}%`;
}

/** A money amount in German: "12,34 €", whole euros from 100 up ("1.234 €"). The currency's own sign, after the number. */
export function formatMoneyDe(n: number, currency: string) {
  const whole = n >= 100;
  return nf("de", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(whole ? Math.round(n) : n);
}

/** A currency amount in German with fixed decimals: "0,045 €", "1,23 £". */
export function formatCurrencyDe(n: number, currency: string, digits: number) {
  return nf("de", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONTHS_DE_SHORT = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "13. November 2026"; "November 2026" when only the month is known. */
export function dateDe(iso: string, precision: "day" | "month" = "day") {
  const { y, m, d } = parts(iso);
  if (!y || !m) return iso;
  return precision === "month" || !d ? `${MONTHS_DE[m - 1]} ${y}` : `${d}. ${MONTHS_DE[m - 1]} ${y}`;
}

/** "13. Nov. 2026", for tight places; "Nov. 2026" when only the month is known. */
export function shortDateDe(iso: string, precision: "day" | "month" = "day") {
  const { y, m, d } = parts(iso);
  if (!y || !m) return iso;
  return precision === "month" || !d ? `${MONTHS_DE_SHORT[m - 1]} ${y}` : `${d}. ${MONTHS_DE_SHORT[m - 1]} ${y}`;
}

/** "November 2026". */
export function monthDe(iso: string) {
  return dateDe(iso, "month");
}

/** The German month name for an English one ("May" or "May 2024"), for dates the English records write out. Null when it isn't one. */
export function monthNameDe(english: string) {
  const i = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].indexOf(
    english.toLowerCase(),
  );
  return i < 0 ? null : MONTHS_DE[i];
}

const rules = new Map<Lang, Intl.PluralRules>();
/** Picks the form for a count by the language's plural rules. */
export function plural(n: number, lang: Lang, forms: { one: string; other: string }) {
  let r = rules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(INTL_LOCALE[lang]);
    rules.set(lang, r);
  }
  return r.select(n) === "one" ? forms.one : forms.other;
}

/** "a, b und c" / "a, b and c". */
export function listWords(words: string[], lang: Lang) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${lang === "de" ? "und" : "and"} ${words[words.length - 1]}`;
}

/**
 * A figure the catalogue wrote the English way ("1.5 V", "1,000 mg", "0.454%"), in German notation ("1,5 V",
 * "1.000 mg", "0,454 %"). Only digits and separators change; it is formatting, not translation, so it only runs on
 * values made of numbers and units.
 */
export function germanFigures(text: string) {
  return text
    .replace(/(\d),(\d{3})(?!\d)/g, "$1 $2")
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/(\d) (\d{3})/g, "$1.$2")
    .replace(/(\d)%/g, "$1 %");
}
