"use client";

import { useSyncExternalStore } from "react";
import { shopperPrefixCountry } from "@/lib/shopper-links";
import { subscribe } from "./country";

function read() {
  try {
    return shopperPrefixCountry(document.cookie, navigator.userAgent);
  } catch {
    return null;
  }
}

/**
 * The country an unprefixed page's links should carry for this shopper (src/lib/shopper-links.ts). Null on the server
 * and in the first render, so the HTML and hydration stay as written; it follows a change of country at once.
 */
export function useShopperPrefix() {
  return useSyncExternalStore(subscribe, read, () => null);
}
