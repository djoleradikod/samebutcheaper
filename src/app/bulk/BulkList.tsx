"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MarketNote } from "@/components/CountryPicker";
import { ProductThumb } from "@/components/ProductThumb";
import { Ticket } from "@/components/Ticket";
import { ToArrow } from "@/components/UnitPrice";
import { defaultMarket, marketsIn, parseState, stateToQuery, type BrowseRow } from "@/lib/browse";
import { useCountry } from "@/lib/client/country";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import { MARKET_LABEL, type MarketCode } from "@/lib/markets";
import { NO_PHOTO_TIER } from "@/lib/photos";
import type { ShelfLife } from "@/lib/types";

const PATH = "/bulk";

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

/** Prices follow the shopper's country as on every other list, and a choice here lives in the URL. */
export function BulkList({ items }: { items: BulkItem[] }) {
  const query = useUrlQuery(PATH);
  const country = useCountry();
  const state = useMemo(() => parseState(query), [query]);
  const market = state.market ?? defaultMarket(items, country);
  const setMarket = (next: MarketCode | "all") =>
    writeUrlQuery(PATH, stateToQuery({ ...state, market: next }, window.location.search), "push");

  const shown = items.filter((i) => market === "all" || i.market === market);
  const groups = GROUPS.map((g) => ({ ...g, items: shown.filter((i) => i.advice === g.advice) })).filter(
    (g) => g.items.length > 0,
  );
  // Each group is in photo order, so the first row of the first group is the page's first photo, if it has any.
  const lead = groups[0]?.items[0];
  const eagerSlug = lead && lead.tier !== NO_PHOTO_TIER ? lead.slug : null;

  return (
    <>
      <MarketChoice items={items} market={market} onChange={setMarket} />

      <p className="mt-2 text-sm text-ink-2" aria-live="polite">
        <span className="num font-semibold text-ink">{swaps(shown.length)}</span>
        {market === "all" ? " with a bigger pack, each priced in its own country." : ` with a bigger pack and ${MARKET_LABEL[market]} prices.`}
      </p>

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
            <BulkRow key={item.slug} item={item} title={group.title} eager={item.slug === eagerSlug} />
          ))}
        </ul>
      )}
      {noPhoto.length > 0 && (
        <>
          {withPhoto.length > 0 && <h3 className="mt-5 mb-2 text-base">More swaps, still missing a photo</h3>}
          <ul className="grid gap-2 md:gap-3">
            {noPhoto.map((item) => (
              <BulkRow key={item.slug} item={item} title={group.title} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * Brand and cheaper photos, then the bigger pack against the normal one, then how long it keeps.
 * The name is the link, stretched over the whole card. A swap with no photo drops the tiles.
 */
function BulkRow({ item, title, eager = false }: { item: BulkItem; title: string; eager?: boolean }) {
  const extra = Math.round(item.extraSavingPct);
  return (
    <li className="card group relative min-w-0 p-3 transition-colors hover:border-ink-2 md:p-4">
      <div className="grid gap-3 md:grid-cols-2 md:gap-x-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:gap-3">
          {item.tier !== NO_PHOTO_TIER && (
            <div className="flex shrink-0 gap-1">
              <ProductThumb image={item.brandImage} brand={item.brandName} alt={item.brandProduct} eager={eager && !!item.brandImage} />
              <ProductThumb image={item.altImage} brand={item.altName} alt={item.altProduct} eager={eager && !item.brandImage} />
            </div>
          )}
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
                {item.biggerPack}, {item.biggerPrice}
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
              <span aria-hidden="true">{item.unitLabel} against the normal pack</span>
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-ink-2">It costs no less {item.unitLabel} than the normal pack.</p>
          )}
        </div>

        {item.advice && (
          <div className="min-w-0 text-[13px] leading-snug text-ink-2 md:col-span-2 lg:col-span-1">
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-1">
              <span className="font-medium text-ink">Unopened: </span>
              {item.unopened}
            </p>
            {item.opened && (
              <p className="mt-1">
                <span className="font-medium text-ink">Once opened: </span>
                {item.opened}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
