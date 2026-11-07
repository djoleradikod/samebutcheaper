"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  buildFacets,
  defaultMarket,
  matchRows,
  MEDICINE,
  PAGE_SIZE,
  parseState,
  SORTS,
  stateToQuery,
  SWAP_GRID,
  SWAP_GRID_BESIDE_FILTERS,
  type BrowseRow,
  type BrowseState,
  type FacetOption,
  type Facets,
  type SortKey,
} from "@/lib/browse";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { useCountry } from "@/lib/client/country";
import { loadSwapIndex } from "@/lib/client/swap-index";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import { MARKET_LABEL, type MarketCode } from "@/lib/markets";
import type { PairSummary } from "@/lib/types";
import { FilterSheet } from "./FilterSheet";
import { PairCard } from "./PairCard";

/** With this many shelves or fewer the whole list shows. Past it, the biggest few and a button. */
const SHELF_LIMIT = 10;
const SHELVES_COLLAPSED = 8;

const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);
const toggled = <T,>(list: T[], value: T) => (list.includes(value) ? without(list, value) : [...list, value]);
const swaps = (n: number) => `${n} swap${n === 1 ? "" : "s"}`;

/** One filter currently on, and the state with it taken off again. */
type ActiveFilter = { id: string; label: string; off: Partial<BrowseState> };

function activeFilters(s: BrowseState, facets: Facets, fallback: MarketCode | "all"): ActiveFilter[] {
  const shelfLabel = (key: string) => facets.shelves.find((o) => o.value === key)?.label ?? key.replace(/-/g, " ");
  return [
    ...s.aisles.map((a) => ({
      id: `aisle-${a}`,
      label: CATEGORY_MAP[a].name,
      off: { aisles: without(s.aisles, a), shelves: [] },
    })),
    ...s.shelves.map((k) => ({ id: `shelf-${k}`, label: shelfLabel(k), off: { shelves: without(s.shelves, k) } })),
    ...s.matches.map((m) => ({ id: `match-${m}`, label: MATCH_TYPE_META[m].label, off: { matches: without(s.matches, m) } })),
    ...(s.market && s.market !== "all" && s.market !== fallback
      ? [{ id: "market", label: `${MARKET_LABEL[s.market]} prices`, off: { market: "all" as const } }]
      : []),
    ...(s.photo ? [{ id: "photo", label: "With a photo", off: { photo: false } }] : []),
    ...(s.medicine ? [{ id: "medicine", label: "Medicine included", off: { medicine: false } }] : []),
  ];
}

/**
 * The filterable list of swaps. The first screen comes prerendered from `cards`, and `rows`
 * carries just enough about every swap to filter, count and sort at once in the browser.
 * Card data for the rest loads from the swap index the first time it's about to be needed.
 * All of the state lives in the URL, so a filtered list can be shared.
 */
