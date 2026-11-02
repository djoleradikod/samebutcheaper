import type { MetadataRoute } from "next";
import { getAllPairs } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/biggest-savings", "/how-we-verify", "/suggest", "/about", "/disclosure", "/privacy"];
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
    ...getAllPairs().map((p) => ({
      url: `${SITE.url}/compare/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
  ];
}
