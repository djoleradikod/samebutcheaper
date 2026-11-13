/**
 * Store product numbers read from a product URL. The patterns come from the URLs already in data/pairs and
 * data/bundles (no store page was fetched): one example each is given. A search URL ("/search?q=...") carries no
 * number, so a record linked that way can only match a feed by barcode, or by name for review.
 *
 * `variant` is a pack size inside one product page (zooplus's activeVariant). A record that names a variant only
 * ever matches that variant; a record that doesn't name one never matches by number, since the product number
 * alone covers several pack sizes.
 */

export type StoreId = { store: string; id: string; variant?: string };

type Pattern = { store: string; host: RegExp; id: RegExp; variant?: (u: URL) => string | undefined; needsVariant?: boolean };

const PATTERNS: Pattern[] = [
  // https://www.walmart.com/ip/Equate-Ibuprofen-.../10315394 ; https://walmart.com/ip/seort/594995460 ;
  // https://business.walmart.com/ip/.../752393566 ; https://www.walmart.ca/en/ip/.../6000208283848 or /2N9MU335BWGS
  { store: "walmart", host: /(^|\.)walmart\.(com|ca)$/, id: /\/ip\/(?:[^/]+\/)*([0-9A-Z]{6,16})\/?$/ },
  // https://www.target.com/p/-/A-14238143 ; https://www.target.com/p/oil-free-acne-wash-.../-/A-91551186
  { store: "target", host: /(^|\.)target\.com$/, id: /\/A-(\d{6,10})\b/ },
  // https://www.zooplus.de/shop/hunde/.../1983704?activeVariant=1983704.2 ; https://www.zooplus.ie/shop/cats/.../221560?activeVariant=221560.3
  {
    store: "zooplus",
    host: /(^|\.)zooplus\.[a-z.]+$/,
    id: /\/shop\/.+\/(\d{3,9})\/?$/,
    variant: (u) => u.searchParams.get("activeVariant") ?? undefined,
    needsVariant: true,
  },
  // https://www.shop-apotheke.com/arzneimittel/17502496/paracetamol-adgc-500-mg.htm (the number is the PZN)
  { store: "shopapotheke", host: /(^|\.)shop-apotheke\.(com|at|ch)$/, id: /\/(?:arzneimittel|beauty|[a-z-]+)\/(\d{6,9})\// },
  // https://www.chewy.com/petarmor-plus-flea-tick-spot/dp/181538
  { store: "chewy", host: /(^|\.)chewy\.(com|ca)$/, id: /\/dp\/(\d{4,10})\b/ },
  // https://www.tesco.com/groceries/en-GB/products/265327225
  { store: "tesco", host: /(^|\.)tesco\.(com|ie)$/, id: /\/products\/(\d{6,12})\b/ },
  // https://www.pollin.de/p/varta-batterie-alkaline-mignon-aa-lr06-1-5v-energy-30-stueck-272634
  { store: "pollin", host: /(^|\.)pollin\.(de|at)$/, id: /\/p\/[^/]*-(\d{5,8})\/?$/ },
  // https://www.crocus.co.uk/product/_/felco-original-secateurs-model-no-2/classid.200601/
  { store: "crocus", host: /(^|\.)crocus\.co\.uk$/, id: /\/classid\.(\d{4,12})\/?/ },
];

/** The store number in a product URL, or null (search pages, unknown stores, a page without one). */
export function storeIdOf(url: string | null | undefined): StoreId | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  for (const p of PATTERNS) {
    if (!p.host.test(host)) continue;
    const m = p.id.exec(u.pathname);
    if (!m) return null;
    const variant = p.variant?.(u);
    if (variant && !variant.startsWith(`${m[1]}.`)) return null; // a variant of another product: the URL is muddled
    return { store: p.store, id: m[1], ...(variant ? { variant } : {}) };
  }
  return null;
}

/** Whether a store's number alone (no variant) is too broad to match on. */
export function needsVariant(store: string) {
  return PATTERNS.some((p) => p.store === store && p.needsVariant);
}

/** Search pages: they name no product, so they can't be matched by number. */
export function isSearchUrl(url: string) {
  try {
    const u = new URL(url);
    return /\/(search|s)(\.htm)?\/?$/.test(u.pathname) || ["q", "query", "searchTerm", "search"].some((k) => u.searchParams.has(k));
  } catch {
    return false;
  }
}