export function PairBrowser({
  path,
  rows,
  cards,
  showRank = false,
  hideMedicine = false,
}: {
  /** This page's path, for writing the query back. */
  path: string;
  rows: BrowseRow[];
  cards: PairSummary[];
  /** Numbers the cards while the list shows its default order. */
  showRank?: boolean;
  /** Leaves medicine out until the shopper adds it. */
  hideMedicine?: boolean;
}) {
  const query = useUrlQuery(path);
  const country = useCountry();
  const state = useMemo(() => parseState(query), [query]);
  const fallbackMarket = defaultMarket(rows, country, hideMedicine);
  const market = state.market ?? fallbackMarket;

  const matched = useMemo(() => matchRows(rows, state, { market, hideMedicine }), [rows, state, market, hideMedicine]);
  const facets = useMemo(() => buildFacets(rows, state, { market, hideMedicine }), [rows, state, market, hideMedicine]);
  const active = activeFilters(state, facets, fallbackMarket);
  const shown = matched.slice(0, state.show);

  const prerendered = useMemo(() => new Map(cards.map((c) => [c.slug, c])), [cards]);
  const [index, setIndex] = useState<Map<string, PairSummary> | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);
  const fetchIndex = useCallback(
    () =>
      loadSwapIndex().then(
        (loaded) => setIndex((had) => had ?? new Map(loaded.pairs.map((p) => [p.slug, p]))),
        () => setIndexFailed(true),
      ),
    [],
  );
  const needsIndex = !index && shown.some((r) => !prerendered.has(r.slug));
  useEffect(() => {
    if (needsIndex) void fetchIndex();
  }, [needsIndex, fetchIndex]);
  /** Fetches ahead when the pointer or keyboard reaches the filters, so the first click is instant. */
  const warm = () => {
    if (index) return;
    setIndexFailed(false);
    void fetchIndex();
  };

  const [sheetOpen, setSheetOpen] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);
  const focusAt = useRef<number | null>(null);

  const update = (patch: Partial<BrowseState>, mode: "push" | "replace" = "push") => {
    focusAt.current = null;
    const next = { ...state, show: PAGE_SIZE, ...patch };
    writeUrlQuery(path, stateToQuery(next, window.location.search), mode);
  };
  const clearAll = () =>
    update({ aisles: [], shelves: [], matches: [], market: null, photo: false, medicine: false });

  // After "Show more", keyboard and screen reader users carry on from the first new card.
  useEffect(() => {
    if (focusAt.current === null) return;
    const link = listRef.current?.children[focusAt.current]?.querySelector("a");
    if (!link) return;
    link.focus({ preventScroll: true });
    focusAt.current = null;
  }, [shown.length, index]);
  const showMore = () => {
    update({ show: state.show + PAGE_SIZE }, "replace");
    focusAt.current = shown.length;
    warm();
  };

  const hasFilters =
    facets.aisles.length > 1 ||
    facets.shelves.length > 1 ||
    facets.matches.length > 1 ||
    facets.markets.length > 1 ||
    facets.photo !== null;
  const defaultView = active.length === 0 && state.sort === "saving" && (state.market ?? fallbackMarket) === fallbackMarket;
  const firstPhoto = shown.findIndex((r) => r.photo);
  const multiMarket = facets.markets.length > 1;
  const medicineLeftOut =
    hideMedicine && !state.medicine && !state.aisles.length
      ? (facets.aisles.find((a) => a.value === MEDICINE)?.count ?? 0)
      : 0;

  const summary = (
    <p className="min-w-0 text-sm text-ink-2" aria-live="polite">
      <span className="num font-semibold text-ink">{swaps(matched.length)}</span>
      {multiMarket && market !== "all" && ` with ${MARKET_LABEL[market]} prices`}.{" "}
      {multiMarket && market !== "all" && facets.allMarkets > matched.length && (
        <InlineButton onClick={() => update({ market: "all" })}>Show all countries ({facets.allMarkets})</InlineButton>
      )}{" "}
      {medicineLeftOut > 0 && (
        <>
          Medicine is left out.{" "}
          <InlineButton onClick={() => update({ medicine: true })}>Add it ({medicineLeftOut})</InlineButton>
        </>
      )}
    </p>
  );
  // One or two cards don't need ordering, and their count is already in the H1.
  const hasToolbar = hasFilters || rows.length > 2;

  const panel = (
    <FilterPanel
      facets={facets}
      state={state}
      market={market}
      onChange={(patch) => {
        update(patch);
        warm();
      }}
    />
  );

  return (
    <div className={hasFilters ? "lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6" : ""}>
      {hasFilters && (
        <aside
          aria-label="Filters"
          onPointerEnter={warm}
          onFocusCapture={warm}
          className="hidden lg:sticky lg:top-[4.25rem] lg:block lg:max-h-[calc(100dvh-5rem)] lg:self-start lg:overflow-y-auto lg:pr-2 lg:pl-1"
        >
          {panel}
        </aside>
      )}

      <div className="min-w-0">
        {hasToolbar && (
          <>
            <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2 border-y border-line bg-canvas px-4 py-2 sm:-mx-6 sm:px-6 md:top-14 lg:static lg:mx-0 lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0">
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(true);
                    warm();
                  }}
                  className="btn btn-ghost flex-1 lg:hidden"
                >
                  Filters
                  {active.length > 0 && <span className="num">({active.length})</span>}
                </button>
              )}
              <div className="hidden min-w-0 flex-1 lg:block">{summary}</div>
              <SortSelect value={state.sort} onChange={(sort) => update({ sort }, "replace")} />
            </div>
            <div className="mt-1 lg:hidden">{summary}</div>
          </>
        )}

        {active.length > 0 && (
          <ul className="rail -mx-4 mt-1 flex items-center gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-2 lg:flex-wrap lg:overflow-visible lg:px-0">
            {active.map((f) => (
              <li key={f.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => update(f.off)}
                  aria-label={`Remove filter: ${f.label}`}
                  className="flex h-11 items-center gap-1 rounded-tile border border-line-strong bg-paper pr-1.5 pl-2.5 text-[13px] font-medium hover:border-ink-2 lg:h-8"
                >
                  {f.label}
                  <X className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
            <li className="shrink-0">
              <button
                type="button"
                onClick={clearAll}
                className="flex h-11 items-center px-2 text-[13px] font-medium text-cobalt underline underline-offset-2 lg:h-8"
              >
                Clear all
              </button>
            </li>
          </ul>
        )}

        {state.sort === "unit" && (
          <p className="mt-1 text-[13px] text-muted lg:mt-2">
            Units differ between products, so unit prices compare best within a shelf.
            {multiMarket && market === "all" && " Other currencies are converted at a rough rate for this order."}
          </p>
        )}

        {matched.length === 0 ? (
          <NoMatches rows={rows} state={state} active={active} market={market} hideMedicine={hideMedicine} onUpdate={update} onClear={clearAll} />
        ) : (
          <ul ref={listRef} className={`${hasFilters ? SWAP_GRID_BESIDE_FILTERS : SWAP_GRID} mt-2 lg:mt-3`}>
            {shown.map((r, i) => {
              const card = prerendered.get(r.slug) ?? index?.get(r.slug);
              // An index from a newer deploy may have dropped this swap.
              if (!card) return index ? null : <CardPlaceholder key={r.slug} />;
              const startsMissing = !r.bothPhotos && i > 0 && shown[i - 1].bothPhotos;
              return (
                <Fragment key={r.slug}>
                  {startsMissing && (
                    <li className="col-span-full mt-3 border-t border-line pt-3">
                      <p className="text-sm font-semibold">More swaps, still missing a photo</p>
                    </li>
                  )}
                  <li className="min-w-0">
                    <PairCard
                      pair={card}
                      rank={showRank && defaultView && r.bothPhotos ? i + 1 : undefined}
                      eager={i === firstPhoto && i < 4}
                    />
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}

        {indexFailed && !index && (
          <p className="mt-3 text-sm text-ink-2" role="status">
            The rest of the list didn&apos;t load. <InlineButton onClick={warm}>Try again</InlineButton>
          </p>
        )}

        {matched.length > shown.length && (
          <div className="mt-4 flex flex-col items-center gap-1">
            <button type="button" onClick={showMore} onPointerEnter={warm} className="btn btn-ghost w-full sm:w-auto sm:min-w-64">
              Show {Math.min(PAGE_SIZE, matched.length - shown.length)} more
            </button>
            <p className="num text-[13px] text-muted">
              Showing {shown.length} of {matched.length}
            </p>
          </div>
        )}
      </div>

      {hasFilters && (
        <FilterSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          footer={
            <>
              <button type="button" onClick={clearAll} disabled={!active.length} className="btn btn-ghost flex-1 disabled:text-muted">
                Clear all
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-primary flex-[2]">
                Show {swaps(matched.length)}
              </button>
            </>
          }
        >
          {sheetOpen && panel}
        </FilterSheet>
      )}
    </div>
  );
}

function InlineButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 hover:text-cobalt-strong lg:min-h-0"
    >
      {children}
    </button>
  );
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (sort: SortKey) => void }) {
  return (
    <label className="flex flex-1 items-center gap-2 lg:flex-none">
      <span className="sr-only text-[13px] font-medium whitespace-nowrap text-ink-2 lg:not-sr-only">Sort by</span>
      <span className="relative block min-w-0 flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortKey)}
          className="h-11 w-full cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-base font-semibold hover:border-ink-2 lg:h-9 lg:text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </span>
    </label>
  );
}

function CardPlaceholder() {
  return (
    <li aria-hidden="true" className="card flex min-h-64 min-w-0 flex-col p-2 md:p-2.5">
      <div className="grid grid-cols-2 gap-1.5">
        <span className="aspect-square rounded-tile bg-canvas" />
        <span className="aspect-square rounded-tile bg-canvas" />
      </div>
      <span className="mt-3 h-3 w-1/2 rounded-tile bg-canvas" />
      <span className="mt-2 h-3 w-5/6 rounded-tile bg-canvas" />
    </li>
  );
}

/** Says which filter is in the way and what taking it off would show. */
function NoMatches({
  rows,
  state,
  active,
  market,
  hideMedicine,
  onUpdate,
  onClear,
}: {
  rows: BrowseRow[];
  state: BrowseState;
  active: ActiveFilter[];
  market: MarketCode | "all";
  hideMedicine: boolean;
  onUpdate: (patch: Partial<BrowseState>) => void;
  onClear: () => void;
}) {
  const addMedicine = { id: "add-medicine", label: "medicine", off: { medicine: true } };
  const tries = [...active, ...(hideMedicine && !state.medicine ? [addMedicine] : [])]
    .map((f) => {
      const next = { ...state, ...f.off };
      return { f, count: matchRows(rows, next, { market: next.market ?? market, hideMedicine }).length };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  return (
    <div className="card mt-3 p-5">
      <p className="font-semibold">No swaps match all of those filters.</p>
      {tries.length > 0 && <p className="mt-1 text-sm text-ink-2">Try taking one off:</p>}
      <ul className="mt-1 text-sm">
        {tries.map(({ f, count }) => (
          <li key={f.id}>
            <InlineButton onClick={() => onUpdate(f.off)}>
              {f === addMedicine ? "Add medicine" : `Remove “${f.label}”`} to see {swaps(count)}
            </InlineButton>
          </li>
        ))}
        <li>
          <InlineButton onClick={onClear}>Clear all filters</InlineButton>
        </li>
      </ul>
    </div>
  );
}

function FilterPanel({
  facets,
  state,
  market,
  onChange,
}: {
  facets: Facets;
  state: BrowseState;
  market: MarketCode | "all";
  onChange: (patch: Partial<BrowseState>) => void;
}) {
  const radioName = useId();
  const [allShelves, setAllShelves] = useState(false);
  const shelves =
    allShelves || facets.shelves.length <= SHELF_LIMIT
      ? facets.shelves
      : facets.shelves.filter((o, i) => i < SHELVES_COLLAPSED || state.shelves.includes(o.value));

  return (
    <div className="divide-y divide-line">
      {facets.aisles.length > 1 && (
        <Group title="Aisle">
          <Checks
            options={facets.aisles}
            selected={state.aisles}
            onToggle={(a) => onChange({ aisles: toggled(state.aisles, a), shelves: [] })}
          />
        </Group>
      )}

      {facets.shelves.length > 1 && (
        <Group title="Shelf">
          <Checks
            options={shelves}
            selected={state.shelves}
            onToggle={(s) => onChange({ shelves: toggled(state.shelves, s) })}
          />
          {facets.shelves.length > SHELF_LIMIT && (
            <button
              type="button"
              onClick={() => setAllShelves(!allShelves)}
              aria-expanded={allShelves}
              className="flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline lg:min-h-8"
            >
              {allShelves ? "Show fewer shelves" : `Show all ${facets.shelves.length} shelves`}
            </button>
          )}
        </Group>
      )}

      {facets.matches.length > 1 && (
        <Group title="How strong the match is">
          <Checks
            options={facets.matches}
            selected={state.matches}
            titleFor={(m) => MATCH_TYPE_META[m].description}
            onToggle={(m) => onChange({ matches: toggled(state.matches, m) })}
          />
          <Link
            href="/how-we-verify"
            className="flex min-h-11 items-center text-[13px] font-medium text-cobalt underline-offset-2 hover:underline lg:min-h-7"
          >
            What these mean
          </Link>
        </Group>
      )}

      {facets.markets.length > 1 && (
        <Group title="Prices from">
          <OptionRow
            type="radio"
            name={radioName}
            label="All countries"
            count={facets.allMarkets}
            checked={market === "all"}
            onChange={() => onChange({ market: "all" })}
          />
          {facets.markets.map((m) => (
            <OptionRow
              key={m.value}
              type="radio"
              name={radioName}
              label={m.label}
              count={m.count}
              checked={market === m.value}
              onChange={() => onChange({ market: m.value })}
            />
          ))}
        </Group>
      )}

      {facets.photo !== null && (
        <Group title="Photos">
          <OptionRow
            type="checkbox"
            label="With a photo"
            count={facets.photo}
            checked={state.photo}
            onChange={() => onChange({ photo: !state.photo })}
          />
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <fieldset>
        <legend className="mb-0.5 text-[13px] font-bold [font-stretch:112%]">{title}</legend>
        {children}
      </fieldset>
    </div>
  );
}

function Checks<V extends string>({
  options,
  selected,
  onToggle,
  titleFor,
}: {
  options: FacetOption<V>[];
  selected: V[];
  onToggle: (value: V) => void;
  titleFor?: (value: V) => string;
}) {
  return options.map((o) => (
    <OptionRow
      key={o.value}
      type="checkbox"
      label={o.label}
      count={o.count}
      title={titleFor?.(o.value)}
      checked={selected.includes(o.value)}
      onChange={() => onToggle(o.value)}
    />
  ));
}

function OptionRow({
  type,
  name,
  label,
  count,
  checked,
  title,
  onChange,
}: {
  type: "checkbox" | "radio";
  name?: string;
  label: string;
  count: number;
  checked: boolean;
  title?: string;
  onChange: () => void;
}) {
  // An option that would empty the list can't be picked, so filters don't lead to a dead end.
  const dead = count === 0 && !checked;
  return (
    <label
      title={title}
      className={`flex min-h-11 items-center gap-2 py-1 text-sm leading-snug lg:min-h-8 ${dead ? "text-muted" : "cursor-pointer hover:underline"}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={dead}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-ink"
      />
      <span className="min-w-0 flex-1">{label}</span>
      <span className="num text-[13px] font-medium text-muted">{count}</span>
    </label>
  );
}
