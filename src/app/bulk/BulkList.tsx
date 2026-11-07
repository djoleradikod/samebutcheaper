"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MarketNote } from "@/components/CountryPicker";
import { Group, OptionRow } from "@/components/FilterOption";
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

/** How long a shelf-life note can run on a row before it's cut. */
const NOTE_LIMIT = 90;

/** The rows and their column heads share these columns once the filters sit beside the list with room to spare. */
const COLUMNS = "xl:grid-cols-[minmax(0,1fr)_10rem_9.5rem_8.5rem] xl:gap-x-4";

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
  /** The bigger pack's price in rough dollars, so packs from different countries sort together. */
  biggerPriceUsd: number;
  biggerUrl: string;
  biggerAt: string;
  extraSavingPct: number;
  /** What the bigger pack costs less than the same amount in normal packs. */
  packSaving: string;
  /** How much less per unit the bigger pack costs than the brand. */
  againstBrandPct: number;
  advice: ShelfLife["advice"] | null;
  unopened: string;
  opened: string;
};

type KeepValue = "stock_up" | "buy_to_use" | "buy_small" | "none";

/** What the shelf-life record says to do, then the swaps with no record. */
const KEEPS: { value: KeepValue; advice: BulkItem["advice"]; title: string; body: string }[] = [
  { value: "stock_up", advice: "stock_up", title: "Stock up", body: "These keep for years, so you have time to use a big pack." },
  {
    value: "buy_to_use",
    advice: "buy_to_use",
    title: "Buy to use",
    body: "Fine in bulk if you get through it in time. Check how long each one keeps.",
  },
  {
    value: "buy_small",
    advice: "buy_small",
    title: "Buy small",
    body: "These don't last long once opened, so the lower unit price only helps if you finish them in time.",
  },
  {
    value: "none",
    advice: null,
    title: "No shelf-life record",
    body: "We have no record of how long these keep. Check the date on the pack before buying a lot.",
  },
];

const swaps = (n: number) => `${n} swap${n === 1 ? "" : "s"}`;

const ORDERS = [
  { value: "bulk", label: "Most saved by going bigger", compare: (a: BulkItem, b: BulkItem) => b.extraSavingPct - a.extraSavingPct },
  { value: "brand", label: "Most saved against the brand", compare: (a: BulkItem, b: BulkItem) => b.againstBrandPct - a.againstBrandPct },
  { value: "pack", label: "Lowest pack price", compare: (a: BulkItem, b: BulkItem) => a.biggerPriceUsd - b.biggerPriceUsd },
];

