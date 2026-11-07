"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketNote } from "@/components/CountryPicker";
import { ProductThumb } from "@/components/ProductThumb";
import { Ticket } from "@/components/Ticket";
import { ToArrow } from "@/components/UnitPrice";
import { defaultMarket, marketsIn, parseState, stateToQuery, type BrowseRow } from "@/lib/browse";
import { CATEGORY_MAP } from "@/lib/categories";
import { useCountry } from "@/lib/client/country";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import { MARKET_LABEL, type MarketCode } from "@/lib/markets";
import { NO_PHOTO_TIER } from "@/lib/photos";
import type { ShelfLife } from "@/lib/types";
import { trimNote } from "./shelf-note";

const PATH = "/bulk";

/** How long a shelf-life note can run before it's cut: on a row with photos, and on a text row. */
const NOTE_LIMIT = 110;
const COMPACT_NOTE_LIMIT = 70;

/** The text rows and their column heads share these columns on a tablet and up. */
const COMPACT_COLUMNS = "md:grid-cols-[minmax(0,1fr)_15rem_7rem_3.25rem] md:gap-x-4 md:px-3";

/** One swap with a bigger pack. The figures arrive already formatted, in the swap's own currency. */
export type BulkItem = BrowseRow & {
  kind: string;
  brandName: string;
  brandProduct: string;
  brandImage: string | null;
  altName: string;
  altProduct: string;
  altImage: string | null;
  biggerProduct: string;
  unitLabel: string;
  normalUnitPrice: string;
  biggerUnitPrice: string;
  normalPack: string;
  biggerPack: string;
  normalPrice: string;
  biggerPrice: string;
  /** The bigger pack's price as a number, for sorting. */
  biggerPriceValue: number;
  biggerUrl: string;
  biggerAt: string;
  extraSavingPct: number;
  advice: ShelfLife["advice"] | null;
  unopened: string;
  opened: string;
};

/** What the shelf-life record says to do, then the swaps with no record. */
const GROUPS: { advice: BulkItem["advice"]; id: string; title: string; body: string }[] = [
  {
    advice: "stock_up",
    id: "stock-up",
    title: "Stock up",
    body: "These keep for years, so you have time to use a big pack.",
  },
  {
    advice: "buy_to_use",
    id: "buy-to-use",
    title: "Buy to use",
    body: "Fine in bulk if you get through it in time. Check how long each one keeps.",
  },
  {
    advice: "buy_small",
    id: "buy-small",
    title: "Buy small",
    body: "These don't last long once opened, so the lower unit price only helps if you finish them in time.",
  },
  {
    advice: null,
    id: "no-record",
    title: "No shelf-life record yet",
    body: "We have no record of how long these keep. Check the date on the pack before buying a lot.",
  },
];

const swaps = (n: number) => `${n} swap${n === 1 ? "" : "s"}`;

const ORDERS = [
  { value: "bulk", label: "Most saved by going bigger", compare: (a: BulkItem, b: BulkItem) => b.extraSavingPct - a.extraSavingPct },
  { value: "brand", label: "Most saved against the brand", compare: (a: BulkItem, b: BulkItem) => b.pct - a.pct },
  { value: "pack", label: "Lowest pack price", compare: (a: BulkItem, b: BulkItem) => a.biggerPriceValue - b.biggerPriceValue },
];

const SELECT =
  "h-11 w-full cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-sm font-semibold text-ink";

