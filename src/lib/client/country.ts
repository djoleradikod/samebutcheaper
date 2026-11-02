"use client";

import { useSyncExternalStore } from "react";
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

/** The shopper's country, or null before hydration / when unknown. */
export function useCountry(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function setCountry(code: string) {
  document.cookie = `${COUNTRY_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(EVENT));
}
