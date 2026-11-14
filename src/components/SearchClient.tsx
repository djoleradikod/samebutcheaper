"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "@/components/CountryLink";
import { Search } from "lucide-react";
import { cardIn, PAGE_SIZE, SWAP_GRID, type BundleSummary, type IndexPair } from "@/lib/browse";
import { loadSwapIndex } from "@/lib/client/swap-index";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import type { Bundle } from "@/lib/types";
import type { Lang } from "@/lib/i18n/lang";
import { BundleCard } from "./BundleCard";
import { PairCard } from "./PairCard";
import { WantedPrompt } from "./WantedPrompt";
import { setShowOthers, useLocal } from "@/lib/client/country";
import { localFor } from "@/lib/localize";
import { searchBundles, searchPairs } from "@/lib/search-index";
import { useLang, useT } from "@/lib/i18n/client";
import type { ClientT } from "@/lib/i18n/client-dict";
import { search } from "@/lib/i18n/en/client/search";
import { pageSearch } from "@/lib/i18n/en/pages/search";
import { rich } from "@/lib/i18n/rich";

/** The English this component reads (src/lib/i18n/client-dict.ts); the page section's German loads on German pages only. */
const TEXT = { search, pageSearch };
const german = () => import("@/lib/i18n/de/pages/search");
const useSearchT = (): ClientT<typeof TEXT> => useT(TEXT, german);

type Engine = {
  all: IndexPair[];
  pairs: ReturnType<typeof searchPairs<IndexPair>>;
  bundles: ReturnType<typeof searchBundles<BundleSummary>>;
};

let pendingEngine: Promise<Engine> | null = null;

/** The index loads on the first sign of a search, so it never touches the first paint. */
function loadEngine() {
  pendingEngine ??= loadSwapIndex()
    .then((index) => ({
      all: index.pairs,
      pairs: searchPairs(index.pairs, index.aisles ?? {}),
      bundles: searchBundles(index.bundles),
    }))
    .catch((error: unknown) => {
      pendingEngine = null;
      throw error;
    });
  return pendingEngine;
}

/** How many swaps from the top hit's shelf show under "Related swaps". */
const RELATED = 4;

/**
 * Swaps on the same shelf as the first hit, in the same market, that the search did not find: shown apart, under their
 * own heading, and never counted as results.
 */
function relatedTo(hits: IndexPair[], all: IndexPair[], shows: (p: IndexPair) => boolean): IndexPair[] {
  const top = hits[0];
  if (!top) return [];
  const found = new Set(hits.map((p) => p.slug));
  return all.filter((p) => p.subcategory === top.subcategory && p.market === top.market && !found.has(p.slug) && shows(p)).slice(0, RELATED);
}

function queryFor(term: string) {
  return new URLSearchParams(term ? { q: term } : {});
}

/**
 * Search over the swap index. `children` is the server-rendered list of things to try, shown
 * before typing and again when nothing matches.
 */
