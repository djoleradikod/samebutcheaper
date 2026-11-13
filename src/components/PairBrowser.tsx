"use client";

import Link from "@/components/CountryLink";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import {
  buildFacets,
  defaultMarket,
  matchRows,
  MEDICINE,
  PAGE_SIZE,
  parseState,
  SORTS,
  cardIn,
  splitAtFirstTier,
  stateToQuery,
  SWAP_GRID,
  SWAP_GRID_BESIDE_FILTERS,
  type BrowseRow,
  type BrowseState,
  type FacetOption,
  type Facets,
  type IndexPair,
  type SortKey,
} from "@/lib/browse";
import { useCountry } from "@/lib/client/country";
import { loadSwapIndex } from "@/lib/client/swap-index";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import type { MarketCode } from "@/lib/markets";
import { useLang, useT } from "@/lib/i18n/client";
import { clientT, type ClientT } from "@/lib/i18n/client-dict";
import { NO_PHOTO_TIER } from "@/lib/photos";
import type { PairSummary } from "@/lib/types";
import { FilterSheet } from "./FilterSheet";
import { Group, OptionRow } from "./FilterOption";
import { MoreSwapsHeading, PairCard, PairRow, PairRows } from "./PairCard";
import { browse } from "@/lib/i18n/en/client/browse";
import { cards } from "@/lib/i18n/en/client/cards";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { browse, cards };

/** With this many shelves or fewer the whole list shows. Past it, the biggest few and a button. */
const SHELF_LIMIT = 10;
const SHELVES_COLLAPSED = 8;

const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);
const toggled = <T,>(list: T[], value: T) => (list.includes(value) ? without(list, value) : [...list, value]);

/** One filter currently on, and the state with it taken off again. */
type ActiveFilter = { id: string; label: string; off: Partial<BrowseState> };

