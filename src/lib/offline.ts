/**
 * My list offline. The service worker (public/sw.js) keeps the last copy of /my-list and serves it when the network
 * fails, stamped with when it was kept (X-Sbc-Saved, else the response's own Date). The prices in that copy are from
 * then, so the page says so. Pure, for MyList and tests.
 */
import { INTL_LOCALE, type Lang } from "./i18n/lang";

/** When the kept copy was saved, from its headers, or null when neither header reads as a date. */
export function savedAt(headers: { get(name: string): string | null }): Date | null {
  for (const name of ["x-sbc-saved", "date"]) {
    const v = headers.get(name);
    const t = v ? Date.parse(v) : NaN;
    if (Number.isFinite(t)) return new Date(t);
  }
  return null;
}

/** "13 Nov 2026" ("13. Nov. 2026" in German), as the price dates elsewhere on the site read. */
export function offlineDate(d: Date, lang: Lang = "en") {
  return d.toLocaleDateString(INTL_LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
