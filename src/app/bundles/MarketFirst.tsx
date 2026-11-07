"use client";

import { Fragment, type ReactNode } from "react";
import { useCountry } from "@/lib/client/country";
import type { MarketCode } from "@/lib/markets";

/** Moves the shopper's own market to the top. The groups themselves render on the server. */
export function MarketFirst({ groups }: { groups: { market: MarketCode; node: ReactNode }[] }) {
  const country = useCountry();
  const sorted = [...groups].sort((a, b) => Number(b.market === country) - Number(a.market === country));
  return (
    <>
      {sorted.map((g) => (
        <Fragment key={g.market}>{g.node}</Fragment>
      ))}
    </>
  );
}
