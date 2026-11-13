import "server-only";
import { cookies, headers } from "next/headers";
import { isKnownCountry } from "./markets";
import { localFor } from "./localize";
import { isPrefixedCountry } from "./country-url";

/** Set by the band's "Show swaps from other countries". */
const OTHERS_COOKIE = "sbc_others";

/** Set by src/proxy.ts on a first visit, when the cookie it also sets isn't on the request yet. */
export const COUNTRY_HEADER = "x-sbc-country";

/** Set by src/proxy.ts on a prefixed URL (/de/..., see country-url.ts): the URL's country, which beats the cookie. */
export const PATH_COUNTRY_HEADER = "x-sbc-path-country";

/** The country of the prefixed URL this request is for, or null. For the parts of the root layout that render per request. */
export async function getUrlCountry(): Promise<string | null> {
  const fromPath = (await headers()).get(PATH_COUNTRY_HEADER);
  return isPrefixedCountry(fromPath) ? fromPath : null;
}

/** The selected country: the URL's prefix, else the picker's cookie, else what the proxy detected, else null. Only call this inside a CountryPart. */
export async function getCountry(): Promise<string | null> {
  const fromPath = await getUrlCountry();
  if (fromPath) return fromPath;
  const fromCookie = (await cookies()).get("sbc_country")?.value;
  if (isKnownCountry(fromCookie)) return fromCookie;
  const detected = (await headers()).get(COUNTRY_HEADER);
  return isKnownCountry(detected) ? detected : null;
}

/** The currency, conversions and which records list for this shopper, including their choice to see other countries' swaps. A prefixed URL never shows other countries' swaps. */
export async function getLocal() {
  const fromPath = await getUrlCountry();
  if (fromPath) return localFor(fromPath);
  const others = (await cookies()).get(OTHERS_COOKIE)?.value === "1";
  return localFor(await getCountry(), others);
}
