"use client";

import type { ReactNode } from "react";
import { CountryContext, FixedContext, OthersContext, useFollowCountry } from "@/lib/client/country";

/** Keeps the page following the country. One per page, from the root layout's band, inside a CountryProvider. */
export function FollowCountry({ country, others, fixed = false }: { country: string | null; others: boolean; fixed?: boolean }) {
  useFollowCountry(country, others, fixed);
  return null;
}

/**
 * Hands the server's reading of the country to the first render, so the first paint is already right. See CountryPart.
 * `fixed`: the country is the page's (a prefixed URL, or the record's own view), so the browser's cookie doesn't change it.
 */
export function CountryProvider({
  country,
  others,
  fixed = false,
  children,
}: {
  country: string | null;
  others: boolean;
  fixed?: boolean;
  children: ReactNode;
}) {
  return (
    <CountryContext.Provider value={country}>
      <OthersContext.Provider value={others}>
        <FixedContext.Provider value={fixed}>{children}</FixedContext.Provider>
      </OthersContext.Provider>
    </CountryContext.Provider>
  );
}