function activeFilters(s: BrowseState, facets: Facets, fallback: MarketCode | "all", t: ClientT<typeof TEXT>): ActiveFilter[] {
  const shelfLabel = (key: string) => facets.shelves.find((o) => o.value === key)?.label ?? key.replace(/-/g, " ");
  return [
    ...s.aisles.map((a) => ({
      id: `aisle-${a}`,
      label: t("cards.aisle", a),
      off: { aisles: without(s.aisles, a), shelves: [] },
    })),
    ...s.shelves.map((k) => ({ id: `shelf-${k}`, label: shelfLabel(k), off: { shelves: without(s.shelves, k) } })),
    ...s.matches.map((m) => ({ id: `match-${m}`, label: t("cards.matchLabel", m), off: { matches: without(s.matches, m) } })),
    ...(s.market && s.market !== "all" && s.market !== fallback
      ? [{ id: "market", label: t("browse.marketPrices", s.market), off: { market: "all" as const } }]
      : []),
    ...(s.photo ? [{ id: "photo", label: t("browse.withPhoto"), off: { photo: false } }] : []),
    ...(s.medicine ? [{ id: "medicine", label: t("browse.medicineIncluded"), off: { medicine: false } }] : []),
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
  const lang = useLang();
  const t = clientT(lang, TEXT);
  const facets = useMemo(() => {
    const f = buildFacets(rows, state, { market, hideMedicine });
    if (lang === "en") return f;
    const tr = clientT(lang, TEXT);
    return {
      ...f,
      aisles: f.aisles.map((o) => ({ ...o, label: tr("cards.aisle", o.value) })),
      matches: f.matches.map((o) => ({ ...o, label: tr("cards.matchLabel", o.value) })),
      markets: f.markets.map((o) => ({ ...o, label: tr("cards.marketLabel", o.value) })),
    };
  }, [rows, state, market, hideMedicine, lang]);
  const active = activeFilters(state, facets, fallbackMarket, t);
  const shown = matched.slice(0, state.show);

  const prerendered = useMemo(() => new Map(cards.map((c) => [c.slug, c])), [cards]);
  const [index, setIndex] = useState<Map<string, IndexPair> | null>(null);
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

  const listRef = useRef<HTMLDivElement>(null);
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
    const link = listRef.current?.querySelector<HTMLAnchorElement>(`[data-row="${focusAt.current}"] a`);
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
  // Tiers put the no-photo rows last, so everything before the first one is a card.
  const firstText = shown.findIndex((r) => r.tier === NO_PHOTO_TIER);
  const cardRows = firstText < 0 ? shown : shown.slice(0, firstText);
  const textRows = firstText < 0 ? [] : shown.slice(firstText);
  // The sort starts again where the first tier ends, so that's where the heading goes.
  const [firstTier, laterTiers] = splitAtFirstTier(cardRows, (r) => r.tier);
  const grid = hasFilters ? SWAP_GRID_BESIDE_FILTERS : SWAP_GRID;
  const renderCard = (r: BrowseRow, i: number) => {
    const card = prerendered.get(r.slug) ?? index?.get(r.slug);
    // An index from a newer deploy may have dropped this swap.
    if (!card) return index ? null : <CardPlaceholder key={r.slug} />;
    // The numbers stop with the first tier: past it the saving starts again from the top.
    const ranked = showRank && defaultView && i < firstTier.length;
    return (
      <li key={r.slug} data-row={i} className="min-w-0">
        <PairCard pair={lang === "en" ? card : { ...cardIn(card, lang), subcategory: r.shelf }} rank={ranked ? i + 1 : undefined} eager={i === firstPhoto && i < 4} lang={lang} />
      </li>
    );
  };
  const explainSameJob = path.startsWith("/category/") && matched.some((r) => r.match === "equivalent_spec");
  const explainSameKind = path.startsWith("/category/") && matched.some((r) => r.match === "same_kind");
  const multiMarket = facets.markets.length > 1;
  const medicineLeftOut =
    hideMedicine && !state.medicine && !state.aisles.length
      ? (facets.aisles.find((a) => a.value === MEDICINE)?.count ?? 0)
      : 0;

  const summary = (
    <p className="min-w-0 text-sm text-ink-2" aria-live="polite">
      <span className="num font-semibold text-ink">{t("browse.swaps", matched.length)}</span>
      {multiMarket && market !== "all" && t("browse.withMarket", market)}.{" "}
      {multiMarket && market !== "all" && facets.allMarkets > matched.length && (
        <InlineButton onClick={() => update({ market: "all" })}>{t("browse.showAllCountries", facets.allMarkets)}</InlineButton>
      )}{" "}
      {medicineLeftOut > 0 && (
        <>
          {t("browse.medicineLeftOut")}{" "}
          <InlineButton onClick={() => update({ medicine: true })}>{t("browse.addIt", medicineLeftOut)}</InlineButton>
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
          aria-label={t("browse.filters")}
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
                  {t("browse.filters")}
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
                  aria-label={t("browse.removeFilter", f.label)}
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
                {t("browse.clearAll")}
              </button>
            </li>
          </ul>
        )}

        {state.sort === "unit" && (
          <p className="mt-1 text-[13px] text-muted lg:mt-2">
            {t("browse.unitNote")}
            {multiMarket && market === "all" && t("browse.unitNoteFx")}
          </p>
        )}

        {(explainSameJob || explainSameKind) && (
          <p className="mt-1 hidden max-w-[68ch] text-[13px] text-ink-2 md:block lg:mt-2">
            {explainSameJob && `${t("cards.matchShort", "equivalent_spec")}: ${t("cards.matchDescription", "equivalent_spec")} `}
            {explainSameKind && `${t("cards.matchShort", "same_kind")}: ${t("cards.matchDescription", "same_kind")} `}
            <Link
              href="/how-we-verify"
              className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
            >
              {t("browse.howWeCheck")}
            </Link>
          </p>
        )}

        {matched.length === 0 ? (
          <NoMatches rows={rows} state={state} active={active} market={market} hideMedicine={hideMedicine} onUpdate={update} onClear={clearAll} t={t} />
        ) : (
          <div ref={listRef} className="mt-2 lg:mt-3">
            {firstTier.length > 0 && <ul className={grid}>{firstTier.map((r, i) => renderCard(r, i))}</ul>}
            {laterTiers.length > 0 && (
              <>
                <MoreSwapsHeading lang={lang} />
                <ul className={grid}>{laterTiers.map((r, i) => renderCard(r, firstTier.length + i))}</ul>
              </>
            )}
            {textRows.length > 0 && (
              <PairRows headed={cardRows.length > 0 && laterTiers.length === 0} below={cardRows.length > 0} lang={lang}>
                {textRows.map((r, i) => {
                  const card = prerendered.get(r.slug) ?? index?.get(r.slug);
                  if (!card) return index ? null : <RowPlaceholder key={r.slug} />;
                  return (
                    <li key={r.slug} data-row={cardRows.length + i} className="min-w-0">
                      <PairRow pair={lang === "en" ? card : { ...cardIn(card, lang), subcategory: r.shelf }} lang={lang} />
                    </li>
                  );
                })}
              </PairRows>
            )}
          </div>
        )}

        {indexFailed && !index && (
          <p className="mt-3 text-sm text-ink-2" role="status">
            {t("browse.didntLoad")} <InlineButton onClick={warm}>{t("browse.tryAgain")}</InlineButton>
          </p>
        )}

        {matched.length > shown.length && (
          <div className="mt-4 flex flex-col items-center gap-1">
            <button type="button" onClick={showMore} onPointerEnter={warm} className="btn btn-ghost w-full sm:w-auto sm:min-w-64">
              {t("browse.showMore", Math.min(PAGE_SIZE, matched.length - shown.length))}
            </button>
            <p className="num text-[13px] text-muted">{t("browse.showing", shown.length, matched.length)}</p>
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
                {t("browse.clearAll")}
              </button>
              <button type="button" onClick={() => setSheetOpen(false)} className="btn btn-primary flex-[2]">
                {t("browse.showSwaps", matched.length)}
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
  const t = useT(TEXT);
  return (
    <label className="flex flex-1 items-center gap-2 lg:flex-none">
      <span className="sr-only text-[13px] font-medium whitespace-nowrap text-ink-2 lg:not-sr-only">{t("browse.sortBy")}</span>
      <span className="relative block min-w-0 flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as SortKey)}
          className="h-11 w-full cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-base font-semibold hover:border-ink-2 lg:h-9 lg:text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(`browse.sorts.${s.value}`)}
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

function RowPlaceholder() {
  return (
    <li aria-hidden="true" className="flex min-h-16 items-center px-2.5 md:min-h-11 md:px-3">
      <span className="h-3 w-1/2 rounded-tile bg-canvas" />
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
  t,
}: {
  t: ClientT<typeof TEXT>;
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
      <p className="font-semibold">{t("browse.noMatches")}</p>
      {tries.length > 0 && <p className="mt-1 text-sm text-ink-2">{t("browse.tryOne")}</p>}
      <ul className="mt-1 text-sm">
        {tries.map(({ f, count }) => (
          <li key={f.id}>
            <InlineButton onClick={() => onUpdate(f.off)}>
              {f === addMedicine ? t("browse.addMedicineTo", count) : t("browse.removeTo", f.label, count)}
            </InlineButton>
          </li>
        ))}
        <li>
          <InlineButton onClick={onClear}>{t("browse.clearAllFilters")}</InlineButton>
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
  const t = useT(TEXT);
  const [allShelves, setAllShelves] = useState(false);
  const shelves =
    allShelves || facets.shelves.length <= SHELF_LIMIT
      ? facets.shelves
      : facets.shelves.filter((o, i) => i < SHELVES_COLLAPSED || state.shelves.includes(o.value));

  return (
    <div className="divide-y divide-line">
      {facets.aisles.length > 1 && (
        <Group title={t("browse.aisle")}>
          <Checks
            options={facets.aisles}
            selected={state.aisles}
            onToggle={(a) => onChange({ aisles: toggled(state.aisles, a), shelves: [] })}
          />
        </Group>
      )}

      {facets.shelves.length > 1 && (
        <Group title={t("browse.shelf")}>
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
              {allShelves ? t("browse.fewerShelves") : t("browse.allShelves", facets.shelves.length)}
            </button>
          )}
        </Group>
      )}

      {facets.matches.length > 1 && (
        <Group title={t("browse.strength")}>
          <Checks
            options={facets.matches}
            selected={state.matches}
            titleFor={(m) => t("cards.matchDescription", m)}
            onToggle={(m) => onChange({ matches: toggled(state.matches, m) })}
          />
          <Link
            href="/how-we-verify"
            className="flex min-h-11 items-center text-[13px] font-medium text-cobalt underline-offset-2 hover:underline lg:min-h-7"
          >
            {t("browse.whatTheseMean")}
          </Link>
        </Group>
      )}

      {facets.markets.length > 1 && (
        <Group title={t("browse.pricesFrom")}>
          <OptionRow
            type="radio"
            name={radioName}
            label={t("browse.allCountries")}
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
        <Group title={t("browse.photos")}>
          <OptionRow
            type="checkbox"
            label={t("browse.withPhoto")}
            count={facets.photo}
            checked={state.photo}
            onChange={() => onChange({ photo: !state.photo })}
          />
        </Group>
      )}
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
