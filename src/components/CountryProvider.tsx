"use client";

import type { ReactNode } from "react";
import { CountryContext, OthersContext } from "@/lib/client/country";

/** Hands the server's reading of the country to the first render, so the first paint is already right. */
export function CountryProvider({ country, others, children }: { country: string | null; others: boolean; children: ReactNode }) {
  return (
    <CountryContext.Provider value={country}>
      <OthersContext.Provider value={others}>{children}</OthersContext.Provider>
    </CountryContext.Provider>
  );
}
