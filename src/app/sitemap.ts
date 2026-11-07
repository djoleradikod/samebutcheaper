import type { MetadataRoute } from "next";
import { getAllBundles, getAllPairs, getAllPresets, getBrands, getDupes, getIngredients } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/check",
    "/biggest-savings",
    "/bundles",
    "/bulk",
    "/why",
    "/ingredients",
    "/brands",
    "/how-we-verify",
    "/suggest",
    "/about",
    "/credits",
    "/disclosure",
    "/privacy",
  ];
  return [
    ...staticPages.map((p) => ({
      url: `${SITE.url}${p}`,
      changeFrequency: "weekly" as const,
      priority: p === "" ? 1 : 0.5,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${SITE.url}/category/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...getAllPresets().map((p) => ({
      url: `${SITE.url}/basket/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...getAllPairs().map((p) => ({
      url: `${SITE.url}/compare/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...getDupes().map((d) => ({
      url: `${SITE.url}/dupe/${d.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...getAllBundles().map((b) => ({
      url: `${SITE.url}/bundle/${b.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...getIngredients().map((i) => ({
      url: `${SITE.url}/ingredient/${i.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...getBrands().map((b) => ({
      url: `${SITE.url}/brand/${b.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
