"use client";

import type { ReactNode } from "react";
import { CountryContext } from "@/lib/client/country";

/** Hands the server's reading of the country to the first render, so the first paint is already right. */
export function CountryProvider({ country, children }: { country: string | null; children: ReactNode }) {
  return <CountryContext.Provider value={country}>{children}</CountryContext.Provider>;
}
