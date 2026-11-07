"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, useTransition } from "react";
import { localFor } from "@/lib/localize";
import { isKnownCountry } from "@/lib/markets";

/** Set by src/proxy.ts from the visitor's location, and by the country picker. */
export const COUNTRY_COOKIE = "sbc_country";
const OTHERS_COOKIE = "sbc_others";
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

function readOthers() {
  try {
    return document.cookie.split("; ").includes(`${OTHERS_COOKIE}=1`);
  } catch {
    return false;
  }
}

/** The server's reading of the country, so the first render already matches it. See CountryProvider. */
export const CountryContext = createContext<string | null>(null);
/** The same for the shopper's choice to see other countries' swaps. */
export const OthersContext = createContext(false);

/** The shopper's country, or null when unknown. */
export function useCountry(): string | null {
  const fromServer = useContext(CountryContext);
  return useSyncExternalStore(subscribe, read, () => fromServer);
}

/** Currency, conversions, fallback and which records list for the shopper's country. */
export function useLocal() {
  const country = useCountry();
  const fromServer = useContext(OthersContext);
  const others = useSyncExternalStore(subscribe, readOthers, () => fromServer);
  return useMemo(() => localFor(country, others), [country, others]);
}

export function setCountry(code: string) {
  document.cookie = `${COUNTRY_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(EVENT));
}

export function setShowOthers(show: boolean) {
  document.cookie = `${OTHERS_COOKIE}=${show ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Asks the server for the page again after one of those changes. Lists and stores come from the server, so until
 * the answer arrives the page is marked as updating (see html[data-updating] in globals.css) rather than passing old lists off as new.
 */
export function useCountryRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    document.documentElement.toggleAttribute("data-updating", pending);
    document.getElementById("main")?.setAttribute("aria-busy", String(pending));
  }, [pending]);
  return () => startTransition(() => router.refresh());
}
