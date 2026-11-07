"use client";

import { Fragment, type ReactNode } from "react";
import { useCountry } from "@/lib/client/country";
import { listMarketFor } from "@/lib/localize";
import type { MarketCode } from "@/lib/markets";

/** Moves the shopper's own market to the top. The groups themselves render on the server. */
export function MarketFirst({ groups }: { groups: { market: MarketCode; node: ReactNode }[] }) {
  const lead = listMarketFor(useCountry());
  const sorted = [...groups].sort((a, b) => Number(b.market === lead) - Number(a.market === lead));
  return (
    <>
      {sorted.map((g) => (
        <Fragment key={g.market}>{g.node}</Fragment>
      ))}
    </>
  );
}
