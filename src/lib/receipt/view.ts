import "server-only";
import { getAllPairs, getPair } from "@/lib/catalog";
import { forCountry, type Local } from "@/lib/localize";
import type { Pair } from "@/lib/types";
import { packSize, unitLabel } from "@/lib/unit-format";
import type { Lang } from "@/lib/i18n/lang";
import { productName } from "@/lib/i18n/product-name";
import { savingKind } from "@/lib/yearly";
import { buildIndex, toCandidate, type Index } from "./match";
import type { SwapView } from "./types";

/** The result's view of a swap. The yearly fields are read the same way as the swap page and My list (YearlyBlock). */
export function swapView(p: Pair, lang: Lang = "en"): SwapView {
  const { brand: b, alternative: a } = p;
  return {
    slug: p.slug,
    href: `/compare/${p.slug}`,
    market: p.market,
    from: b.brand,
    fromProduct: productName(b.product, lang),
    to: a.brand,
    toProduct: productName(a.product, lang),
    match: p.match_type,
    savingsPct: p.savingsPct,
    savings: p.savingsPerPack,
    currency: p.currency,
    category: p.category,
    unit: b.unit,
    fromPhoto: b.photo?.src ?? null,
    toPhoto: a.photo?.src ?? null,
    yearly: {
      kind: savingKind({ category: p.category, unit: b.unit, size: b.size, products: [b.product, a.product] }),
      prices: { brandPrice: b.price, brandSize: b.size, altPrice: a.price, altSize: a.size },
      pack: packSize(b.size, b.unit, lang),
      per: unitLabel(b.unit, lang),
    },
  };
}

export function swapViews(slugs: Iterable<string>, lang: Lang = "en"): Record<string, SwapView> {
  const out: Record<string, SwapView> = {};
  for (const slug of slugs) {
    const p = getPair(slug);
    if (p) out[slug] = swapView(p, lang);
  }
  return out;
}

/** The matcher's index of the swaps this shopper's country lists. The catalogue is fixed per build, so one per setting. */
const indexes = new Map<string, Index>();

export function indexFor(local: Local): Index {
  const key = `${local.known ? local.country : "?"}${local.others ? "+" : ""}`;
  let index = indexes.get(key);
  if (!index) {
    index = buildIndex(forCountry(getAllPairs(), local).map(toCandidate));
    indexes.set(key, index);
  }
  return index;
}

/** Whether this shopper's country lists the swap. */
export function listedFor(slug: string, local: Local) {
  const p = getPair(slug);
  return Boolean(p && local.shows(p));
}
