"use client";

import { CountryProvider, FollowCountry } from "@/components/CountryProvider";
import { LateBand } from "@/components/LateBand";
import { FallbackBand } from "@/components/Money";

const BAND = [CountryProvider, FollowCountry, FallbackBand, LateBand];

/**
 * Draws nothing. Every page has a country band (src/components/CountryBand.tsx), but drawn from section layouts, the
 * prefixed layout and the 404 rather than the root layout, so the band's code was bundled apart from the root
 * layout's: an extra file on every page, and a second copy inside other routes' files. Referenced from the root
 * layout, it ships with the root layout's code again, once, as it did when the band was drawn there.
 */
export function BandCode() {
  return BAND.length ? null : null;
}
