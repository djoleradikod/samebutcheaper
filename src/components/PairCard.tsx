import type { ReactNode } from "react";
import Link from "next/link";
import type { MatchType, PairSummary } from "@/lib/types";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { MarketNote } from "./CountryPicker";
import { ProductThumb } from "./ProductThumb";
import { PctTicket } from "./Ticket";
import { ToArrow, UnitPrice } from "./UnitPrice";

/** "Same active" alone is jargon; the other short names read fine. */
function matchText(type: MatchType) {
  const match = MATCH_TYPE_META[type];
  return type === "identical_active" ? match.label : match.short;
}

/**
 * Two tiles edge to edge, brand left and cheaper right, with the ticket on the row beneath,
 * under the cheaper one, so it never covers a pack. A missing side gets a typographic tile.
 * Dense enough for 4 across at 1320px and 2 across on a phone.
 *
 * Lists show a swap with no photo at all as a PairRow. The places that always show a card, such as
 * search results and related swaps, get this card with no tiles, so there's never a card of two empty ones.
 */
export function PairCard({ pair, rank, eager = false }: { pair: PairSummary; rank?: number; eager?: boolean }) {
  const shelf = pair.subcategory || CATEGORY_MAP[pair.category].name;
  const kind = shelf.replace(/\s+-\s+/g, ": ");
  const match = MATCH_TYPE_META[pair.matchType];
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="card group flex h-full min-w-0 flex-col overflow-hidden transition-colors hover:border-ink-2"
    >
      {(pair.brandImage || pair.altImage) && (
        <div className="grid grid-cols-2 border-b border-line bg-white">
          <ProductThumb
            flush
            size="tile"
            image={pair.brandImage}
            brand={pair.brandName}
            alt={pair.brandProduct}
            eager={eager && !!pair.brandImage}
          />
          <ProductThumb
            flush
            size="tile"
            image={pair.altImage}
            brand={pair.altName}
            alt={pair.altProduct}
            eager={eager && !pair.brandImage}
          />
        </div>
      )}

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
            {matchText(pair.matchType)}
          </span>
          <MarketNote market={pair.market} />
        </p>
      </div>
    </Link>
  );
}

/**
 * A swap with no photo on either side, as one line of text on a desktop and two on a phone:
 * brand to cheaper name and the saving, then unit price against unit price and the match.
 */
export function PairRow({ pair }: { pair: PairSummary }) {
  return (
    <Link
      href={`/compare/${pair.slug}`}
      className="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-2.5 py-2 transition-colors hover:bg-canvas md:grid-cols-[minmax(0,1fr)_14rem_9rem_3.25rem] md:gap-x-4 md:px-3"
    >
      <p className="col-start-1 row-start-1 min-w-0 text-sm leading-snug font-semibold group-hover:underline">
        {pair.brandName}
        <ToArrow />
        {pair.altName}
      </p>
      <PctTicket pct={pair.savingsPct} size="sm" className="col-start-2 row-start-1 justify-self-end md:col-start-4" />
      <div className="col-span-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 md:contents">
        <UnitPrice size="sm" unit={pair.unit} alt={pair.altPpu} brand={pair.brandPpu} currency={pair.currency} />
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-medium">
          <span className={pair.matchType === "same_kind" ? "text-muted" : "text-same"} title={MATCH_TYPE_META[pair.matchType].description}>
            {matchText(pair.matchType)}
          </span>
          <MarketNote market={pair.market} />
        </p>
      </div>
    </Link>
  );
}

/** Goes where a list's first photo tier ends, since the chosen sort starts again from the top there. Smaller than a section head. */
export function MoreSwapsHeading() {
  return <h2 className="mt-5 mb-2 text-base md:mt-6">More swaps</h2>;
}

/**
 * The panel of PairRows that ends a list. `below` means there are cards above it, and `headed` means
 * those cards are all one tier, so this is where the heading goes. Otherwise the rows just carry on.
 */
export function PairRows({ headed, below, children }: { headed: boolean; below: boolean; children: ReactNode }) {
  return (
    <>
      {headed && <MoreSwapsHeading />}
      <ul className={`card divide-y divide-line overflow-hidden ${below && !headed ? "mt-2 sm:mt-3" : ""}`}>{children}</ul>
    </>
  );
}
