import type { Metadata } from "next";
import { Suspense } from "react";
import { CountryPart } from "@/components/ForCountry";
import { MyList, type ListItem } from "@/components/MyList";
import { ShoppingCheckCta } from "@/components/ShoppingCheckCta";
import { yearlyFields } from "@/components/YearlyBlock";
import { packSize } from "@/lib/basket-view";
import { getAllBundles, getAllPairs } from "@/lib/catalog";
import { getT } from "@/lib/i18n";
import { productName } from "@/lib/i18n/product-name";
import { subcategoryName } from "@/lib/i18n/record";
import { getLang } from "@/lib/i18n/server";
import { withVia } from "@/lib/via";

export const metadata: Metadata = {
  title: "My savings list",
  description: "Add up what switching to the cheaper products saves you.",
  robots: { index: false, follow: true },
};

export default function MyListPage() {
  const lang = getLang();
  const t = getT(lang);
  const items: ListItem[] = [
    // Swaps and kits whose prices a store's affiliate terms withhold (src/lib/programme-terms.ts) have no saving to add up.
    ...getAllPairs().filter((p) => !p.withheld).map((p) => ({
      slug: p.slug,
      href: withVia(`/compare/${p.slug}`, "list"),
      kind: "swap" as const,
      from: p.brand.brand,
      to: p.alternative.brand,
      detail: t("myListPage.detail", subcategoryName(p.subcategory, lang).replace(/\s+-\s+/g, ": "), packSize(p.brand.size, p.brand.unit, lang)),
      savingsPct: p.savingsPct,
      savings: p.savingsPerPack,
      currency: p.currency,
      category: p.category,
      unit: p.brand.unit,
      fromPhoto: p.brand.photo?.src ?? null,
      fromAlt: productName(p.brand.product, lang),
      toPhoto: p.alternative.photo?.src ?? null,
      toAlt: productName(p.alternative.product, lang),
      yearly: yearlyFields(p, lang),
    })),
    ...getAllBundles().filter((b) => !b.withheld).map((b) => {
      const piece = b.components.find((c) => c.photo) ?? b.components[0];
      return {
        slug: b.slug,
        href: withVia(`/bundle/${b.slug}`, "list"),
        kind: "kit" as const,
        from: b.bundle.brand,
        to: t("myListPage.cheaperItems", b.components.length),
        detail: (lang === "de" && b.de?.name) || b.bundle.name,
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
      <h1 className="display text-[1.75rem] md:text-[2.5rem]">{t("myListPage.h1")}</h1>
      <p className="mt-1.5 max-w-[62ch] text-[15px] text-ink-2 md:text-base">{t("myListPage.intro")}</p>
      {/* Above the list: the list's height is only known in the browser, so anything under it would jump. */}
      <ShoppingCheckCta className="mt-4 max-w-3xl md:mt-6" lang={lang} />
      {/* The list reads the shared link's query. A prefixed page renders its CountryPart straight away, so this boundary is the one it waits in. */}
      <CountryPart fallback={<div className="card mt-4 h-40 md:mt-6" />}>
        {() => (
          <Suspense fallback={<div className="card mt-4 h-40 md:mt-6" />}>
            <MyList items={items} />
          </Suspense>
        )}
      </CountryPart>
    </section>
  );
}
