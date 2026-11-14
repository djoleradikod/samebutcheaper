import type { MetadataRoute } from "next";
import { getAllBundles, getAllPairs, getAllPresets, getBrands, getBundle, getDupes, getIngredients, getPair, getPairsByCategory, getPreset } from "@/lib/catalog";
import { checkedDate, newest } from "@/lib/seo";
import { countrySitemap } from "@/lib/seo-catalog";
import { SITE } from "@/lib/site";
import type { CategorySlug } from "@/lib/types";

type Entry = MetadataRoute.Sitemap[number];

/**
 * Every page that is indexable and answers 200, and nothing else: /search, /my-list, the newsletter pages and empty
 * aisles are noindex, so they stay out. A page's date is the newest price check among the records it shows, never the
 * build date, so a crawler can tell which pages changed. Prose pages have no record date and give none.
 *
 * Pages with country URLs (home, hubs, aisles, swaps, kits, baskets) list exactly their indexable forms, each with all
 * the others as hreflang alternates (the rule is in src/lib/seo.ts and docs/country-urls.md). A swap's, kit's or
 * basket's unprefixed URL canonicalises to its own market's, so it isn't listed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;
  const at = (date: Date | null) => (date ? { lastModified: date } : {});
  const pairs = getAllPairs();
  const all = newest([...pairs.map((p) => p.price_checked), ...getAllBundles().map((b) => b.price_checked)]);
  const hubs: [string, Date | null][] = [
    ["/bulk", newest(pairs.filter((p) => p.bulkView.bigger).map((p) => p.price_checked))],
    ["/brands", all],
    ["/ingredients", all],
  ];
  // /check, /check/list and the trust pages in TRUST_PROSE have a German form, so they come with the country pages, alternates and all.
  const prose = ["/why", "/suggest", "/credits", "/privacy"];
  const TRUST_PROSE = ["/how-we-verify", "/about", "/disclosure"];

  /** The date and weight of a page with country URLs. */
  const about = (path: string): { date: Date | null; priority: number; changeFrequency: Entry["changeFrequency"] } => {
    const [, section, slug] = path.split("/");
    if (path === "/") return { date: all, priority: 1, changeFrequency: "weekly" };
    if (section === "check" || TRUST_PROSE.includes(path)) return { date: null, priority: 0.4, changeFrequency: "monthly" };
    if (path === "/biggest-savings") return { date: newest(pairs.map((p) => p.price_checked)), priority: 0.6, changeFrequency: "weekly" };
    if (path === "/bundles") {
      const dates = [...getAllBundles().map((b) => b.price_checked), ...getAllPresets().flatMap((p) => p.lines.map((l) => getPair(l.pair)?.price_checked))];
      return { date: newest(dates), priority: 0.6, changeFrequency: "weekly" };
    }
    if (section === "category") return { date: newest(getPairsByCategory(slug as CategorySlug).map((p) => p.price_checked)), priority: 0.8, changeFrequency: "weekly" };
    if (section === "compare") return { date: checkedDate(getPair(slug)?.price_checked), priority: 0.9, changeFrequency: "monthly" };
    if (section === "bundle") return { date: checkedDate(getBundle(slug)?.price_checked), priority: 0.8, changeFrequency: "monthly" };
    return { date: newest(getPreset(slug)?.lines.map((l) => getPair(l.pair)?.price_checked) ?? []), priority: 0.8, changeFrequency: "monthly" };
  };

  const countryPages: Entry[] = countrySitemap().map((e) => {
    const { date, priority, changeFrequency } = about(e.path);
    const languages = Object.fromEntries(Object.entries(e.languages).map(([k, v]) => [k, url(v)]));
    return { url: url(e.url), ...at(date), changeFrequency, priority, alternates: { languages } };
  });

  const entries: Entry[] = [
    ...countryPages,
    ...hubs.map(([path, date]) => ({ url: url(path), ...at(date), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...prose.map((path) => ({ url: url(path), changeFrequency: "monthly" as const, priority: 0.4 })),
    ...getDupes().map((d) => ({
      url: url(`/dupe/${d.slug}`),
      ...at(newest(d.pairs.map((p) => p.price_checked))),
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
