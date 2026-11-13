import { getAllBundles, getAllPairs } from "@/lib/catalog";
import { atomFeed, feedEntries } from "@/lib/feed";
import { SITE } from "@/lib/site";

/**
 * Atom feed of the most recently price-checked swaps and kits. Prerendered: it reads no request data, so it changes
 * when the catalogue does. Titles and summaries name no money amounts, as the page heads don't (see seo.ts).
 */
export async function GET() {
  const xml = atomFeed(SITE, feedEntries(getAllPairs(), getAllBundles()));
  return new Response(xml, { headers: { "content-type": "application/atom+xml; charset=utf-8" } });
}
