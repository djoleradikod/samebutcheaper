import { jsonLdText, SITE } from "@/lib/site";

/**
 * Structured data for a list page (an aisle, a brand): the breadcrumb trail and the swaps it lists, so search
 * engines can show the trail and read the page as a collection of comparisons. Uses every record, whatever the
 * shopper's country, because crawlers see the static page.
 */
export function ListSchema({
  name,
  path,
  crumbs,
  items,
}: {
  name: string;
  path: string;
  crumbs: { name: string; path: string }[];
  items: { name: string; path: string }[];
}) {
  const data = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [{ name: "Home", path: "" }, ...crumbs, { name, path }].map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: `${SITE.url}${c.path}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name,
      url: `${SITE.url}${path}`,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.slice(0, 100).map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          url: `${SITE.url}${it.path}`,
        })),
      },
    },
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(data) }} />;
}
