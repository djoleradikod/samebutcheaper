"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Fuse from "fuse.js";
import { Search } from "lucide-react";
import type { Bundle, PairSummary } from "@/lib/types";
import { PairCard } from "./PairCard";
import { BundleCard } from "./BundleCard";

export function SearchClient({ pairs, bundles = [] }: { pairs: PairSummary[]; bundles?: Bundle[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    // URL changed (e.g. header search while on this page): sync the input.
    setPrevInitial(initial);
    setQ(initial);
  }

  const fuse = useMemo(
    () =>
      new Fuse(pairs, {
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
    [pairs],
  );

  const bundleFuse = useMemo(
    () =>
      new Fuse(bundles, {
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
    [bundles],
  );

  const term = q.trim();
  const results = term ? fuse.search(term).map((r) => r.item) : [];
  const bundleResults = term ? bundleFuse.search(term).map((r) => r.item) : [];

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(term ? `/search?q=${encodeURIComponent(term)}` : "/search", { scroll: false });
        }}
        className="relative max-w-2xl"
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Brand, product or ingredient (Claritin, Tide, loratadine…)"
          aria-label="Search swaps"
          className="h-14 w-full rounded-2xl border border-line-strong bg-surface pr-4 pl-12 text-base shadow-sm placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>

      {term ? (
        <>
          <p className="num mt-6 text-sm text-muted" aria-live="polite">
            {results.length + bundleResults.length} result{results.length + bundleResults.length === 1 ? "" : "s"} for “{term}”
          </p>
          {results.length + bundleResults.length > 0 ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundleResults.map((b) => (
                <BundleCard key={b.slug} bundle={b} />
              ))}
              {results.map((p) => (
                <PairCard key={p.slug} pair={p} />
              ))}
            </div>
          ) : (
            <div className="card mt-3 p-8 text-center">
              <p className="font-medium">We haven&apos;t verified a swap for that yet.</p>
              <p className="mt-2 text-sm text-muted">
                <Link
                  href={`/suggest?brand=${encodeURIComponent(term)}`}
                  className="text-accent underline underline-offset-2"
                >
                  Suggest “{term}”
                </Link>{" "}
                and we&apos;ll research it.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="mt-6 text-sm text-muted">Start typing to search {pairs.length} verified swaps.</p>
      )}
    </div>
  );
}
