import Link from "@/components/CountryLink";
import type { Currency } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import { MarketNote } from "./CountryPicker";
import { ProductThumb } from "./ProductThumb";
import { SaveTicket } from "./Ticket";
import { ToArrow } from "./UnitPrice";
import { Money } from "./Money";

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
  /** How many stores the cheaper side comes from. */
  storeCount: number;
  /** Up to four real photos. */
  photos: { src: string; name: string }[];
  /** Brand names for typographic tiles, for a basket with no photos to show. */
  tileNames: string[];
};

/** Which grid cell each photo takes, by how many photos there are. */
export const COLLAGE_CELLS: Record<number, string[]> = {
  1: ["col-span-2 row-span-2"],
  2: ["row-span-2", "row-span-2"],
  3: ["row-span-2", "", ""],
  4: ["", "", "", ""],
};

function Collage({ basket, eager }: { basket: BasketSummary; eager: boolean }) {
  const photos = basket.photos.slice(0, 4);
  // A basket with no photos to show gets typographic tiles. The cells fit however many there are.
  const tiles = photos.length ? photos : basket.tileNames.slice(0, 4).map((name) => ({ src: null, name }));
  const cells = COLLAGE_CELLS[tiles.length] ?? [];
  const sizes = tiles.length === 1 ? "(min-width: 768px) 180px, 300px" : "(min-width: 768px) 90px, 150px";
  if (photos.length === 2) {
    // Two narrow columns leave each pack small with white above and below. Set corner to corner, they can be bigger. White melts away where they meet.
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-tile border border-line bg-white md:aspect-square">
        {photos.map((p, i) => (
          <div key={p.src} className={`absolute h-[66%] w-[66%] ${i === 0 ? "top-0 left-0" : "right-0 bottom-0 mix-blend-multiply"}`}>
            <ProductThumb flush size="fill" image={p.src} brand={p.name} eager={eager && i === 0} sizes="(min-width: 768px) 120px, 200px" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid aspect-[4/3] w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-tile border border-line bg-white md:aspect-square">
      {tiles.map((p, i) => (
        <div key={p.src ?? p.name} className={`min-h-0 min-w-0 ${cells[i]}`}>
          <ProductThumb flush size="fill" image={p.src} brand={p.name} eager={eager && i === 0 && !!p.src} sizes={sizes} />
        </div>
      ))}
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
      <div className="w-full shrink-0 md:w-36 lg:w-40 xl:w-44">
        <Collage basket={b} eager={eager} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="display text-lg leading-tight group-hover:underline">{b.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2">{b.audience}</p>
        {/* Pinned to the bottom, so prices and tickets line up across a row whatever the title's length. */}
        <div className="mt-auto pt-2.5">
          <p className="flex flex-wrap gap-x-2 text-[13px] leading-tight font-medium text-ink-2">
            <span>
              {b.itemCount} item{b.itemCount === 1 ? "" : "s"}, {b.storeCount} store{b.storeCount === 1 ? "" : "s"}
            </span>
            <MarketNote market={b.market} />
          </p>
          <p className="mt-1 flex items-baseline whitespace-nowrap">
            <span className="price text-base leading-none font-semibold text-muted"><Money n={b.brandTotal} from={b.currency} /></span>
            <ToArrow className="text-muted" />
            <span className="price text-xl leading-none text-ink"><Money n={b.altTotal} from={b.currency} /></span>
          </p>
          <SaveTicket size="md" amount={b.savings} currency={b.currency} className="mt-2" />
        </div>
      </div>
    </Link>
  );
}
