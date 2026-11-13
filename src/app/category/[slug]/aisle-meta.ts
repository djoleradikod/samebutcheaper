import type { Metadata } from "next";
import { CATEGORY_MAP } from "@/lib/categories";
import { getPairsByCategory } from "@/lib/catalog";
import { dict, getT, type Lang } from "@/lib/i18n";
import { categoryDescription, categoryTitle } from "@/lib/seo";
import { countryHead } from "@/lib/seo-catalog";
import type { CategorySlug } from "@/lib/types";

export function lookup(slug: string) {
  return Object.hasOwn(CATEGORY_MAP, slug) ? CATEGORY_MAP[slug as CategorySlug] : undefined;
}

/** The aisle's name and description in a language. */
export function aisleText(slug: CategorySlug, lang: Lang) {
  return lang === "en" ? CATEGORY_MAP[slug] : dict(lang).categories[slug];
}

/** The metadata for an aisle; the German view (/de/category/x) passes "de". */
export async function aisleMetadata(slug: string, lang: Lang = "en"): Promise<Metadata> {
  const t = getT(lang);
  const cat = lookup(slug);
  if (!cat) return { title: t("lists.category.notFound") };
  const { name, description } = aisleText(cat.slug, lang);
  const count = getPairsByCategory(cat.slug).length;
  if (!count) {
    return {
      title: lang === "en" ? `Cheaper ${name}` : t("lists.category.cheaper", name),
      description,
      alternates: { canonical: `/category/${cat.slug}` },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: categoryTitle(name, count, lang),
    description: categoryDescription(name, description, count, lang),
    ...(countryHead(`/category/${cat.slug}`, null) ?? { alternates: { canonical: `/category/${cat.slug}` } }),
  };
}