/** Prices follow the shopper's country as on every other list, and a choice here lives in the URL. */
export function BulkList({ items }: { items: BulkItem[] }) {
  const query = useUrlQuery(PATH);
  const country = useCountry();
  const state = useMemo(() => parseState(query), [query]);
  const market = state.market ?? defaultMarket(items, country);
  const setMarket = (next: MarketCode | "all") =>
    writeUrlQuery(PATH, stateToQuery({ ...state, market: next }, window.location.search), "push");

  const [aisle, setAisle] = useState("all");
  const [orderBy, setOrderBy] = useState(ORDERS[0].value);

  const inMarket = items.filter((i) => market === "all" || i.market === market);
  const aisles = [...new Set(inMarket.map((i) => i.aisle))].sort((a, b) => CATEGORY_MAP[a].name.localeCompare(CATEGORY_MAP[b].name));
  // A choice of aisle can outlive a change of country that has none of it.
  const activeAisle = aisles.some((a) => a === aisle) ? aisle : "all";
  const compare = ORDERS.find((o) => o.value === orderBy)?.compare ?? ORDERS[0].compare;
  const shown = inMarket.filter((i) => activeAisle === "all" || i.aisle === activeAisle);
  const ordered = [...shown].sort((a, b) => a.tier - b.tier || compare(a, b) || a.slug.localeCompare(b.slug));
  const groups = GROUPS.map((g) => ({ ...g, items: ordered.filter((i) => i.advice === g.advice) })).filter(
    (g) => g.items.length > 0,
  );
  // Each group is in photo order, so the first row of the first group is the page's first photo, if it has any.
  const lead = groups[0]?.items[0];
  const eagerSlug = lead && lead.tier !== NO_PHOTO_TIER ? lead.slug : null;

  return (
    <>
      <MarketChoice items={items} market={market} onChange={setMarket} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm text-ink-2" aria-live="polite">
          <span className="num font-semibold text-ink">{swaps(shown.length)}</span>
          {market === "all" ? " with a bigger pack, each priced in its own country." : ` with a bigger pack and ${MARKET_LABEL[market]} prices.`}
        </p>
        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center">
          <label className="block min-w-0">
            <span className="sr-only">Aisle</span>
            <span className="relative block md:w-44">
              <select value={activeAisle} onChange={(e) => setAisle(e.target.value)} className={SELECT}>
                <option value="all">All aisles</option>
                {aisles.map((a) => (
                  <option key={a} value={a}>
                    {CATEGORY_MAP[a].name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Sort by</span>
            <span className="relative block md:w-64">
              <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)} className={SELECT}>
                {ORDERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
          </label>
        </div>
      </div>

      {groups.length > 1 && (
        <nav aria-label="On this page" className="mt-1 flex flex-wrap gap-x-4 text-sm font-medium">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-7">
              {g.title} (<span className="num">{g.items.length}</span>)
            </a>
          ))}
        </nav>
      )}

      {shown.length === 0 && market !== "all" && (
        <div className="card mt-3 p-5">
          <p className="font-semibold">No bigger packs with {MARKET_LABEL[market]} prices yet.</p>
          <button
            type="button"
            onClick={() => setMarket("all")}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2 lg:min-h-0"
          >
            Show all countries
          </button>
        </div>
      )}

      {groups.map((g) => (
        <BulkGroup key={g.id} group={g} eagerSlug={eagerSlug} />
      ))}
    </>
  );
}

function MarketChoice({
  items,
  market,
  onChange,
}: {
  items: BulkItem[];
  market: MarketCode | "all";
  onChange: (next: MarketCode | "all") => void;
}) {
  const markets = marketsIn(items);
  if (markets.length < 2) return null;
  const options = [
    { value: "all" as const, label: "All countries", count: items.length },
    ...markets.map((m) => ({ value: m, label: MARKET_LABEL[m], count: items.filter((i) => i.market === m).length })),
  ];
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 border-y border-line py-1 md:py-1.5">
      <legend className="float-left mr-4 flex min-h-11 items-center text-[13px] font-bold [font-stretch:112%] md:min-h-8">Prices from</legend>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm hover:underline md:min-h-8">
          <input
            type="radio"
            name="bulk-market"
            checked={market === o.value}
            onChange={() => onChange(o.value)}
            className="h-4 w-4 shrink-0 accent-ink"
          />
          {o.label}
          <span className="num text-[13px] font-medium text-muted">{o.count}</span>
        </label>
      ))}
    </fieldset>
  );
}

