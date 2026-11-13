import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { getCategoryStats, getPairsByCategory } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { HealthNotice } from "@/components/Evidence";
import { CountryPart } from "@/components/ForCountry";
import { ListSchema } from "@/components/ListSchema";
import { BestTicket, bestSaving, browseProps, PriceFacts, ShelfHead, swapCount, TagLinks } from "@/components/ShelfParts";
import type { CategorySlug } from "@/lib/types";
import { inSentence } from "@/lib/format";
import { forCountry } from "@/lib/localize";
import { categoryDescription, categoryTitle } from "@/lib/seo";

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
    title: categoryTitle(cat.name, count),
    description: categoryDescription(cat.name, cat.description, count),
    alternates: { canonical: `/category/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const cat = lookup(slug);
  if (!cat) notFound();
  const all = getPairsByCategory(cat.slug);
  const name = inSentence(cat.name);

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: cat.name }]}
        title={
          <>
            Cheaper {name}
            <CountryPart fallback={null}>
              {(local) => {
                const n = forCountry(all, local).length;
                return n > 0 && `: ${swapCount(n)}`;
              }}
            </CountryPart>
          </>
        }
        intro={cat.description}
        ticket={<CountryPart fallback={null}>{(local) => <BestTicket best={bestSaving(forCountry(all, local))} />}</CountryPart>}
        facts={
          <CountryPart fallback={null}>
            {(local) => {
              const pairs = forCountry(all, local);
              return pairs.length > 0 && <PriceFacts pairs={pairs} />;
            }}
          </CountryPart>
        }
      />
      <CountryPart>
        {(local) => {
          const pairs = forCountry(all, local);
          return (
            <>
              {cat.slug === MEDICINE && pairs.length > 0 && (
                <div className="container-page mb-4">
                  <HealthNotice />
                </div>
              )}
              <div className="container-page">
                {pairs.length ? <PairBrowser path={`/category/${cat.slug}`} {...browseProps(pairs, { local })} /> : <EmptyAisle />}
              </div>
            </>
          );
        }}
      </CountryPart>
      {all.length > 0 && (
        <ListSchema
          name={`Cheaper ${cat.name}`}
          path={`/category/${cat.slug}`}
          crumbs={[]}
          items={[...all].sort((a, b) => b.savingsPct - a.savingsPct).map((p) => ({ name: p.title, path: `/compare/${p.slug}` }))}
        />
      )}
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
