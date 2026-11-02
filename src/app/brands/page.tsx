import type { Metadata } from "next";
import Link from "next/link";
import { getBrands } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Brands we've found cheaper alternatives for",
  description: "Every brand-name product we've matched to a cheaper equivalent, A to Z.",
  alternates: { canonical: "/brands" },
};

export default function BrandsPage() {
  const brands = getBrands();
  return (
    <section className="container-page py-10 md:py-14">
      <p className="text-sm font-medium text-accent">A–Z</p>
      <h1 className="display mt-1 text-4xl font-medium sm:text-5xl">Brands, but cheaper</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
        Pick a brand you buy and see what&apos;s the same for less.
      </p>
      <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {brands.map((b) => {
          const n = b.pairs.length + b.bundles.length;
          const best = Math.max(0, ...b.pairs.map((p) => p.savingsPct), ...b.bundles.map((x) => x.savingsPct));
          return (
            <li key={b.slug}>
              <Link
                href={`/brand/${b.slug}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-accent"
              >
                <span className="font-medium">{b.name}</span>
                <span className="num text-xs text-muted">
                  {n} · up to {Math.round(best)}%
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
