import { Suspense, type ReactNode } from "react";
import { CountryProvider, FollowCountry } from "@/components/CountryProvider";
import { FallbackBand } from "@/components/Money";
import { LateBand } from "@/components/LateBand";
import { getAllPairs } from "@/lib/catalog";
import { localFor } from "@/lib/localize";
import { countryForPrefix } from "@/lib/country-url";
import { COUNTRIES } from "@/lib/markets";
import { getCountry, getLocal } from "@/lib/server-country";

/**
 * The band at the top of <main> that says whose prices the page shows, and asks the server again when the country
 * changes.
 *
 * It is not in the root layout: there it had to read the request to tell a prefixed URL from an unprefixed one, which
 * made every page render per request, prefixed ones too, although nothing on a prefixed page depends on the request.
 * Instead each place draws its own:
 * - unprefixed pages: ShopBand, from each section's layout.tsx (src/app/<section>/layout.tsx) and the home page,
 * - prefixed pages: FixedBand, from src/app/country/[country]/layout.tsx, in the static HTML,
 * - the 404 page: LateBand, drawn in the browser, since the 404 is part of every page's payload and must stay static.
 * scripts/tests/serving.test.ts checks that every section has one. The root layout draws none, but ships the band's
 * code (src/components/BandCode.tsx), so it comes in one file every page already has.
 */

/** How many swaps a shopper in each country could ask to see from other countries. Counted once per server. */
let hiddenByCountry: Record<string, number> | null = null;

export function hiddenCounts(): Record<string, number> {
  if (hiddenByCountry) return hiddenByCountry;
  const pairs = getAllPairs();
  const out: Record<string, number> = {};
  for (const country of Object.keys(COUNTRIES)) {
    const strict = localFor(country);
    const wide = localFor(country, true);
    const n = pairs.filter((p) => wide.shows(p) && !strict.shows(p)).length;
    if (n > 0) out[country] = n;
  }
  hiddenByCountry = out;
  return out;
}

async function ShopperBandBody() {
  const country = await getCountry();
  const { others } = await getLocal();
  return (
    <CountryProvider country={country} others={others}>
      <FollowCountry country={country} others={others} />
      <FallbackBand hidden={country ? (hiddenCounts()[country] ?? 0) : 0} />
    </CountryProvider>
  );
}

/**
 * The band of an unprefixed page: the shopper's country, from the cookie or what the proxy detected. It streams in
 * after the first paint; until then the slot holds its height (globals.css, `band-slot`, set from the cookie in the
 * root layout's script).
 */
export function ShopperBand() {
  return (
    <Suspense fallback={<div className="band-slot" aria-hidden="true" />}>
      <ShopperBandBody />
    </Suspense>
  );
}

/** A section's layout: the shopper's band above the page, where the root layout used to put it. */
export function ShopBand({ children }: { children: ReactNode }) {
  return (
    <>
      <ShopperBand />
      {children}
    </>
  );
}

/**
 * The band of a prefixed page: the URL's country, which can't show other countries' swaps, so it offers none. Static:
 * it is in the page's prerendered HTML.
 */
export function FixedBand({ prefix }: { prefix: string }) {
  const country = countryForPrefix(prefix);
  if (!country) return null;
  return (
    <CountryProvider country={country} others={false} fixed>
      <FollowCountry country={country} others={false} fixed />
      <FallbackBand hidden={0} />
    </CountryProvider>
  );
}

/** The 404 page's band: the shopper's, drawn in the browser from the cookie (see LateBand). */
export function NotFoundBand() {
  return <LateBand hidden={hiddenCounts()} />;
}
