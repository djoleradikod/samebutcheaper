import { getAllBundles, getAllPairs, toSummary } from "@/lib/catalog";
import type { BundleSummary, IndexPair, SwapIndex } from "@/lib/browse";
import type { Bundle, Pair } from "@/lib/types";
import { subcategoryName } from "@/lib/i18n/record";
import { ratingLabelDe } from "@/lib/i18n/compare-de";
import { getT } from "@/lib/i18n";
import { CATEGORIES } from "@/lib/categories";
import { ingredientNames, type AisleNames } from "@/lib/search-index";

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

/**
 * A swap's card, with its shelf and rating in German for German pages (src/lib/browse.ts), and its ingredient names in
 * English and German for the search (src/lib/search-index.ts), which reads them in place of the card's `keywords`.
 */
function toIndexPair(p: Pair): IndexPair {
  const rating = p.alternative.rating;
  return { ...toSummary(p), keywords: "", ing: ingredientNames(p), de: { subcategory: subcategoryName(p.subcategory, "de"), altRating: rating ? ratingLabelDe(rating) : null } };
}

/** Each aisle's names to search by: the English name and the German one. */
function aisleNames(): AisleNames {
  const de = getT("de");
  return Object.fromEntries(CATEGORIES.map((c) => [c.slug, `${c.name}\n${de(`categories.${c.slug}.name`)}`]));
}

/**
 * The card data of every swap, as static JSON. Search and the filterable lists fetch it after
 * the first paint, so it never adds to the weight of a page. Prerendered: it reads no request data.
 */
export async function GET() {
  const index: SwapIndex = {
    pairs: getAllPairs().map(toIndexPair),
    bundles: getAllBundles().map(toBundleSummary),
    aisles: aisleNames(),
  };
  return Response.json(index);
}
