import { getAllBundles, getAllPairs, toSummary } from "@/lib/catalog";
import type { BundleSummary, SwapIndex } from "@/lib/browse";
import type { Bundle, Pair } from "@/lib/types";
import { subcategoryName } from "@/lib/i18n/record";
import { ratingLabelDe } from "@/lib/i18n/compare-de";

function toBundleSummary(b: Bundle): BundleSummary {
  return {
    slug: b.slug,
    title: b.title,
    market: b.market,
    sellers: b.sellers,
    category: b.category,
    match_type: b.match_type,
    savingsPct: b.savingsPct,
    netSavingsPct: b.netSavingsPct,
    netSavings: b.netSavings,
    checkout: { delivery: b.checkout.delivery },
    equivalentTotal: b.equivalentTotal,
    currency: b.currency,
    bundle: {
      brand: b.bundle.brand,
      name: b.bundle.name,
      price: b.bundle.price,
      items: b.bundle.items.map((i) => ({ name: i.name })),
    },
    ...(b.de ? { de: { name: b.de.name } } : {}),
    photo: b.photo && { src: b.photo.src },
    components: b.components.map((c) => ({
      brand: c.brand,
      product: c.product,
      unit: c.unit,
      replaces: c.replaces,
      photo: c.photo && { src: c.photo.src },
    })),
  };
}

/** A swap's card, with its shelf and rating in German for German pages (src/lib/browse.ts). */
function toIndexPair(p: Pair) {
  const rating = p.alternative.rating;
  return { ...toSummary(p), de: { subcategory: subcategoryName(p.subcategory, "de"), altRating: rating ? ratingLabelDe(rating) : null } };
}

/**
 * The card data of every swap, as static JSON. Search and the filterable lists fetch it after
 * the first paint, so it never adds to the weight of a page. Prerendered: it reads no request data.
 */
export async function GET() {
  const index: SwapIndex = {
    pairs: getAllPairs().map(toIndexPair),
    bundles: getAllBundles().map(toBundleSummary),
  };
  return Response.json(index);
}
