"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, useTransition } from "react";
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

/** The server's reading of the country, so the first render already matches it. Undefined outside a CountryPart: nobody has read it. */
export const CountryContext = createContext<string | null | undefined>(undefined);
/** The same for the shopper's choice to see other countries' swaps. */
export const OthersContext = createContext(false);

/**
 * The shopper's country, or null when unknown. Outside a CountryPart the server hasn't read the country, and rendering
 * as if it were unknown would put records' own prices in the static HTML for everyone, so that fails the build instead.
 */
export function useCountry(): string | null {
  const fromServer = useContext(CountryContext);
  return useSyncExternalStore(subscribe, read, () => {
    if (fromServer === undefined) throw new Error("useCountry was server-rendered outside a CountryPart, so it would show every country the same prices.");
    return fromServer;
  });
}

/** For what's fine blank until the browser reads the cookie, and so can sit in the static HTML: the header's picker, which names no price. */
export function useCountryOrBlank(): string | null {
  const fromServer = useContext(CountryContext);
  return useSyncExternalStore(subscribe, read, () => fromServer ?? null);
}

/** Currency, conversions, fallback and which records list for the shopper's country. */
export function useLocal() {
  const country = useCountry();
  const fromServer = useContext(OthersContext);
  const others = useSyncExternalStore(subscribe, readOthers, () => fromServer);
  return useMemo(() => localFor(country, others), [country, others]);
}

/** Marks the page as updating straight away, so nothing can read the old list as the new one before the server answers. */
function changing() {
  document.documentElement.setAttribute("data-updating", "");
}

export function setCountry(code: string) {
  if (code === read()) return;
  document.cookie = `${COUNTRY_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
  changing();
  window.dispatchEvent(new Event(EVENT));
}

export function setShowOthers(show: boolean) {
  document.cookie = `${OTHERS_COOKIE}=${show ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  changing();
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Lists and stores come from the server, so whenever the browser's choice differs from what the server last rendered, ask again:
 * the picker, the band's control, and a change made in another tab, read on focus. router.refresh() only clears the current route,
 * so after a change in this visit every later page asks again as well. Back and forward land on pages kept from before it.
 * Until the answer arrives the page reads as updating (html[data-updating] in globals.css) instead of passing old lists off as new.
 */
export function useFollowCountry(country: string | null, others: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const current = useCountry();
  const local = useLocal();
  const changed = useRef(false);
  const differs = (current !== null && current !== country) || local.others !== others;

  useEffect(() => {
    if (!differs) return;
    changed.current = true;
    startTransition(() => router.refresh());
  }, [differs, current, local.others, country, others, router]);

  useEffect(() => {
    if (changed.current) startTransition(() => router.refresh());
  }, [pathname, router]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-updating", pending || differs);
    document.getElementById("main")?.setAttribute("aria-busy", String(pending || differs));
  }, [pending, differs]);
}
