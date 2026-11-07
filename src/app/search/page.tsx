import type { Metadata } from "next";
import { getAllPairs, getBrands, getCategoryStats } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { SearchClient } from "@/components/SearchClient";
import { TagLinks } from "@/components/ShelfParts";

export const metadata: Metadata = {
  title: "Search swaps",
  description: "Search cheaper alternatives by brand, product or ingredient.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

/** What to try: the brands with the most swaps, leaving medicine to the aisle list, then the aisles. */
function ThingsToTry() {
  const brands = getBrands()
    .map((b) => ({ slug: b.slug, name: b.name, count: b.pairs.filter((p) => p.category !== MEDICINE).length }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"))
    .slice(0, 12);
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:gap-8">
      {brands.length > 0 && (
        <section>
          <h2 className="display mb-2 text-lg">Brands with the most swaps</h2>
          <TagLinks links={brands.map((b) => ({ href: `/brand/${b.slug}`, label: b.name }))} />
        </section>
      )}
      {aisles.length > 0 && (
        <section>
          <h2 className="display mb-2 text-lg">Or browse an aisle</h2>
          <TagLinks links={aisles.map((a) => ({ href: `/category/${a.slug}`, label: a.name }))} />
        </section>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-[60vh] bg-canvas pb-8 md:pb-10">
      <div className="container-page pt-4 md:pt-5">
        <h1 className="display text-[1.75rem] md:text-[2.5rem]">Find it cheaper</h1>
        <p className="mt-2 mb-4 max-w-[68ch] text-[15px] text-ink-2 md:text-base">
          Type the brand you usually buy. We&apos;ll show the cheaper one that does the same job.
        </p>
        <SearchClient total={getAllPairs().length}>
          <ThingsToTry />
        </SearchClient>
      </div>
    </div>
  );
}