/** Prices follow the shopper's country as on every other list, and a choice of country lives in the URL. */
export function BulkList({ items }: { items: BulkItem[] }) {
  const query = useUrlQuery(PATH);
  const country = useCountry();
  const state = useMemo(() => parseState(query), [query]);
  const market = state.market ?? defaultMarket(items, country);
  const setMarket = (next: MarketCode | "all") =>
    writeUrlQuery(PATH, stateToQuery({ ...state, market: next }, window.location.search), "push");

  const [aisle, setAisle] = useState("all");
  const [keep, setKeep] = useState<KeepValue | "all">("all");
  const [orderBy, setOrderBy] = useState(ORDERS[0].value);

  const inMarket = items.filter((i) => market === "all" || i.market === market);
  const aisles = [...new Set(inMarket.map((i) => i.aisle))].sort((a, b) => CATEGORY_MAP[a].name.localeCompare(CATEGORY_MAP[b].name));
  // A choice can outlive a change of country that has none of it.
  const activeAisle = aisles.some((a) => a === aisle) ? aisle : "all";
  const inAisle = inMarket.filter((i) => activeAisle === "all" || i.aisle === activeAisle);
  const keeps = KEEPS.map((k) => ({ ...k, count: inAisle.filter((i) => i.advice === k.advice).length }));
  const chosenKeep = keeps.find((k) => k.value === keep && k.count > 0) ?? null;
  const matchesKeep = (i: BulkItem) => !chosenKeep || i.advice === chosenKeep.advice;

  const compare = ORDERS.find((o) => o.value === orderBy)?.compare ?? ORDERS[0].compare;
  const shown = inAisle.filter(matchesKeep).sort((a, b) => compare(a, b) || a.slug.localeCompare(b.slug));
  // The first row with a photo holds the page's first photo.
  const eagerSlug = shown.find((i) => i.tier !== NO_PHOTO_TIER)?.slug ?? null;

  const aisleOptions = aisles.map((a) => ({
    value: a as string,
    label: CATEGORY_MAP[a].name,
    count: inMarket.filter((i) => i.aisle === a && matchesKeep(i)).length,
  }));
  const allAisles = inMarket.filter(matchesKeep).length;
  const markets = marketsIn(items);

  return (
    <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6">
      <aside
        aria-label="Filters"
        className="hidden divide-y divide-line lg:sticky lg:top-[4.25rem] lg:block lg:max-h-[calc(100dvh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-2 lg:pl-1"
      >
        <MarketGroup items={items} market={market} onChange={setMarket} />
        <Group title="How long it keeps">
          <OptionRow type="radio" name="bulk-keep" label="Any" count={inAisle.length} checked={!chosenKeep} onChange={() => setKeep("all")} />
          {keeps.map((k) => (
            <OptionRow
              key={k.value}
              type="radio"
              name="bulk-keep"
              label={k.title}
              count={k.count}
              checked={chosenKeep?.value === k.value}
              onChange={() => setKeep(k.value)}
            />
          ))}
        </Group>
        <Group title="Aisle">
          <OptionRow type="radio" name="bulk-aisle" label="All aisles" count={allAisles} checked={activeAisle === "all"} onChange={() => setAisle("all")} />
          {aisleOptions.map((o) => (
            <OptionRow
              key={o.value}
              type="radio"
              name="bulk-aisle"
              label={o.label}
              count={o.count}
              checked={activeAisle === o.value}
              onChange={() => setAisle(o.value)}
            />
          ))}
        </Group>
      </aside>

      <div className="min-w-0">
        <div className="lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {markets.length > 1 && (
              <Select label="Prices from" value={market} onChange={(v) => setMarket(v as MarketCode | "all")} className="col-span-2">
                <option value="all">Prices from all countries ({items.length})</option>
                {markets.map((m) => (
                  <option key={m} value={m}>
                    {MARKET_LABEL[m]} prices ({items.filter((i) => i.market === m).length})
                  </option>
                ))}
              </Select>
            )}
            <Select label="Aisle" value={activeAisle} onChange={setAisle}>
              <option value="all">All aisles</option>
              {aisleOptions.map((o) => (
                <option key={o.value} value={o.value} disabled={o.count === 0}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="How long it keeps" value={chosenKeep?.value ?? "all"} onChange={(v) => setKeep(v as KeepValue | "all")}>
              <option value="all">Any shelf life</option>
              {keeps.map((k) => (
                <option key={k.value} value={k.value} disabled={k.count === 0}>
                  {k.title} ({k.count})
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 lg:mt-0">
          <p className="text-sm text-ink-2" aria-live="polite">
            <span className="num font-semibold text-ink">{swaps(shown.length)}</span>
            {market === "all" ? " with a bigger pack, each priced in its own country." : ` with a bigger pack and ${MARKET_LABEL[market]} prices.`}
          </p>
          <Select label="Sort by" value={orderBy} onChange={setOrderBy} className="w-full md:w-64">
            {ORDERS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {chosenKeep && (
          <p className="mt-2 text-sm text-ink-2">
            {chosenKeep.body}{" "}
            {chosenKeep.advice && (
              <Link href={`/why#advice-${chosenKeep.advice}`} className="font-medium whitespace-nowrap text-cobalt underline-offset-2 hover:underline">
                Shelf lives, with sources
              </Link>
            )}
          </p>
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

        {shown.length > 0 && (
          <div className="card mt-3 overflow-hidden">
            <p aria-hidden="true" className={`hidden border-b border-line px-3 py-1.5 text-xs font-medium text-muted xl:grid ${COLUMNS}`}>
              <span>Swap</span>
              <span>Unit price, bigger pack</span>
              <span>You pay</span>
              <span className="text-right">Saving</span>
            </p>
            <ul className="divide-y divide-line">
              {shown.map((item) => (
                <BulkRow key={item.slug} item={item} eager={item.slug === eagerSlug} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  className = "",
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-sm font-semibold text-ink"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </span>
    </label>
  );
}

function MarketGroup({
  items,
  market,
  onChange,
}: {
  items: BulkItem[];
  market: MarketCode | "all";
  onChange: (next: MarketCode | "all") => void;
}) {
  const name = "bulk-market";
  const markets = marketsIn(items);
  if (markets.length < 2) return null;
  return (
    <Group title="Prices from">
      <OptionRow type="radio" name={name} label="All countries" count={items.length} checked={market === "all"} onChange={() => onChange("all")} />
      {markets.map((m) => (
        <OptionRow
          key={m}
          type="radio"
          name={name}
          label={MARKET_LABEL[m]}
          count={items.filter((i) => i.market === m).length}
          checked={market === m}
          onChange={() => onChange(m)}
        />
      ))}
    </Group>
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
 * One swap: both products, the bigger pack's unit price against the normal pack's, what you pay up front, what
 * that saves, and how long it keeps. The name is the link, stretched over the whole row. With no licensed
 * photo ProductThumb prints the name on a plain tile, so every row has the same shape.
 */
function BulkRow({ item, eager }: { item: BulkItem; eager: boolean }) {
  const extra = Math.round(item.extraSavingPct);
  const keep = KEEPS.find((k) => k.advice === item.advice);
  const unopened = trimNote(item.unopened, NOTE_LIMIT);
  const more = [unopened.rest && `Unopened: ${unopened.rest}`, item.opened && `Once opened: ${item.opened}`].filter(Boolean);
  return (
    <li className={`group relative grid min-w-0 gap-x-3 gap-y-2 p-3 transition-colors hover:bg-canvas ${COLUMNS}`}>
      <div className="flex min-w-0 gap-3">
        <div className="flex shrink-0 gap-1">
          <ProductThumb size="sm" image={item.brandImage} brand={item.brandName} alt={item.brandProduct} eager={eager && !!item.brandImage} />
          <ProductThumb size="sm" image={item.altImage} brand={item.altName} alt={item.altProduct} eager={eager && !item.brandImage} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{item.kind}</p>
          <h2 className="text-[15px] leading-snug font-semibold">
            <Link href={`/compare/${item.slug}`} className="after:absolute after:inset-0 group-hover:underline">
              {item.brandName}
              <ToArrow />
              {item.altName}
            </Link>
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            {item.biggerProduct}
            <MarketNote market={item.market} className="ml-2 text-xs font-medium" />
          </p>
          <p className="mt-1 text-xs leading-snug text-ink-2">
            <span className={item.advice ? "font-semibold text-ink" : "font-medium text-muted"}>{keep?.title}</span>
            {item.unopened && (
              <>
                . Unopened: {unopened.lead}
              </>
            )}
          </p>
          {more.length > 0 && (
            // Above the link stretched over the row, so a tap here opens this and not the swap page.
            <details className="relative z-10 text-xs leading-snug text-ink-2">
              <summary className="cursor-pointer py-3 font-medium text-cobalt xl:py-0.5">More on how long it keeps</summary>
              {more.map((text) => (
                <p key={text} className="mt-1">
                  {text}
                </p>
              ))}
            </details>
          )}
        </div>
      </div>

      <p className="min-w-0">
        <span className="price text-xl leading-none text-ink">{item.biggerUnitPrice}</span>{" "}
        <span className="text-xs font-medium text-muted">{item.unitLabel}</span>
        <span className="mt-0.5 block text-xs text-ink-2">
          Normal pack <span className="price text-[13px] font-semibold text-muted">{item.normalUnitPrice}</span>
        </span>
      </p>

      <p className="min-w-0 text-[13px] leading-snug text-ink-2">
        <span className="font-semibold text-ink">{item.biggerPrice}</span> for {item.biggerPack} <StoreLink item={item} />
        <span className="block text-xs text-muted">
          Normal pack {item.normalPrice} for {item.normalPack}
        </span>
      </p>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug text-ink-2 xl:flex-col xl:items-end xl:text-right">
        {extra > 0 ? (
          <>
            <Ticket size="sm" label={`${extra}% less ${item.unitLabel} than the normal pack`}>
              −{extra}%
            </Ticket>
            <span className="font-medium text-ink">{item.packSaving} less on this pack</span>
          </>
        ) : (
          <span className="font-medium text-muted">No saving on the normal pack</span>
        )}
        {item.againstBrandPct > 0 && (
          <span>
            {item.againstBrandPct}% less than {item.brandName}
          </span>
        )}
      </div>
    </li>
  );
}
