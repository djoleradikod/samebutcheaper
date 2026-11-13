"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type Fuse from "fuse.js";
import { Search } from "lucide-react";
import { PAGE_SIZE, SWAP_GRID, type BundleSummary } from "@/lib/browse";
import { loadSwapIndex } from "@/lib/client/swap-index";
import { useUrlQuery, writeUrlQuery } from "@/lib/client/url-query";
import type { Bundle, PairSummary } from "@/lib/types";
import { BundleCard } from "./BundleCard";
import { PairCard } from "./PairCard";
import { WantedPrompt } from "./WantedPrompt";
import { useLocal } from "@/lib/client/country";
import { forCountry } from "@/lib/localize";

const PATH = "/search";

type Engine = { pairs: Fuse<PairSummary>; bundles: Fuse<BundleSummary> };

let pendingEngine: Promise<Engine> | null = null;

/** Fuse and the index load together, on the first sign of a search, so neither touches the first paint. */
function loadEngine() {
  pendingEngine ??= Promise.all([import("fuse.js"), loadSwapIndex()])
    .then(([{ default: FuseSearch }, index]) => ({
      pairs: new FuseSearch(index.pairs, {
        keys: [
          { name: "brandName", weight: 3 },
          { name: "brandProduct", weight: 2 },
          { name: "title", weight: 2 },
          { name: "altName", weight: 1.5 },
          { name: "altProduct", weight: 1 },
          { name: "subcategory", weight: 1 },
          { name: "keywords", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
      bundles: new FuseSearch(index.bundles, {
        keys: [
          { name: "bundle.brand", weight: 3 },
          { name: "bundle.name", weight: 2 },
          { name: "title", weight: 2 },
          { name: "bundle.items.name", weight: 1 },
          { name: "components.product", weight: 1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
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
    return {
      pairs: forCountry(engine.pairs.search(term).map((r) => r.item), local),
      bundles: forCountry(engine.bundles.search(term).map((r) => r.item), local),
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
          {count > 0 ? (
            <ResultList key={term} pairs={results.pairs} bundles={results.bundles} />
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

/** Bundles first, as they replace a whole kit, then swaps. Keyed by the search, so a new one starts at the top. */
function ResultList({ pairs, bundles }: { pairs: PairSummary[]; bundles: BundleSummary[] }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <>
      {bundles.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {bundles.map((b) => (
            <li key={b.slug} className="min-w-0">
              {/* The index carries only the fields BundleCard reads. */}
              <BundleCard bundle={b as Bundle} />
            </li>
          ))}
        </ul>
      )}
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
    </>
  );
}
