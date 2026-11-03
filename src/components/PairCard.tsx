import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PairSummary } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { ppu, money } from "@/lib/format";
import { MatchBadge, SavingsBadge } from "./Badges";
import { MarketTag } from "./MarketTag";
import { ProductThumb } from "./ProductThumb";

export function PairCard({ pair, rank }: { pair: PairSummary; rank?: number }) {
  const cat = CATEGORY_MAP[pair.category];
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="card group relative flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_14px_34px_-14px_rgba(10,138,82,0.35)]"
    >
      {/* The two products, pictured */}
      <div className="relative flex items-center justify-center gap-3 bg-gradient-to-br from-tint via-white to-surface-2 px-5 pt-5 pb-4">
        <div className="relative opacity-80 grayscale-[35%]">
          <ProductThumb image={pair.brandImage} brand={pair.brandName} category={pair.category} unit={pair.unit} />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-tone shadow-sm ring-1 ring-line">
            Brand
          </span>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-accent shadow-sm ring-1 ring-line">
          <ArrowRight className="h-4 w-4" />
        </span>
        <div className="relative">
          <ProductThumb
            image={pair.altImage}
            brand={pair.altName}
            category={pair.category}
            unit={pair.unit}
            className="ring-2 ring-accent/50"
          />
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-accent-ink shadow-sm">
            Cheaper
          </span>
        </div>
        <span className="absolute top-3 right-3">
          <SavingsBadge pct={pair.savingsPct} />
        </span>
        {rank ? (
          <span className="num absolute top-3 left-3 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink shadow-sm ring-1 ring-line">
            #{rank}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">{pair.subcategory || cat.name}</span>
          <MarketTag market={pair.market} />
        </div>

        <div className="mt-3 space-y-2.5">
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

        <div className="mt-auto pt-4">
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
      </div>
    </Link>
  );
}