export function SearchClient({ total, children }: { total: number; children: ReactNode }) {
  const t = useSearchT();
  const lang = useLang();
  // The page's own path: /de/search on a German page.
  const PATH = lang === "de" ? "/de/search" : "/search";
  const query = useUrlQuery(PATH);
  const urlTerm = useMemo(() => new URLSearchParams(query).get("q")?.trim() ?? "", [query]);
  const [q, setQ] = useState("");
  const [prevUrlTerm, setPrevUrlTerm] = useState("");
  if (urlTerm !== prevUrlTerm) {
    // The URL moved on its own (a shared link, the back button): follow it into the box.
    setPrevUrlTerm(urlTerm);
    if (urlTerm !== q.trim()) setQ(urlTerm);
  }
  const term = q.trim();

  // Keep the URL in step while typing, so a search can be shared and the back button returns to it.
  useEffect(() => {
    if (term === urlTerm) return;
    const timer = setTimeout(() => writeUrlQuery(PATH, queryFor(term), "replace"), 300);
    return () => clearTimeout(timer);
  }, [term, urlTerm, PATH]);

  const local = useLocal();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const start = useCallback(() => loadEngine().then(setEngine, () => setFailed(true)), []);
  useEffect(() => {
    if (term && !engine) void start();
  }, [term, engine, start]);

  const results = useMemo(() => {
    if (!engine || !term) return null;
    const p = engine.pairs.search(term);
    const b = engine.bundles.search(term);
    // A spelling is only corrected when neither swaps nor kits match as typed, and then both use one correction.
    const exact = (p.hits.length > 0 && !p.didYouMean) || (b.hits.length > 0 && !b.didYouMean);
    const didYouMean = exact ? null : (p.didYouMean ?? b.didYouMean);
    const allPairs = p.didYouMean === didYouMean ? p.hits : [];
    const allBundles = b.didYouMean === didYouMean ? b.hits : [];
    const pairHits = allPairs.filter((r) => local.shows(r.item));
    const bundleHits = allBundles.filter((r) => local.shows(r.item));
    // What matched but isn't listed here, and would be with other countries' swaps shown: say so instead of hiding it.
    const wide = local.known && !local.others ? localFor(local.country, true) : null;
    const elsewhere = wide ? [...allPairs, ...allBundles].filter((r) => !local.shows(r.item) && wide.shows(r.item)).length : 0;
    // Kits lead only when one matches better than every swap.
    const rank = (hits: { tier: number; quality: number }[]) => (hits[0] ? hits[0].tier * 100 + hits[0].quality : Infinity);
    const pairs = pairHits.map((r) => r.item);
    return {
      pairs,
      bundles: bundleHits.map((r) => r.item),
      kitsFirst: rank(bundleHits) < rank(pairHits),
      elsewhere,
      didYouMean,
      related: relatedTo(pairs, engine.all, local.shows),
    };
  }, [engine, term, local]);
  const count = results ? results.pairs.length + results.bundles.length : 0;

  return (
    <div>
      <form
        role="search"
        action={PATH}
        onSubmit={(e) => {
          e.preventDefault();
          writeUrlQuery(PATH, queryFor(term), "replace");
        }}
        className="relative max-w-2xl"
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => void start()}
          placeholder={t("pageSearch.placeholder")}
          aria-label={t("pageSearch.label")}
          className="h-12 w-full rounded-search border border-line-strong bg-paper pr-4 pl-11 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
        />
      </form>

      {!term && (
        <>
          <p className="mt-4 text-sm text-ink-2">
            {rich(t("pageSearch.startTyping"), { n: <span className="num">{total}</span> })}
          </p>
          {children}
        </>
      )}

      {term && !results && (
        <p className="mt-4 text-sm text-ink-2" role="status">
          {failed ? (
            <>
              {t("pageSearch.didntLoad")}{" "}
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  void start();
                }}
                className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
              >
                {t("pageSearch.tryAgain")}
              </button>
              .
            </>
          ) : (
            t("pageSearch.looking")
          )}
        </p>
      )}

      {results && results.didYouMean && (count > 0 || results.elsewhere > 0) && (
        // Nothing matched as typed: the nearest spelling's results, said as such and not counted as hits for the term.
        <>
          <p className="mt-4 text-sm text-ink-2" aria-live="polite">
            <span className="font-semibold text-ink">{t("pageSearch.noExact", term)}</span>{" "}
            {rich(t("pageSearch.didYouMean"), {
              term: (
                <button
                  type="button"
                  onClick={() => setQ(results.didYouMean ?? "")}
                  className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-cobalt underline underline-offset-2 md:min-h-0"
                >
                  {results.didYouMean}
                </button>
              ),
            })}
          </p>
          {results.elsewhere > 0 && <Elsewhere count={results.elsewhere} term={results.didYouMean} more={count > 0} />}
          {count > 0 && <ResultList key={term} pairs={results.pairs} bundles={results.bundles} kitsFirst={results.kitsFirst} lang={lang} />}
          {count > 0 ? (
            // Not what they meant: the way to ask for it, as a line, since the suggestion probably was.
            <p className="mt-4 text-sm text-ink-2">
              {t("pageSearch.notMeant")}{" "}
              <Link
                href={`/suggest?brand=${encodeURIComponent(term)}`}
                className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
              >
                {t("pageSearch.suggest", term)}
              </Link>{" "}
              {t("pageSearch.lookInto")}
            </p>
          ) : (
            <WantedPrompt term={term} count={false} />
          )}
        </>
      )}

      {results && !(results.didYouMean && (count > 0 || results.elsewhere > 0)) && (
        <>
          <p className="mt-4 text-sm text-ink-2" aria-live="polite">
            <span className="num font-semibold text-ink">
              {t("pageSearch.results", count)}
            </span>{" "}
            {t("pageSearch.forTerm", term)}
          </p>
          {results.elsewhere > 0 && <Elsewhere count={results.elsewhere} term={term} more={count > 0} />}
          {count > 0 ? (
            <>
              <ResultList key={term} pairs={results.pairs} bundles={results.bundles} kitsFirst={results.kitsFirst} lang={lang} />
              {results.related.length > 0 && (
                <section className="mt-8" aria-labelledby="search-related">
                  <h2 id="search-related" className="display text-lg">
                    {t("pageSearch.related")}
                  </h2>
                  <p className="mt-1 text-sm text-ink-2">{t("pageSearch.relatedNote")}</p>
                  <ul className={`${SWAP_GRID} mt-3`}>
                    {results.related.map((p) => (
                      <li key={p.slug} className="min-w-0">
                        <PairCard pair={cardIn(p, lang)} lang={lang} via="search" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : results.elsewhere > 0 ? (
            // We have checked swaps for it, just not here: "we haven't checked" would be untrue.
            children
          ) : (
            <>
              <div className="card mt-3 p-5">
                <p className="font-semibold">{t("pageSearch.notChecked", term)}</p>
                <p className="mt-1 text-sm text-ink-2">
                  {t("pageSearch.tryBrand")}{" "}
                  <Link
                    href={`/suggest?brand=${encodeURIComponent(term)}`}
                    className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
                  >
                    {t("pageSearch.suggest", term)}
                  </Link>{" "}
                  {t("pageSearch.lookInto")}
                </p>
              </div>
              <WantedPrompt term={term} />
              {children}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Matches priced in other countries, which this shopper's lists leave out, with the way to see them. */
function Elsewhere({ count, term, more }: { count: number; term: string; more: boolean }) {
  const t = useSearchT();
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
      {t("search.elsewhere", count, term, more)}
      <button
        type="button"
        onClick={() => setShowOthers(true)}
        className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-cobalt underline underline-offset-2 md:min-h-0"
      >
        {t("search.showOthers")}
      </button>
    </p>
  );
}

/**
 * Swaps, then kits, unless a kit matches the search better than every swap: a search for a brand is usually for its
 * single product. Keyed by the search, so a new one starts at the top.
 */
function ResultList({ pairs, bundles, kitsFirst, lang }: { pairs: IndexPair[]; bundles: BundleSummary[]; kitsFirst: boolean; lang: Lang }) {
  const t = useSearchT();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const kits = bundles.length > 0 && (
    <ul className={`grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 ${kitsFirst ? "mt-3" : "mt-6"}`}>
      {bundles.map((b) => (
        <li key={b.slug} className="min-w-0">
          {/* The index carries only the fields BundleCard reads. */}
          <BundleCard bundle={b as Bundle} lang={lang} via="search" />
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {kitsFirst && kits}
      {pairs.length > 0 && (
        <ul className={`${SWAP_GRID} mt-3`}>
          {pairs.slice(0, limit).map((p) => (
            <li key={p.slug} className="min-w-0">
              <PairCard pair={cardIn(p, lang)} lang={lang} via="search" />
            </li>
          ))}
        </ul>
      )}
      {pairs.length > limit && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <button type="button" onClick={() => setLimit(limit + PAGE_SIZE)} className="btn btn-ghost w-full sm:w-auto sm:min-w-64">
            {t("pageSearch.showMore", Math.min(PAGE_SIZE, pairs.length - limit))}
          </button>
          <p className="num text-[13px] text-muted">{t("pageSearch.showing", limit, pairs.length)}</p>
        </div>
      )}
      {!kitsFirst && kits}
    </>
  );
}
