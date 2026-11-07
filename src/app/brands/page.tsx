import type { Metadata } from "next";
import { getBrands, type BrandEntry } from "@/lib/catalog";
import { AzIndex, bestSaving, ListLinks, ShelfHead, type IndexEntry } from "@/components/ShelfParts";
import { forCountry } from "@/lib/localize";
import { getLocal } from "@/lib/server-country";

export const metadata: Metadata = {
  title: "Brands we've found cheaper alternatives for",
  description: "Every brand-name product we've matched to a cheaper equivalent, A to Z.",
  alternates: { canonical: "/brands" },
};

/** The brand's own pack where we have a photo, else the swap for it. */
function toEntry(b: BrandEntry): IndexEntry {
  const own = b.pairs.find((p) => p.brand.photo);
  const alt = b.pairs.find((p) => p.alternative.photo);
  const first = b.pairs[0];
  return {
    key: b.slug,
    href: `/brand/${b.slug}`,
    name: b.name,
    count: b.pairs.length + b.bundles.length,
    best: bestSaving([...b.pairs, ...b.bundles]),
    category: first?.category ?? b.bundles[0]?.category,
    unit: first?.brand.unit,
    photo: own?.brand.photo?.src ?? alt?.alternative.photo?.src ?? b.bundles[0]?.photo?.src ?? null,
    photoName: own?.brand.product ?? alt?.alternative.product ?? b.bundles[0]?.bundle.name ?? b.name,
  };
}

export default async function BrandsPage() {
  const local = await getLocal();
  // Only what lists for this shopper counts, and a brand with nothing left drops out.
  const brands = getBrands()
    .map((b) => ({ ...b, pairs: forCountry(b.pairs, local), bundles: forCountry(b.bundles, local) }))
    .filter((b) => b.pairs.length + b.bundles.length > 0);
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Brands" }]}
        title={`Cheaper swaps by brand: ${brands.length} brand${brands.length === 1 ? "" : "s"}`}
        intro="Pick a brand you buy and see what does the same job for less."
        facts={<ListLinks />}
      />
      <div className="container-page">
        {brands.length ? <AzIndex entries={brands.map(toEntry)} /> : <p className="card p-5">No brands listed yet.</p>}
      </div>
    </div>
  );
}
