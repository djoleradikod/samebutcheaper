import Link from "next/link";
import type { Currency } from "@/lib/format";
import { money } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import { MarketNote } from "./CountryPicker";
import { ProductThumb } from "./ProductThumb";
import { SaveTicket } from "./Ticket";
import { ToArrow } from "./UnitPrice";

/** All a basket card needs, so the home page doesn't ship whole presets to the browser. */
export type BasketSummary = {
  slug: string;
  market: MarketCode;
  title: string;
  audience: string;
  brandTotal: number;
  altTotal: number;
  savings: number;
  savingsPct: number;
  currency: Currency;
  itemCount: number;
  /** Up to four real photos of the cheaper items. */
  photos: { src: string; name: string }[];
};

/** Which grid cell each photo takes, by how many photos there are. */
export const COLLAGE_CELLS: Record<number, string[]> = {
  1: ["col-span-2 row-span-2"],
  2: ["row-span-2", "row-span-2"],
  3: ["row-span-2", "", ""],
  4: ["", "", "", ""],
};

function Collage({ photos, eager }: { photos: BasketSummary["photos"]; eager: boolean }) {
  const shown = photos.slice(0, 4);
  const cells = COLLAGE_CELLS[shown.length];
  return (
    <div className="grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 gap-1 md:aspect-square">
      {cells ? (
        shown.map((p, i) => (
          <div key={p.src} className={`min-h-0 min-w-0 ${cells[i]}`}>
            <ProductThumb
              size="fill"
              image={p.src}
              brand={p.name}
              eager={eager && i === 0}
              sizes="(min-width: 768px) 90px, 130px"
            />
          </div>
        ))
      ) : (
        // A basket with no photos yet: empty tiles, with nothing drawn to pass for a product.
        <>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="rounded-tile border border-dashed border-line-strong bg-canvas" />
          ))}
        </>
      )}
    </div>
  );
}

/** A whole shop, swapped. The most important card on the site. */
export function BasketCard({ basket: b, eager = false }: { basket: BasketSummary; eager?: boolean }) {
  return (
    <Link
      href={`/basket/${b.slug}`}
      className="card group flex h-full flex-col gap-2.5 p-2.5 transition-colors hover:border-ink-2 md:flex-row md:gap-3.5 md:p-3"
    >
      <div className="w-full shrink-0 md:w-40 xl:w-44">
        <Collage photos={b.photos} eager={eager} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="display text-lg leading-tight group-hover:underline">{b.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2">{b.audience}</p>
        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-1 leading-none">
          <span className="text-[13px] font-medium text-muted">Same shop:</span>
          <span className="price text-base leading-none font-semibold text-muted">{money(b.brandTotal, b.currency)}</span>
          <ToArrow className="text-muted" />
          <span className="price text-xl leading-none text-ink">{money(b.altTotal, b.currency)}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2.5">
          <SaveTicket size="lg" amount={b.savings} currency={b.currency} />
          <p className="flex flex-wrap gap-x-2 text-[13px] leading-tight font-medium text-ink-2">
            <span>
              {b.itemCount} item{b.itemCount === 1 ? "" : "s"}
            </span>
            <MarketNote market={b.market} />
          </p>
        </div>
      </div>
    </Link>
  );
}
