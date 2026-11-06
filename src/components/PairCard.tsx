import Link from "next/link";
import type { PairSummary } from "@/lib/types";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { MarketNote } from "./CountryPicker";
import { ProductThumb } from "./ProductThumb";
import { PctTicket } from "./Ticket";
import { ToArrow, UnitPrice } from "./UnitPrice";

/**
 * Two tiles, brand left and cheaper right, with the ticket on the cheaper one's corner.
 * Dense enough for 4 across at 1320px and 2 across on a phone.
 */
export function PairCard({ pair, rank, eager = false }: { pair: PairSummary; rank?: number; eager?: boolean }) {
  const kind = (pair.subcategory || CATEGORY_MAP[pair.category].name).replace(/\s+-\s+/g, ": ");
  const match = MATCH_TYPE_META[pair.matchType];
  // "Same active" alone is jargon; the other short names read fine.
  const matchText = pair.matchType === "identical_active" ? match.label : match.short;
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="card group flex h-full min-w-0 flex-col p-2 transition-colors hover:border-ink-2 md:p-2.5"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <ProductThumb
          size="tile"
          image={pair.brandImage}
          brand={pair.brandName}
          alt={pair.brandProduct}
          category={pair.category}
          unit={pair.unit}
          eager={eager && !!pair.brandImage}
        />
        <div className="relative">
          <ProductThumb
            size="tile"
            image={pair.altImage}
            brand={pair.altName}
            alt={pair.altProduct}
            category={pair.category}
            unit={pair.unit}
            eager={eager && !pair.brandImage}
          />
          <PctTicket pct={pair.savingsPct} size="sm" grow className="absolute -top-1 -right-1" />
        </div>
      </div>

      <div className="mt-2 flex min-w-0 flex-1 flex-col">
        <p className="truncate text-xs font-medium text-muted">
          {rank ? <span className="num">{rank}. </span> : null}
          {kind}
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug font-semibold group-hover:underline">
          {pair.brandName}
          <ToArrow />
          {pair.altName}
        </p>
        <UnitPrice
          unit={pair.unit}
          alt={pair.altPpu}
          brand={pair.brandPpu}
          currency={pair.currency}
          className="mt-auto pt-2"
        />
        <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-medium">
          <span className="text-same" title={match.description}>
            {matchText}
          </span>
          <MarketNote market={pair.market} />
        </p>
      </div>
    </Link>
  );
}
