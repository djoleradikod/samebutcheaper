import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBrand, getBrands, toSummary } from "@/lib/catalog";
import { PairCard } from "@/components/PairCard";
import { BundleCard } from "@/components/BundleCard";

export function generateStaticParams() {
  return getBrands().map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/brand/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrand(slug);
  if (!brand) return { title: "Brand not found" };
  const n = brand.pairs.length + brand.bundles.length;
  const best = Math.max(0, ...brand.pairs.map((p) => p.savingsPct), ...brand.bundles.map((b) => b.savingsPct));
  return {
    title: `Cheaper alternatives to ${brand.name}: save up to ${Math.round(best)}%`,
    description: `${n} verified cheaper alternative${n === 1 ? "" : "s"} to ${brand.name} with the same ingredients or specs, each with sources.`,
    alternates: { canonical: `/brand/${brand.slug}` },
  };
}

export default async function BrandPage({ params }: PageProps<"/brand/[slug]">) {
  const { slug } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound();
  const pairs = [...brand.pairs].sort((a, b) => b.savingsPct - a.savingsPct);
  const best = Math.max(0, ...pairs.map((p) => p.savingsPct), ...brand.bundles.map((b) => b.savingsPct));

  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="container-page py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/brands" className="hover:text-ink">Brands</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-2">{brand.name}</span>
          </nav>
          <h1 className="display mt-5 text-4xl font-medium sm:text-5xl">
            Cheaper alternatives to <span className="highlight">{brand.name}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
            Every {brand.name} product we&apos;ve matched to a cheaper one with the same ingredients, formula or
            specs. Save up to {Math.round(best)}%.
          </p>
        </div>
      </section>
      <section className="container-page space-y-10 py-10">
        {pairs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pairs.map((p) => (
              <PairCard key={p.slug} pair={toSummary(p)} />
            ))}
          </div>
        )}
        {brand.bundles.length > 0 && (
          <div>
            <h2 className="display text-2xl font-medium">{brand.name} bundles, rebuilt for less</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {brand.bundles.map((b) => (
                <BundleCard key={b.slug} bundle={b} />
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
