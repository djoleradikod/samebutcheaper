import type { MetadataRoute } from "next";
import { getAllBundles, getAllPairs, getAllPresets, getBrands, getDupes, getIngredients, getPair, getPairsByCategory } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/categories";
import { checkedDate, newest, swapLanguages } from "@/lib/seo";
import { SITE } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Every page that is indexable and answers 200, and nothing else: /search, /my-list, the newsletter pages and empty
 * aisles are noindex, so they stay out. A page's date is the newest price check among the records it shows, never the
 * build date, so a crawler can tell which pages changed. Prose pages have no record date and give none.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE.url}${path}`;
  const at = (date: Date | null) => (date ? { lastModified: date } : {});
  const pairs = getAllPairs();
  const all = newest([...pairs.map((p) => p.price_checked), ...getAllBundles().map((b) => b.price_checked)]);
  const hubs: [string, Date | null][] = [
    ["", all],
    ["/biggest-savings", newest(pairs.map((p) => p.price_checked))],
    ["/bundles", newest([...getAllBundles().map((b) => b.price_checked), ...getAllPresets().flatMap((p) => p.lines.map((l) => getPair(l.pair)?.price_checked))])],
    ["/bulk", newest(pairs.filter((p) => p.bulkView.bigger).map((p) => p.price_checked))],
    ["/brands", all],
    ["/ingredients", all],
  ];
  const prose = ["/check", "/why", "/how-we-verify", "/suggest", "/about", "/credits", "/disclosure", "/privacy"];

  const entries: Entry[] = [
    ...hubs.map(([path, date]) => ({ url: url(path), ...at(date), changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...prose.map((path) => ({ url: url(path), changeFrequency: "monthly" as const, priority: 0.4 })),
    ...CATEGORIES.map((c) => ({ c, list: getPairsByCategory(c.slug) }))
      .filter(({ list }) => list.length > 0)
      .map(({ c, list }) => ({
        url: url(`/category/${c.slug}`),
        ...at(newest(list.map((p) => p.price_checked))),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ...pairs.map((p) => {
      const languages = swapLanguages(p);
      return {
        url: url(`/compare/${p.slug}`),
        ...at(checkedDate(p.price_checked)),
        changeFrequency: "monthly" as const,
        priority: 0.9,
        ...(languages ? { alternates: { languages: Object.fromEntries(Object.entries(languages).map(([k, v]) => [k, url(v)])) } } : {}),
      };
    }),
    ...getDupes().map((d) => ({
      url: url(`/dupe/${d.slug}`),
      ...at(newest(d.pairs.map((p) => p.price_checked))),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...getAllBundles().map((b) => ({
      url: url(`/bundle/${b.slug}`),
      ...at(checkedDate(b.price_checked)),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...getAllPresets().map((p) => ({
      url: url(`/basket/${p.slug}`),
      ...at(newest(p.lines.map((l) => getPair(l.pair)?.price_checked))),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...getIngredients().map((i) => ({
      url: url(`/ingredient/${i.slug}`),
      ...at(newest(i.pairs.map((p) => p.price_checked))),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...getBrands().map((b) => ({
      url: url(`/brand/${b.slug}`),
      ...at(newest([...b.pairs.map((p) => p.price_checked), ...b.bundles.map((x) => x.price_checked)])),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return entries;
}
