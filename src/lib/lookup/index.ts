import "server-only";
import type { LookFor } from "@/lib/markets";
import type { Bundle, Pair } from "@/lib/types";
import { dsldLabel, searchDsld } from "./dsld";
import { fdaBySetId, fdaByUpc, fdaSameActives, searchFda } from "./openfda";
import { openFactsByBarcode, openFactsProduct, searchOpenFacts } from "./openfacts";
import { bundlesFor, lookForProduct, searchCatalog, swapsWithSameActives, verifiedSwapsFor } from "./match";
import { gtinVariants, overlap } from "./text";
import type { Candidate, LabelMatch, LookupProduct, LookupSource } from "./types";

export * from "./types";
export { isGtin } from "./text";

/** Runs a source and turns its failure into a flag instead of an error page. */
async function attempt<T>(source: LookupSource, fallback: T, run: () => Promise<T>): Promise<[T, LookupSource | null]> {
  try {
    return [await run(), null];
  } catch (err) {
    console.error(`lookup source ${source} failed:`, err instanceof Error ? err.message : err);
    return [fallback, source];
  }
}

export type SearchOutcome = {
  /** Verified swaps from our catalog. */
  catalog: Pair[];
  /** Products found in public label databases. */
  candidates: Candidate[];
  /** Sources that didn't answer. */
  failed: LookupSource[];
};

const SOURCE_ORDER: LookupSource[] = ["fda", "dsld", "obf", "off", "opff", "photo"];

export async function searchProducts(q: string): Promise<SearchOutcome> {
  const results = await Promise.all([
    attempt("fda", [] as Candidate[], () => searchFda(q)),
    attempt("dsld", [] as Candidate[], () => searchDsld(q)),
    attempt("obf", [] as Candidate[], () => searchOpenFacts("obf", q)),
    attempt("off", [] as Candidate[], () => searchOpenFacts("off", q)),
  ]);
  const candidates = results
    .flatMap(([c]) => c)
    .map((c) => ({ c, score: overlap(q, `${c.brand} ${c.name}`) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || SOURCE_ORDER.indexOf(a.c.source) - SOURCE_ORDER.indexOf(b.c.source))
    .slice(0, 12)
    .map((x) => x.c);
  return {
    catalog: searchCatalog(q),
    candidates,
    failed: results.map(([, f]) => f).filter((f): f is LookupSource => !!f),
  };
}

export async function productFromSource(source: string, id: string): Promise<[LookupProduct | null, LookupSource | null]> {
  switch (source) {
    case "fda":
      return attempt("fda", null, () => fdaBySetId(id));
    case "dsld":
      return attempt("dsld", null, () => dsldLabel(id));
    case "obf":
    case "off":
    case "opff":
      return attempt(source, null, () => openFactsProduct(source, id));
    default:
      return [null, null];
  }
}

export async function productFromBarcode(code: string): Promise<{ product: LookupProduct | null; failed: LookupSource[] }> {
  const variants = gtinVariants(code);
  const [[fda, f1], [facts, f2]] = await Promise.all([
    attempt("fda", null as LookupProduct | null, () => fdaByUpc(variants)),
    attempt("off", null as LookupProduct | null, () => openFactsByBarcode(variants)),
  ]);
  return {
    product: fda ?? facts,
    failed: [f1, f2].filter((f): f is LookupSource => !!f),
  };
}

export type LookupDetail = {
  product: LookupProduct;
  /** Our verified swaps for exactly this product. */
  verified: Pair[];
  /** Our verified swaps whose cheaper product has the same actives. */
  sameActive: Pair[];
  bundles: Bundle[];
  /** Other official labels with the same actives (US medicines). */
  labelMatches: LabelMatch[];
  lookFor: LookFor;
  failed: LookupSource[];
};

/** Swaps priced in the shopper's own country first; otherwise the catalog's order. */
function ownMarketFirst<T extends { market: string }>(list: T[], country: string | null): T[] {
  if (!country) return list;
  return [...list].sort((a, b) => Number(b.market === country) - Number(a.market === country));
}

export async function detailFor(product: LookupProduct, country: string | null = null): Promise<LookupDetail> {
  const verified = ownMarketFirst(verifiedSwapsFor(product), country);
  const sameActive = ownMarketFirst(
    swapsWithSameActives(product.actives, new Set(verified.map((p) => p.slug))),
    country,
  );
  const [labelMatches, failed] =
    product.kind === "medicine" && product.actives.length
      ? await attempt("fda", [] as LabelMatch[], () => fdaSameActives(product))
      : [[] as LabelMatch[], null];
  return {
    product,
    verified,
    sameActive,
    bundles: ownMarketFirst(bundlesFor(product), country),
    labelMatches,
    lookFor: lookForProduct(product),
    failed: failed ? [failed] : [],
  };
}
