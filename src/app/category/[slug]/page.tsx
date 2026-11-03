import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { getPairsByCategory, toSummary } from "@/lib/catalog";
import { PairBrowser } from "@/components/PairBrowser";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { CategorySlug } from "@/lib/types";
import { inSentence } from "@/lib/format";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

function lookup(slug: string) {
  return CATEGORY_MAP[slug as CategorySlug];
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) return { title: "Category not found" };
  const count = getPairsByCategory(cat.slug).length;
  return {
    title: `Cheaper ${cat.name}: ${count} verified swaps`,
    description: `${cat.description} Browse ${count} verified cheaper alternatives to brand-name ${inSentence(cat.name)}.`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) notFound();
  const pairs = getPairsByCategory(cat.slug).map(toSummary);
  const max = pairs.reduce((m, p) => Math.max(m, p.savingsPct), 0);
  const avg = pairs.length ? pairs.reduce((s, p) => s + p.savingsPct, 0) / pairs.length : 0;

  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="container-page py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-2">{cat.name}</span>
          </nav>
          <div className="mt-5 flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent sm:grid">
              <CategoryIcon icon={cat.icon} className="h-7 w-7" />
            </span>
            <div>
              <h1 className="display text-4xl font-medium sm:text-5xl">Cheaper {inSentence(cat.name)}</h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">{cat.description}</p>
              {pairs.length > 0 && (
                <p className="num mt-4 text-sm text-muted">
                  {pairs.length} verified swaps · {Math.round(avg)}% average saving · up to {Math.round(max)}% off
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="container-page py-10">
        {pairs.length ? (
          <PairBrowser pairs={pairs} showRank />
        ) : (
          <div className="card p-10 text-center">
            <p className="text-lg font-medium">We&apos;re verifying swaps for this aisle right now.</p>
            <p className="mt-2 text-muted">
              Know a good one?{" "}
              <Link href="/suggest" className="text-accent underline underline-offset-2">Suggest it</Link>.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
