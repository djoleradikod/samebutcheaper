import type { Metadata } from "next";
import { CountryPart } from "@/components/ForCountry";
import { MyList, type ListItem } from "@/components/MyList";
import { ShoppingCheckCta } from "@/components/ShoppingCheckCta";
import { yearlyFields } from "@/components/YearlyBlock";
import { packSize } from "@/lib/basket-view";
import { getAllBundles, getAllPairs } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "My savings list",
  description: "Add up what switching to the cheaper products saves you.",
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
      detail: `${p.subcategory.replace(/\s+-\s+/g, ": ")}, per ${packSize(p.brand.size, p.brand.unit)} pack`,
      savingsPct: p.savingsPct,
      savings: p.savingsPerPack,
      currency: p.currency,
      category: p.category,
      unit: p.brand.unit,
      fromPhoto: p.brand.photo?.src ?? null,
      fromAlt: p.brand.product,
      toPhoto: p.alternative.photo?.src ?? null,
      toAlt: p.alternative.product,
      yearly: yearlyFields(p),
    })),
    ...getAllBundles().map((b) => {
      const piece = b.components.find((c) => c.photo) ?? b.components[0];
      return {
        slug: b.slug,
        href: `/bundle/${b.slug}`,
        kind: "kit" as const,
        from: b.bundle.brand,
        to: `${b.components.length} cheaper items`,
        detail: b.bundle.name,
        savingsPct: b.savingsPct,
        savings: b.savings,
        currency: b.currency,
        category: b.category,
        fromPhoto: b.photo?.src ?? null,
        fromAlt: b.bundle.name,
        toPhoto: piece.photo?.src ?? null,
        toAlt: piece.product,
        // A kit counts once: it's a set you buy once, and we have nothing on how often anyone rebuys one.
        yearly: null,
      };
    }),
  ];
  return (
    <section className="container-page pt-4 md:pt-6">
      <h1 className="display text-[1.75rem] md:text-[2.5rem]">My savings list</h1>
      <p className="mt-1.5 max-w-[62ch] text-[15px] text-ink-2 md:text-base">The swaps you&apos;ve saved, and what switching adds up to.</p>
      {/* Above the list: the list's height is only known in the browser, so anything under it would jump. */}
      <ShoppingCheckCta className="mt-4 max-w-3xl md:mt-6" />
      <CountryPart fallback={<div className="card mt-4 h-40 md:mt-6" />}>{() => <MyList items={items} />}</CountryPart>
    </section>
  );
}
