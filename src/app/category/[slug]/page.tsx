import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { getCategoryStats, getPairsByCategory } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { HealthNotice } from "@/components/Evidence";
import { bestSaving, browseProps, PriceFacts, ShelfHead, swapCount, TagLinks } from "@/components/ShelfParts";
import type { CategorySlug } from "@/lib/types";
import { inSentence } from "@/lib/format";
import { forCountry } from "@/lib/localize";
import { getCountry } from "@/lib/server-country";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

function lookup(slug: string) {
  return Object.hasOwn(CATEGORY_MAP, slug) ? CATEGORY_MAP[slug as CategorySlug] : undefined;
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) return { title: "Category not found" };
  const count = getPairsByCategory(cat.slug).length;
  if (!count) {
    return {
      title: `Cheaper ${cat.name}`,
      description: cat.description,
      alternates: { canonical: `/category/${cat.slug}` },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: `Cheaper ${cat.name}: ${count} swaps`,
    description: `${cat.description} Browse ${count} cheaper alternatives to brand-name ${inSentence(cat.name)}.`,
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) notFound();
  const country = await getCountry();
  const pairs = forCountry(getPairsByCategory(cat.slug), country);
  const name = inSentence(cat.name);

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: cat.name }]}
        title={pairs.length ? `Cheaper ${name}: ${swapCount(pairs.length)}` : `Cheaper ${name}`}
        intro={cat.description}
        best={bestSaving(pairs)}
        facts={pairs.length > 0 && <PriceFacts pairs={pairs} />}
      />
      {cat.slug === MEDICINE && pairs.length > 0 && (
        <div className="container-page mb-4">
          <HealthNotice />
        </div>
      )}
      <div className="container-page">
        {pairs.length ? <PairBrowser path={`/category/${cat.slug}`} {...browseProps(pairs, { country })} /> : <EmptyAisle />}
      </div>
    </div>
  );
}

function EmptyAisle() {
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  return (
    <div className="card p-5">
      <p className="font-semibold">We haven&apos;t checked any swaps in this aisle yet.</p>
      <p className="mt-1 text-sm text-ink-2">
        Tell us what you buy here and we&apos;ll look into it, or try another aisle.
      </p>
      <p className="mt-3">
        <Link href="/suggest" className="btn btn-primary">
          Suggest a swap
        </Link>
      </p>
      {aisles.length > 0 && (
        <div className="mt-4">
          <TagLinks links={aisles.map((a) => ({ href: `/category/${a.slug}`, label: a.name }))} />
        </div>
      )}
    </div>
  );
}
