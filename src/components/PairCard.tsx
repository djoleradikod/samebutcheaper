import Link from "next/link";
import type { PairSummary } from "@/lib/types";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { MarketNote } from "./CountryPicker";
import { ProductThumb } from "./ProductThumb";
import { PctTicket } from "./Ticket";
import { ToArrow, UnitPrice } from "./UnitPrice";

/**
 * Two photos edge to edge, brand left and cheaper right, with the ticket on the row beneath,
 * under the cheaper one, so it never covers a pack.
 * Dense enough for 4 across at 1320px and 2 across on a phone.
 */
export function PairCard({ pair, rank, eager = false }: { pair: PairSummary; rank?: number; eager?: boolean }) {
  const shelf = pair.subcategory || CATEGORY_MAP[pair.category].name;
  const kind = shelf.replace(/\s+-\s+/g, ": ");
  const tileKind = shelf.split(/\s+-\s+/).pop();
  const match = MATCH_TYPE_META[pair.matchType];
  // "Same active" alone is jargon; the other short names read fine.
  const matchText = pair.matchType === "identical_active" ? match.label : match.short;
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="card group flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:border-ink-2"
    >
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        <ProductThumb
          flush
          size="tile"
          image={pair.brandImage}
          brand={pair.brandName}
          alt={pair.brandProduct}
          kind={tileKind}
          eager={eager && !!pair.brandImage}
        />
        <ProductThumb
          flush
          size="tile"
          image={pair.altImage}
          brand={pair.altName}
          alt={pair.altProduct}
          kind={tileKind}
          eager={eager && !pair.brandImage}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col px-2 pt-1.5 pb-2 md:px-2.5 md:pb-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <p className="min-w-0 truncate text-xs font-medium text-muted">
            {rank ? <span className="num">{rank}. </span> : null}
            {kind}
          </p>
          <PctTicket pct={pair.savingsPct} size="sm" grow className="shrink-0" />
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-snug font-semibold group-hover:underline">
          {pair.brandName}
          <ToArrow />
          {pair.altName}
        </p>
        <UnitPrice
          unit={pair.unit}
          alt={pair.altPpu}
          brand={pair.brandPpu}
          currency={pair.currency}
          className="mt-auto pt-1.5"
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
