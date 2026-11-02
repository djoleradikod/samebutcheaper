import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPairs, toSummary } from "@/lib/catalog";
import { SearchClient } from "@/components/SearchClient";

export const metadata: Metadata = {
  title: "Search swaps",
  description: "Search verified cheaper alternatives by brand, product or ingredient.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  const pairs = getAllPairs().map(toSummary);
  return (
    <section className="container-page py-10 md:py-14">
      <h1 className="display text-4xl font-medium sm:text-5xl">Find it cheaper</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        Type the brand you usually buy. We&apos;ll show you the product that&apos;s the same thing for less.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-14 max-w-2xl rounded-2xl border border-line bg-surface" />}>
          <SearchClient pairs={pairs} />
        </Suspense>
      </div>
    </section>
  );
}
