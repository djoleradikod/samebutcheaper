import "server-only";
import { cookies, headers } from "next/headers";
import { isKnownCountry } from "./markets";
import { localFor } from "./localize";

/** Set by the band's "Show swaps from other countries". */
const OTHERS_COOKIE = "sbc_others";

/** Set by src/proxy.ts on a first visit, when the cookie it also sets isn't on the request yet. */
export const COUNTRY_HEADER = "x-sbc-country";

/** The selected country: the picker's cookie, else what the proxy detected, else null. Only call this inside the root Suspense. */
export async function getCountry(): Promise<string | null> {
  const fromCookie = (await cookies()).get("sbc_country")?.value;
  if (isKnownCountry(fromCookie)) return fromCookie;
  const detected = (await headers()).get(COUNTRY_HEADER);
  return isKnownCountry(detected) ? detected : null;
}

/** The currency, conversions and which records list for this shopper, including their choice to see other countries' swaps. */
export async function getLocal() {
  const others = (await cookies()).get(OTHERS_COOKIE)?.value === "1";
  return localFor(await getCountry(), others);
}
