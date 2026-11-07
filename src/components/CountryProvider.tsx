"use client";

import type { ReactNode } from "react";
import { CountryContext, OthersContext, useFollowCountry } from "@/lib/client/country";

function FollowCountry({ country, others }: { country: string | null; others: boolean }) {
  useFollowCountry(country, others);
  return null;
}

/** Hands the server's reading of the country to the first render, so the first paint is already right, and keeps the page following it. */
export function CountryProvider({ country, others, children }: { country: string | null; others: boolean; children: ReactNode }) {
  return (
    <CountryContext.Provider value={country}>
      <OthersContext.Provider value={others}>
        <FollowCountry country={country} others={others} />
        {children}
      </OthersContext.Provider>
    </CountryContext.Provider>
  );
}
