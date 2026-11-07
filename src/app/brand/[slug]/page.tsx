import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBrand, getBrands } from "@/lib/catalog";
import { matchSentence } from "@/lib/categories";
import { BundleCard } from "@/components/BundleCard";
import { atLeastOneParam, bestSaving, PriceFacts, ShelfHead, swapCount, SwapList } from "@/components/ShelfParts";

export function generateStaticParams() {
  return atLeastOneParam(getBrands().map((b) => b.slug));
}

export async function generateMetadata({ params }: PageProps<"/brand/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrand(slug);
  if (!brand) return { title: "Brand not found" };
  const n = brand.pairs.length + brand.bundles.length;
  const best = bestSaving([...brand.pairs, ...brand.bundles]);
  return {
    title: `Cheaper alternatives to ${brand.name}: save up to ${Math.round(best)}%`,
    description: `${n} cheaper alternative${n === 1 ? "" : "s"} to ${brand.name}, each with sources. ${matchSentence(brand.pairs.map((p) => p.match_type))}`.trim(),
    alternates: { canonical: `/brand/${brand.slug}` },
  };
}

export default async function BrandPage({ params }: PageProps<"/brand/[slug]">) {
  const { slug } = await params;
  const brand = getBrand(slug);
  if (!brand) notFound();
  const n = brand.pairs.length + brand.bundles.length;

  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { href: "/brands", label: "Brands" }, { label: brand.name }]}
        title={`Cheaper alternatives to ${brand.name}: ${swapCount(n)}`}
        intro={
          brand.pairs.length
            ? `Every ${brand.name} product we've priced against a cheaper one. ${matchSentence(brand.pairs.map((p) => p.match_type))}`
            : `${brand.name} bundles, rebuilt from cheaper products.`
        }
        best={bestSaving([...brand.pairs, ...brand.bundles])}
        facts={<PriceFacts pairs={[...brand.pairs, ...brand.bundles]} />}
      />
      <div className="container-page">
        {brand.pairs.length > 0 && <SwapList path={`/brand/${brand.slug}`} pairs={brand.pairs} />}
        {brand.bundles.length > 0 && (
          <section className={brand.pairs.length ? "mt-8" : ""}>
            <h2 className="display mb-3 text-xl md:text-2xl">{brand.name} bundles, rebuilt for less</h2>
            <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
              {brand.bundles.map((b) => (
                <li key={b.slug} className="min-w-0">
                  <BundleCard bundle={b} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
