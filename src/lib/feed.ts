/** The Atom feed's entries and XML. Pure, so it is tested without a server. */
import { bundleDescription, bundleTitle, checkedDate, swapDescription, swapTitles } from "./seo";
import type { Bundle, Pair } from "./types";

export type FeedEntry = { title: string; path: string; updated: Date; summary: string; category: string };

const FEED_SIZE = 60;

/** Newest price check first; within a month, the bigger saving first. */
export function feedEntries(pairs: Pair[], bundles: Bundle[], size = FEED_SIZE): FeedEntry[] {
  const titles = swapTitles(pairs);
  const entries = [
    ...pairs.map((p) => ({
      title: titles.get(p.slug) ?? p.title,
      path: `/compare/${p.slug}`,
      checked: p.price_checked,
      pct: p.savingsPct,
      summary: swapDescription(p),
      category: p.category,
    })),
    ...bundles.map((b) => ({
      title: bundleTitle(b),
      path: `/bundle/${b.slug}`,
      checked: b.price_checked,
      pct: b.netSavingsPct,
      summary: bundleDescription(b),
      category: b.category,
    })),
  ];
  return entries
    .map((e) => ({ ...e, updated: checkedDate(e.checked) }))
    .filter((e): e is typeof e & { updated: Date } => e.updated !== null)
    .sort((a, b) => b.updated.getTime() - a.updated.getTime() || b.pct - a.pct)
    .slice(0, size)
    .map(({ title, path, updated, summary, category }) => ({ title, path, updated, summary, category }));
}

export function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function atomFeed(site: { name: string; url: string; tagline: string }, entries: FeedEntry[]) {
  const updated = entries.reduce((a, e) => (e.updated > a ? e.updated : a), new Date(0));
  const items = entries
    .map(
      (e) => `  <entry>
    <title>${xmlEscape(e.title)}</title>
    <link rel="alternate" type="text/html" href="${xmlEscape(site.url + e.path)}"/>
    <id>${xmlEscape(site.url + e.path)}</id>
    <updated>${e.updated.toISOString()}</updated>
    <category term="${xmlEscape(e.category)}"/>
    <summary>${xmlEscape(e.summary)}</summary>
  </entry>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEscape(site.name)}: newest price checks</title>
  <subtitle>${xmlEscape(site.tagline)}</subtitle>
  <link rel="alternate" type="text/html" href="${xmlEscape(site.url)}/"/>
  <link rel="self" type="application/atom+xml" href="${xmlEscape(site.url)}/feed.xml"/>
  <id>${xmlEscape(site.url)}/feed.xml</id>
  <updated>${updated.toISOString()}</updated>
  <author><name>${xmlEscape(site.name)}</name></author>
${items}
</feed>
`;
}
