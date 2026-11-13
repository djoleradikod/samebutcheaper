import "server-only";
import { cache } from "react";
import { getPathCountry } from "../path-country";
import { getT } from "./index";
import { langForCountry, type Lang } from "./lang";

/**
 * The language of the page being rendered, for server components deep in a page: German on /de/..., English
 * everywhere else. It reads the same per-render slot the CountryParts read (src/lib/path-country.ts), which the
 * prefixed page sets before it renders anything, so it is static and needs no prop.
 *
 * Not for the root layout (header, footer): it renders outside the page. Those use ByLang from ./client.
 */
export function getLang(): Lang {
  return override().lang ?? langForCountry(getPathCountry());
}

/** Per render, like the path country: a prefixed page in a section that stays English (ENGLISH_SECTIONS) sets "en". */
const override = cache((): { lang: Lang | null } => ({ lang: null }));

export function setPageLang(lang: Lang) {
  override().lang = lang;
}

/** `t()` in the page's language. */
export function pageT() {
  return getT(getLang());
}