function BulkGroup({
  group,
  eagerSlug,
}: {
  group: (typeof GROUPS)[number] & { items: BulkItem[] };
  eagerSlug: string | null;
}) {
  const withPhoto = group.items.filter((i) => i.tier !== NO_PHOTO_TIER);
  const noPhoto = group.items.filter((i) => i.tier === NO_PHOTO_TIER);
  return (
    <section id={group.id} className="mt-6 scroll-mt-20 md:mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div className="max-w-[68ch]">
          <h2 className="display text-xl md:text-2xl">{group.title}</h2>
          <p className="mt-1 text-sm text-ink-2 md:text-[15px]">{group.body}</p>
        </div>
        {group.advice && (
          <Link
            href={`/why#advice-${group.advice}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0"
          >
            Shelf lives, with sources
          </Link>
        )}
      </div>
      {withPhoto.length > 0 && (
        <ul className="grid gap-2 md:gap-3">
          {withPhoto.map((item) => (
            <BulkRow key={item.slug} item={item} eager={item.slug === eagerSlug} />
          ))}
        </ul>
      )}
      {noPhoto.length > 0 && (
        <>
          {withPhoto.length > 0 && <h3 className="mt-5 mb-2 text-base">More bigger packs</h3>}
          <div className="card overflow-hidden">
            <p aria-hidden="true" className={`hidden border-b border-line py-1.5 text-xs font-medium text-muted md:grid ${COMPACT_COLUMNS}`}>
              <span>Swap</span>
              <span>Unit price, bigger vs normal pack</span>
              <span>Bigger pack</span>
              <span className="text-right">Saving</span>
            </p>
            <ul className="divide-y divide-line">
              {noPhoto.map((item) => (
                <CompactRow key={item.slug} item={item} />
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

/** Where the bigger pack's price came from. It sits above the link stretched over the row, so it stays its own target. */
function StoreLink({ item }: { item: BulkItem }) {
  return (
    <a
      href={item.biggerUrl}
      target="_blank"
      rel="nofollow noopener"
      className="relative z-10 font-medium whitespace-nowrap text-cobalt underline underline-offset-2"
    >
      {item.biggerAt}
    </a>
  );
}

/**
 * A swap with no photo, as a text row in one panel: the names and full product name, the bigger pack's
 * unit price against the normal pack's, the bigger pack's size, the saving and a line on how long it keeps.
 * The name is the link, stretched over the whole row. The words the column heads carry on a
 * tablet stay printed on a phone, and stay there for screen readers.
 */
function CompactRow({ item }: { item: BulkItem }) {
  const extra = Math.round(item.extraSavingPct);
  return (
    <li
      className={`group relative grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 px-2.5 py-2 transition-colors hover:bg-canvas ${COMPACT_COLUMNS}`}
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <p className="text-sm leading-snug font-semibold">
          <Link href={`/compare/${item.slug}`} className="after:absolute after:inset-0 group-hover:underline">
            {item.brandName}
            <ToArrow />
            {item.altName}
          </Link>
        </p>
        <p className="text-xs leading-snug text-ink-2">
          {item.biggerProduct}
          <MarketNote market={item.market} className="ml-2 font-medium" />
        </p>
      </div>

      {extra > 0 ? (
        <Ticket
          size="sm"
          className="col-start-2 row-start-1 justify-self-end md:col-start-4"
          label={`${extra}% less ${item.unitLabel} than the normal pack`}
        >
          −{extra}%
        </Ticket>
      ) : (
        <span className="col-start-2 row-start-1 text-xs font-medium text-muted md:col-start-4 md:text-right">No saving</span>
      )}

      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 md:contents">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 md:col-start-2 md:row-start-1">
          <span className="price text-lg leading-none text-ink">{item.biggerUnitPrice}</span>
          <span className="price text-[13px] font-semibold text-muted">vs {item.normalUnitPrice}</span>
          <span className="text-xs leading-tight font-medium text-muted">
            <span className="md:sr-only">normal pack, </span>
            {item.unitLabel}
          </span>
        </p>
        <p className="text-[13px] text-ink-2 md:col-start-3 md:row-start-1">
          <span className="md:sr-only">Bigger pack </span>
          {item.biggerPack}, {item.biggerPrice} <StoreLink item={item} />
        </p>
      </div>

      {item.unopened && (
        <p className="col-span-2 row-start-3 line-clamp-2 text-xs leading-snug text-ink-2 md:col-span-1 md:col-start-1 md:row-start-2">
          <span className="font-medium text-ink">Unopened: </span>
          {trimNote(item.unopened, COMPACT_NOTE_LIMIT).lead}
        </p>
      )}
    </li>
  );
}

/**
 * Brand and cheaper photos, then the bigger pack against the normal one, then how long it keeps.
 * The name is the link, stretched over the whole card.
 */
function BulkRow({ item, eager = false }: { item: BulkItem; eager?: boolean }) {
  const extra = Math.round(item.extraSavingPct);
  const unopened = trimNote(item.unopened, NOTE_LIMIT);
  const opened = trimNote(item.opened, NOTE_LIMIT);
  return (
    <li className="card group relative min-w-0 p-3 transition-colors hover:border-ink-2 md:p-4">
      <div className="grid gap-3 md:grid-cols-2 md:gap-x-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:gap-3">
          <div className="flex shrink-0 gap-1">
            <ProductThumb image={item.brandImage} brand={item.brandName} alt={item.brandProduct} eager={eager && !!item.brandImage} />
            <ProductThumb image={item.altImage} brand={item.altName} alt={item.altProduct} eager={eager && !item.brandImage} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{item.kind}</p>
            <h3 className="mt-0.5 text-[15px] leading-snug font-semibold">
              <Link href={`/compare/${item.slug}`} className="after:absolute after:inset-0 after:rounded-[8px] group-hover:underline">
                {item.brandName}
                <ToArrow />
                {item.altName}
              </Link>
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">{item.biggerProduct}</p>
            <MarketNote market={item.market} className="mt-1 block text-xs font-medium" />
          </div>
        </div>

        <div className="min-w-0">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5">
            <dt className="text-[13px] font-medium text-ink">Bigger pack</dt>
            <dd className="min-w-0">
              <span className="price text-[1.375rem] text-ink">{item.biggerUnitPrice}</span>{" "}
              <span className="text-xs font-medium text-muted">{item.unitLabel}</span>
              <span className="block text-[13px] text-ink-2">
                {item.biggerPack}, {item.biggerPrice} <StoreLink item={item} />
              </span>
            </dd>
            <dt className="text-[13px] font-medium text-ink-2">Normal pack</dt>
            <dd className="min-w-0">
              <span className="price text-[15px] font-semibold text-muted">{item.normalUnitPrice}</span>{" "}
              <span className="text-xs font-medium text-muted">{item.unitLabel}</span>
              <span className="block text-[13px] text-ink-2">
                {item.normalPack}, {item.normalPrice}
              </span>
            </dd>
          </dl>
          {extra > 0 ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
              <Ticket size="sm" className="shrink-0" label={`${extra}% less ${item.unitLabel} than the normal pack`}>
                −{extra}%
              </Ticket>
              <span aria-hidden="true">vs the normal pack</span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2">It costs no less {item.unitLabel} than the normal pack.</p>
          )}
        </div>

        {item.advice && (
          <div className="min-w-0 text-[13px] leading-snug text-ink-2 md:col-span-2 lg:col-span-1">
            <p>
              <span className="font-medium text-ink">Unopened: </span>
              {unopened.lead}
            </p>
            {item.opened && (
              <p className="mt-1">
                <span className="font-medium text-ink">Once opened: </span>
                {opened.lead}
              </p>
            )}
            {(unopened.rest || opened.rest) && (
              // Above the link stretched over the card, so a tap here opens this and not the swap page.
              <details className="relative z-10 mt-1">
                <summary className="cursor-pointer py-3 font-medium text-cobalt md:py-0">More on how long it keeps</summary>
                {unopened.rest && (
                  <p className="mt-1">
                    <span className="font-medium text-ink">Unopened: </span>
                    {unopened.rest}
                  </p>
                )}
                {opened.rest && (
                  <p className="mt-1">
                    <span className="font-medium text-ink">Once opened: </span>
                    {opened.rest}
                  </p>
                )}
              </details>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
