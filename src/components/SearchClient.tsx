"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "@/components/CountryLink";
import type Fuse from "fuse.js";
import { Search } from "lucide-react";
import { PAGE_SIZE, SWAP_GRID, type BundleSummary } from "@/lib/browse";
import { loadSwapIndex } from "@/lib/client/swap-index";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import type { Bundle, PairSummary } from "@/lib/types";
import { BundleCard } from "./BundleCard";
import { PairCard } from "./PairCard";
import { WantedPrompt } from "./WantedPrompt";
import { setShowOthers, useLocal } from "@/lib/client/country";
import { localFor } from "@/lib/localize";
import { BUNDLE_SEARCH, PAIR_SEARCH } from "@/lib/search-options";

const PATH = "/search";

type Engine = { pairs: Fuse<PairSummary>; bundles: Fuse<BundleSummary> };

let pendingEngine: Promise<Engine> | null = null;

/** Fuse and the index load together, on the first sign of a search, so neither touches the first paint. */
function loadEngine() {
  pendingEngine ??= Promise.all([import("fuse.js"), loadSwapIndex()])
    .then(([{ default: FuseSearch }, index]) => ({
      pairs: new FuseSearch(index.pairs, { ...PAIR_SEARCH, includeScore: true }),
      bundles: new FuseSearch(index.bundles, { ...BUNDLE_SEARCH, includeScore: true }),
    }))
    .catch((error: unknown) => {
      pendingEngine = null;
      throw error;
    });
  return pendingEngine;
}

function queryFor(term: string) {
  return new URLSearchParams(term ? { q: term } : {});
}

/**
 * Search over the swap index. `children` is the server-rendered list of things to try, shown
 * before typing and again when nothing matches.
 */
export function SearchClient({ total, children }: { total: number; children: ReactNode }) {
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
  }, [term, urlTerm]);

  const local = useLocal();
  const [engine, setEngine] = useState<Engine | null>(null);
  const [failed, setFailed] = useState(false);
  const start = useCallback(() => loadEngine().then(setEngine, () => setFailed(true)), []);
  useEffect(() => {
    if (term && !engine) void start();
  }, [term, engine, start]);

  const results = useMemo(() => {
    if (!engine || !term) return null;
    const pairHits = engine.pairs.search(term).filter((r) => local.shows(r.item));
    const bundleHits = engine.bundles.search(term).filter((r) => local.shows(r.item));
    // What matched but isn't listed here, and would be with other countries' swaps shown: say so instead of hiding it.
    const wide = local.known && !local.others ? localFor(local.country, true) : null;
    const elsewhere = wide
      ? [...engine.pairs.search(term).map((r) => r.item), ...engine.bundles.search(term).map((r) => r.item)].filter((i) => !local.shows(i) && wide.shows(i)).length
      : 0;
    // Fuse scores run from 0 (exact) up. Kits lead only when one matches better than every swap.
    const best = (hits: { score?: number }[]) => hits[0]?.score ?? Infinity;
    return {
      pairs: pairHits.map((r) => r.item),
      bundles: bundleHits.map((r) => r.item),
      kitsFirst: best(bundleHits) < best(pairHits),
      elsewhere,
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
          placeholder="Brand, product or ingredient"
          aria-label="Search swaps by brand, product or ingredient"
          className="h-12 w-full rounded-search border border-line-strong bg-paper pr-4 pl-11 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
        />
      </form>

      {!term && (
        <>
          <p className="mt-4 text-sm text-ink-2">
            Start typing to search <span className="num">{total}</span> swaps.
          </p>
          {children}
        </>
      )}

      {term && !results && (
        <p className="mt-4 text-sm text-ink-2" role="status">
          {failed ? (
            <>
              Search didn&apos;t load. Check your connection, then{" "}
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  void start();
                }}
                className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
              >
                try again
              </button>
              .
            </>
          ) : (
            "Looking through the swaps."
          )}
        </p>
      )}

      {results && (
        <>
          <p className="mt-4 text-sm text-ink-2" aria-live="polite">
            <span className="num font-semibold text-ink">
              {count} result{count === 1 ? "" : "s"}
            </span>{" "}
            for “{term}”.
          </p>
          {results.elsewhere > 0 && <Elsewhere count={results.elsewhere} term={term} more={count > 0} />}
          {count > 0 ? (
            <ResultList key={term} pairs={results.pairs} bundles={results.bundles} kitsFirst={results.kitsFirst} />
          ) : results.elsewhere > 0 ? (
            // We have checked swaps for it, just not here: "we haven't checked" would be untrue.
            children
          ) : (
            <>
              <div className="card mt-3 p-5">
                <p className="font-semibold">We haven&apos;t checked a swap for “{term}” yet.</p>
                <p className="mt-1 text-sm text-ink-2">
                  Try the brand name on its own, or check the spelling.{" "}
                  <Link
                    href={`/suggest?brand=${encodeURIComponent(term)}`}
                    className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
                  >
                    Suggest “{term}”
                  </Link>{" "}
                  and we&apos;ll look into it.
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
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
      {count} {more ? "more " : ""}for “{term}” {count === 1 ? "is" : "are"} priced in other countries.
      <button
        type="button"
        onClick={() => setShowOthers(true)}
        className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-cobalt underline underline-offset-2 md:min-h-0"
      >
        Show swaps from other countries
      </button>
    </p>
  );
}

/**
 * Swaps, then kits, unless a kit matches the search better than every swap: a search for a brand is usually for its
 * single product. Keyed by the search, so a new one starts at the top.
 */
function ResultList({ pairs, bundles, kitsFirst }: { pairs: PairSummary[]; bundles: BundleSummary[]; kitsFirst: boolean }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const kits = bundles.length > 0 && (
    <ul className={`grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 ${kitsFirst ? "mt-3" : "mt-6"}`}>
      {bundles.map((b) => (
        <li key={b.slug} className="min-w-0">
          {/* The index carries only the fields BundleCard reads. */}
          <BundleCard bundle={b as Bundle} />
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
              <PairCard pair={p} />
            </li>
          ))}
        </ul>
      )}
      {pairs.length > limit && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <button type="button" onClick={() => setLimit(limit + PAGE_SIZE)} className="btn btn-ghost w-full sm:w-auto sm:min-w-64">
            Show {Math.min(PAGE_SIZE, pairs.length - limit)} more
          </button>
          <p className="num text-[13px] text-muted">
            Showing {limit} of {pairs.length}
          </p>
        </div>
      )}
      {!kitsFirst && kits}
    </>
  );
}
