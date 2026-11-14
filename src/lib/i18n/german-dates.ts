/**
 * German record text keeps dates as the English does, in ISO form ("am 2026-09-18"), so the build's record check
 * (record-check.ts) can compare its numbers with the English field. On the page they read as German dates: "am
 * 18. September 2026". Only a whole date stands alone; one inside a web address or a longer code is left as written.
 * Pure.
 */

const ISO_DATE = /(?<![\w/.:-])(\d{4})-(\d{2})-(\d{2})(?![\w/-])/g;
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** "2026-09-18" -> "18. September 2026" wherever a text has a date on its own. Anything that isn't a real date stays. */
export function germanDates(text: string): string {
  return text.replace(ISO_DATE, (all, y: string, m: string, d: string) => {
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return all;
    return `${day}. ${MONTHS[month - 1]} ${y}`;
  });
}

const done = new WeakMap<object, unknown>();

/** Every string in a record's German text with its dates as German dates. The same object gives the same answer. */
export function withGermanDates<T>(value: T): T {
  if (typeof value === "string") return germanDates(value) as T;
  if (!value || typeof value !== "object") return value;
  const hit = done.get(value);
  if (hit) return hit as T;
  const out = Array.isArray(value)
    ? value.map((v) => withGermanDates(v))
    : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withGermanDates(v)]));
  done.set(value, out);
  return out as T;
}
