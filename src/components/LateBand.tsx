"use client";

import { useContext, useSyncExternalStore } from "react";
import { CountryProvider, FollowCountry } from "@/components/CountryProvider";
import { FallbackBand } from "@/components/Money";
import { FixedContext, readCountryCookie, readOthersCookie, subscribe } from "@/lib/client/country";
import { countryOfPath } from "@/lib/country-url";

/**
 * "GB|1": the cookie's country and the shopper's choice to see other countries' swaps ("|0" with no country).
 * "US|0|1" at a prefixed address (/us/compare/gone): the URL's country, fixed, as on every prefixed page.
 */
export function readView(): string {
  const here = countryOfPath(window.location.pathname);
  if (here) return `${here}|0|1`;
  const country = readCountryCookie();
  return `${country ?? ""}|${country && readOthersCookie() ? 1 : 0}`;
}

/**
 * The shopper's band, drawn in the browser: for the 404 page, which is part of every page's payload, so a band read
 * from the request there would make every page render per request. The same band the server draws elsewhere (see
 * src/components/CountryBand.tsx); until the browser has read the cookie, the slot holds its height, as it does while
 * the server's band streams in. `hidden`: per country, how many swaps "Show swaps from other countries" brings back.
 *
 * At a prefixed address it is the URL's band, as FixedBand draws it, and asks nothing of the server: a band that
 * followed the cookie there sees a country the URL overrides, refreshes, gets the 404 document instead of the router's
 * data, and the browser reloads it for ever. Inside /de's layout (the German 404), that layout's FixedBand is already
 * there, so this draws nothing. Kept small: the 404's code comes with every page.
 */
export function LateBand({ hidden }: { hidden: Record<string, number> }) {
  const inFixed = useContext(FixedContext);
  const view = useSyncExternalStore(subscribe, readView, () => null);
  if (inFixed) return null;
  if (view === null) return <div className="band-slot" aria-hidden="true" />;
  const [code, others, fixed] = view.split("|");
  const country = code || null;
  return (
    <CountryProvider country={country} others={others === "1"} fixed={!!fixed}>
      {/* A 404 shows nothing that depends on the country: at a prefixed address there is nothing to ask again for. */}
      {!fixed && <FollowCountry country={country} others={others === "1"} />}
      <FallbackBand hidden={country && !fixed ? (hidden[country] ?? 0) : 0} />
    </CountryProvider>
  );
}
