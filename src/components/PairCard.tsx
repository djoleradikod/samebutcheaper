import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PairSummary } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { ppu, money } from "@/lib/format";
import { MatchBadge, SavingsBadge } from "./Badges";
import { MarketTag } from "./MarketTag";

export function PairCard({ pair, rank }: { pair: PairSummary; rank?: number }) {
  const cat = CATEGORY_MAP[pair.category];
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="card group relative flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          {rank ? <span className="num mr-1.5 text-ink">#{rank}</span> : null}
          {pair.subcategory || cat.name}
        </span>
        <span className="flex items-center gap-1.5">
          <MarketTag market={pair.market} />
          <SavingsBadge pct={pair.savingsPct} />
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs text-brand-tone">Instead of</p>
          <p className="leading-snug font-medium text-ink-2 line-through decoration-brand-tone/40 decoration-1">
            {pair.brandName}
          </p>
          <p className="line-clamp-1 text-xs text-muted">{pair.brandProduct}</p>
        </div>
        <div>
          <p className="text-xs text-accent">Buy</p>
          <p className="text-lg leading-snug font-semibold">{pair.altName}</p>
          <p className="line-clamp-1 text-xs text-muted">{pair.altProduct}</p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        <div className="num flex items-end justify-between border-t border-line pt-4 text-sm">
          <div>
            <p className="text-xs text-muted">Per {pair.unit}</p>
            <p>
              <span className="text-muted line-through">{ppu(pair.brandPpu, pair.currency)}</span>{" "}
              <span className="font-semibold text-accent">{ppu(pair.altPpu, pair.currency)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted">Saved per pack</p>
            <p className="font-semibold">{money(pair.savingsPerPack, pair.currency)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <MatchBadge type={pair.matchType} />
          <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>
      </div>
    </Link>
  );
}
