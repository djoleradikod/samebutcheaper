"use client";

import { useMemo, useState } from "react";
import type { MatchType, PairSummary } from "@/lib/types";
import { MATCH_TYPE_META } from "@/lib/categories";
import { APPROX_USD, flag, isMarket, MARKET_CODES, MARKET_LABEL, type MarketCode } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { PairCard } from "./PairCard";

type Sort = "score" | "pct" | "dollars" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "score", label: "Best overall saving" },
  { value: "pct", label: "Highest % saved" },
  { value: "dollars", label: "Most saved per pack" },
  { value: "name", label: "Brand A–Z" },
];

export function PairBrowser({ pairs, showRank = false }: { pairs: PairSummary[]; showRank?: boolean }) {
  const [sort, setSort] = useState<Sort>("score");
  const [sub, setSub] = useState<string>("all");
  const [match, setMatch] = useState<MatchType | "all">("all");
  const country = useCountry();
  const [marketChoice, setMarket] = useState<MarketCode | "all" | null>(null);

  const markets = useMemo(
    () => MARKET_CODES.map((m) => ({ code: m, count: pairs.filter((p) => p.market === m).length })).filter((m) => m.count),
    [pairs],
  );
  // Until the shopper picks, show their own country's prices when we have some.
  const market = marketChoice ?? (isMarket(country) && markets.some((m) => m.code === country) ? country : "all");

  const subcategories = useMemo(
    () => Array.from(new Set(pairs.map((p) => p.subcategory))).sort(),
    [pairs],
  );
  const matchTypes = useMemo(() => Array.from(new Set(pairs.map((p) => p.matchType))), [pairs]);

  const shown = useMemo(() => {
    const list = pairs.filter(
      (p) =>
        (market === "all" || p.market === market) &&
        (sub === "all" || p.subcategory === sub) &&
        (match === "all" || p.matchType === match),
    );
    const sorted = [...list];
    const cash = (p: PairSummary) => p.savingsPerPack * APPROX_USD[p.currency];
    if (sort === "pct") sorted.sort((a, b) => b.savingsPct - a.savingsPct);
    else if (sort === "dollars") sorted.sort((a, b) => cash(b) - cash(a));
    else if (sort === "name") sorted.sort((a, b) => a.brandName.localeCompare(b.brandName));
    else sorted.sort((a, b) => b.score - a.score);
    return sorted;
  }, [pairs, sort, sub, match, market]);

  const select =
    "h-10 rounded-xl border border-line-strong bg-surface px-3 text-sm focus:border-accent focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {markets.length > 1 && (
          <select
            aria-label="Prices from"
            value={market}
            onChange={(e) => setMarket(e.target.value as MarketCode | "all")}
            className={select}
          >
            <option value="all">All countries</option>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {flag(m.code)} {MARKET_LABEL[m.code]} prices ({m.count})
              </option>
            ))}
          </select>
        )}
        {subcategories.length > 1 && (
          <select aria-label="Filter by type" value={sub} onChange={(e) => setSub(e.target.value)} className={select}>
            <option value="all">All types</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {matchTypes.length > 1 && (
          <select
            aria-label="Filter by match standard"
            value={match}
            onChange={(e) => setMatch(e.target.value as MatchType | "all")}
            className={select}
          >
            <option value="all">Any match standard</option>
            {matchTypes.map((m) => (
              <option key={m} value={m}>
                {MATCH_TYPE_META[m].label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className={`${select} sm:ml-auto`}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className="num mt-4 text-sm text-muted">
        {shown.length} swap{shown.length === 1 ? "" : "s"}
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <PairCard key={p.slug} pair={p} rank={showRank && sort === "score" && sub === "all" && match === "all" ? i + 1 : undefined} />
        ))}
      </div>
      {shown.length === 0 && (
        <p className="card mt-3 p-8 text-center text-muted">No swaps match those filters yet.</p>
      )}
    </div>
  );
}
