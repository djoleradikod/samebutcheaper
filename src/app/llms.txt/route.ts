import { linksEarn } from "@/lib/affiliate";
import { getAllBundles, getAllPairs, getAllPresets, getBrands, getDupes, getIngredients, getMarketCounts, getSiteStats } from "@/lib/catalog";
import { llmsText } from "@/lib/llms";
import { oneOfEachSwap } from "@/lib/localize";
import { MARKET_CODES } from "@/lib/markets";
import { SITE } from "@/lib/site";

/** The llms.txt proposal's file for this site. Prerendered from the catalogue. */
export async function GET() {
  const pairs = oneOfEachSwap(getAllPairs());
  const counts = getMarketCounts();
  // Examples a model can open: the biggest saving with a checked match in each page type.
  const swap = pairs.find((p) => p.match_type === "identical_active" && !p.priceOld) ?? pairs[0];
  const dupe = getDupes().find((d) => d.pairs.includes(swap));
  const brand = getBrands().find((b) => b.pairs.includes(swap));
  const ingredient = getIngredients()[0];
  const text = llmsText({
    name: SITE.name,
    url: SITE.url,
    swaps: getSiteStats().pairs,
    kits: getAllBundles().length,
    baskets: getAllPresets().length,
    brands: getBrands().length,
    ingredients: getIngredients().length,
    markets: MARKET_CODES.filter((m) => counts[m]),
    aisles: [...new Set(pairs.map((p) => p.category))],
    linksEarn: linksEarn(),
    examples: {
      swap: swap && `/compare/${swap.slug}`,
      dupe: dupe && `/dupe/${dupe.slug}`,
      brand: brand && `/brand/${brand.slug}`,
      ingredient: ingredient && `/ingredient/${ingredient.slug}`,
      kit: getAllBundles()[0] && `/bundle/${getAllBundles()[0].slug}`,
      basket: getAllPresets()[0] && `/basket/${getAllPresets()[0].slug}`,
    },
  });
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
