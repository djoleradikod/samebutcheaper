import "server-only";
import { cookies, headers } from "next/headers";
import { isKnownCountry } from "./markets";
import { localFor } from "./localize";

/** Set by src/proxy.ts on a first visit, when the cookie it also sets isn't on the request yet. */
export const COUNTRY_HEADER = "x-sbc-country";

/** The selected country: the picker's cookie, else what the proxy detected, else null. Only call this inside the root Suspense. */
export async function getCountry(): Promise<string | null> {
  const fromCookie = (await cookies()).get("sbc_country")?.value;
  if (isKnownCountry(fromCookie)) return fromCookie;
  const detected = (await headers()).get(COUNTRY_HEADER);
  return isKnownCountry(detected) ? detected : null;
}

export async function getLocal() {
  return localFor(await getCountry());
}
