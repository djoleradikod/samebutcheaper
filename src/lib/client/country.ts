"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { localFor } from "@/lib/localize";
import { isKnownCountry } from "@/lib/markets";

/** Set by src/proxy.ts from the visitor's location, and by the country picker. */
export const COUNTRY_COOKIE = "sbc_country";
const EVENT = "sbc:country-change";

function read(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([A-Z]{2})`));
    return m && isKnownCountry(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("focus", cb);
  };
}

/** The server's reading of the country, so the first render already matches it. See CountryProvider. */
export const CountryContext = createContext<string | null>(null);

/** The shopper's country, or null when unknown. */
export function useCountry(): string | null {
  const fromServer = useContext(CountryContext);
  return useSyncExternalStore(subscribe, read, () => fromServer);
}

/** Currency, conversions and fallback for the shopper's country. */
export function useLocal() {
  const country = useCountry();
  return useMemo(() => localFor(country), [country]);
}

export function setCountry(code: string) {
  document.cookie = `${COUNTRY_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(EVENT));
}
