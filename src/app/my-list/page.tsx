import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllBundles, getAllPairs } from "@/lib/catalog";
import { MyList, type ListItem } from "@/components/MyList";
import { formatSize } from "@/lib/format";

export const metadata: Metadata = {
  title: "My savings list",
  description: "Add up what switching to the same-but-cheaper products saves you.",
  robots: { index: false, follow: true },
};

export default function MyListPage() {
  const items: ListItem[] = [
    ...getAllPairs().map((p) => ({
      slug: p.slug,
      href: `/compare/${p.slug}`,
      kind: "swap" as const,
      from: p.brand.brand,
      to: p.alternative.brand,
      detail: `${p.subcategory} · per ${formatSize(p.brand.size, p.brand.unit)} pack`,
      savingsPct: p.savingsPct,
      savings: p.savingsPerPack,
      currency: p.currency,
    })),
    ...getAllBundles().map((b) => ({
      slug: b.slug,
      href: `/bundle/${b.slug}`,
      kind: "bundle" as const,
      from: b.bundle.name,
      to: `${b.components.length} cheaper items`,
      detail: b.title,
      savingsPct: b.savingsPct,
      savings: b.savings,
      currency: b.currency,
    })),
  ];
  return (
    <section className="container-page py-10 md:py-14">
      <h1 className="display text-4xl font-medium sm:text-5xl">My savings list</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">
        The swaps you&apos;ve saved, and what switching adds up to.
      </p>
      <Suspense fallback={<div className="card mt-8 h-40" />}>
        <MyList items={items} />
      </Suspense>
    </section>
  );
}
