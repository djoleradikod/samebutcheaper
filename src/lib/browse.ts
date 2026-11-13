import { CATEGORIES, CATEGORY_MAP, MATCH_TYPE_META } from "./categories";
import { isThinMarket, listMarketFor } from "./localize";
import { isMarket, MARKET_CODES, MARKET_LABEL, type MarketCode } from "./markets";
import { leadFirst } from "./freshness";
import type { PhotoTier } from "./photos";
import type { Bundle, CategorySlug, MatchType, PairSummary } from "./types";

/**
 * How a list of swaps is filtered and sorted. Pure, so the server can work out what the
 * first screen shows and the browser can recompute it without asking the server again.
 */

/** Cards per screenful: 6 rows of 4 on a desktop, 12 rows of 2 on a phone. */
export const PAGE_SIZE = 24;
export const SWAP_GRID = "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4";
export const SWAP_GRID_BESIDE_FILTERS = "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4";
export const MEDICINE: CategorySlug = "otc-medicine";

/** Static JSON with the card data of every swap, loaded the first time a list or search needs it. */
export const SWAP_INDEX_URL = "/search/index.json";

/** What filtering and sorting need for one swap. Card data travels apart, only for what's on screen. */
export type BrowseRow = {
  slug: string;
  aisle: CategorySlug;
  shelf: string;
  match: MatchType;
  market: MarketCode;
  /** A real photo on at least one side. */
  photo: boolean;
  /** Which group of the list it goes in, see photoTier. */
  tier: PhotoTier;
  /** The cheaper product has a rating on file. Unrated ones sort behind it. */
  rated: boolean;
  /** Saving per unit, 0 to 100. */
  pct: number;
  /** The cheaper unit price as the card shows it, in rough dollars so markets can rank together. */
  unit: number;
  /** When the prices were checked, ISO year-month. */
  checked: string;
  /** The price is stale (see freshness.ts): it sorts last within its group, so it never leads a list. */
  stale?: boolean;
};

/** The fields BundleCard reads. A whole bundle is about ten times bigger. */
export type BundleSummary = Pick<Bundle, "slug" | "title" | "market" | "sellers" | "category" | "match_type" | "savingsPct" | "netSavingsPct" | "netSavings" | "equivalentTotal" | "currency"> & {
  checkout: Pick<Bundle["checkout"], "delivery">;
  bundle: Pick<Bundle["bundle"], "brand" | "name" | "price"> & { items: { name: string }[] };
  photo: { src: string } | null;
  components: (Pick<Bundle["components"][number], "brand" | "product" | "unit" | "replaces"> & {
    photo: { src: string } | null;
  })[];
};

export type SwapIndex = { pairs: PairSummary[]; bundles: BundleSummary[] };

export const SORTS = [
  { value: "saving", label: "Biggest saving" },
  { value: "unit", label: "Lowest unit price" },
  { value: "newest", label: "Newest check" },
] as const;

export type SortKey = (typeof SORTS)[number]["value"];

export type BrowseState = {
  aisles: CategorySlug[];
  shelves: string[];
  matches: MatchType[];
  /** Null until the shopper picks: then it follows their country. */
  market: MarketCode | "all" | null;
  photo: boolean;
  /** Adds medicine back on a list that leaves it out by default. */
  medicine: boolean;
  sort: SortKey;
  show: number;
};

const STATE_KEYS = ["aisle", "shelf", "match", "market", "photo", "medicine", "sort", "show"];

export function parseState(search: string): BrowseState {
  const q = new URLSearchParams(search);
  const market = q.get("market");
  const sort = SORTS.find((s) => s.value === q.get("sort"))?.value ?? "saving";
  const show = Number.parseInt(q.get("show") ?? "", 10);
  return {
    aisles: q.getAll("aisle").filter((a): a is CategorySlug => Object.hasOwn(CATEGORY_MAP, a)),
    shelves: q.getAll("shelf"),
    matches: q.getAll("match").filter((m): m is MatchType => Object.hasOwn(MATCH_TYPE_META, m)),
    market: market === "all" || isMarket(market) ? market : null,
    photo: q.get("photo") === "1",
    medicine: q.get("medicine") === "1",
    sort,
    show: show > PAGE_SIZE ? show : PAGE_SIZE,
  };
}

/** The state as a query string, keeping anything else already in the URL. */
export function stateToQuery(s: BrowseState, current = "") {
  const q = new URLSearchParams(current);
  for (const key of STATE_KEYS) q.delete(key);
  for (const a of s.aisles) q.append("aisle", a);
  for (const shelf of s.shelves) q.append("shelf", shelf);
  for (const m of s.matches) q.append("match", m);
  if (s.market) q.set("market", s.market);
  if (s.photo) q.set("photo", "1");
  if (s.medicine) q.set("medicine", "1");
  if (s.sort !== "saving") q.set("sort", s.sort);
  if (s.show > PAGE_SIZE) q.set("show", String(s.show));
  return q;
}

/** "Ground spices" becomes "ground-spices" in a shareable link. */
export function shelfKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Until the shopper picks, show their own country's prices, or the nearest market's when it has none.
 * "all" means every row the server sent, and it leaves out US and Canadian records outside those two countries
 * (see forCountry). With no country at all, assume the US.
 */
export function defaultMarket(rows: BrowseRow[], country: string | null, hideMedicine = false): MarketCode | "all" {
  // A market too thin to lead shows its own records beside the fallback's.
  if (isThinMarket(country)) return "all";
  const lead = listMarketFor(country);
  return rows.some((r) => r.market === lead && !(hideMedicine && r.aisle === MEDICINE)) ? lead : "all";
}

export function marketsIn(rows: BrowseRow[]) {
  return MARKET_CODES.filter((m) => rows.some((r) => r.market === m));
}

type Group = "aisle" | "shelf" | "match" | "market" | "photo";

type Scope = { market: MarketCode | "all"; hideMedicine: boolean };

/** Does the row pass every filter, leaving out one group when counting that group's options? */
function passes(r: BrowseRow, s: BrowseState, scope: Scope, skip?: Group) {
  if (skip !== "aisle") {
    if (s.aisles.length) {
      if (!s.aisles.includes(r.aisle)) return false;
    } else if (scope.hideMedicine && !s.medicine && r.aisle === MEDICINE) {
      return false;
    }
  }
  if (skip !== "shelf" && s.shelves.length && !s.shelves.includes(shelfKey(r.shelf))) return false;
  if (skip !== "match" && s.matches.length && !s.matches.includes(r.match)) return false;
  if (skip !== "market" && scope.market !== "all" && r.market !== scope.market) return false;
  if (skip !== "photo" && s.photo && !r.photo) return false;
  return true;
}

const bySlug = (a: BrowseRow, b: BrowseRow) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const bySaving = (a: BrowseRow, b: BrowseRow) => b.pct - a.pct || Number(b.photo) - Number(a.photo) || bySlug(a, b);

const COMPARE: Record<SortKey, (a: BrowseRow, b: BrowseRow) => number> = {
  saving: bySaving,
  unit: (a, b) => a.unit - b.unit || bySaving(a, b),
  newest: (a, b) => (a.checked < b.checked ? 1 : a.checked > b.checked ? -1 : bySaving(a, b)),
};

/**
 * The rows the shopper should see, in tiers: both photos cut out, then both photos, then one photo, then
 * none. Each tier follows the chosen sort, and the list prints one heading where the first tier ends,
 * because the sort starts again from the top there.
 */
export function matchRows(rows: BrowseRow[], s: BrowseState, scope: Scope) {
  const compare = COMPARE[s.sort];
  return rows.filter((r) => passes(r, s, scope)).sort((a, b) => a.tier - b.tier || leadFirst(a, b) || Number(b.rated) - Number(a.rated) || compare(a, b));
}

/** Cards already in tier order, split where the first tier ends. The second part is empty with only one tier. */
export function splitAtFirstTier<T>(cards: T[], tier: (card: T) => PhotoTier): [T[], T[]] {
  const end = cards.findIndex((c) => tier(c) !== tier(cards[0]));
  return end < 0 ? [cards, []] : [cards.slice(0, end), cards.slice(end)];
}

/**
 * Every swap a visitor can see before touching a filter: the first screen for each market a
 * country default could pick. Nobody has to wait for the index on their first view.
 */
export function firstScreenSlugs(rows: BrowseRow[], hideMedicine: boolean) {
  const state = parseState("");
  const slugs = new Set<string>();
  for (const market of ["all", ...marketsIn(rows)] as const) {
    for (const r of matchRows(rows, state, { market, hideMedicine }).slice(0, PAGE_SIZE)) slugs.add(r.slug);
  }
  return slugs;
}

export type FacetOption<V extends string = string> = { value: V; label: string; count: number };

export type Facets = {
  aisles: FacetOption<CategorySlug>[];
  /** Empty unless the list is down to one aisle: across the whole shop there are too many shelves to scan. */
  shelves: FacetOption[];
  matches: FacetOption<MatchType>[];
  markets: FacetOption<MarketCode>[];
  /** How many rows show with no market filter. */
  allMarkets: number;
  /** How many of the current rows have a photo, or null when the filter wouldn't change anything. */
  photo: number | null;
};

function tally<K>(rows: BrowseRow[], key: (r: BrowseRow) => K, live: (r: BrowseRow) => boolean) {
  const all = new Map<K, number>();
  const shown = new Map<K, number>();
  for (const r of rows) {
    const k = key(r);
    all.set(k, (all.get(k) ?? 0) + 1);
    if (live(r)) shown.set(k, (shown.get(k) ?? 0) + 1);
  }
  return { all, shown };
}

/**
 * Options and counts for each filter. A count says what ticking that option would show, so it
 * applies every other group. Options keep their order when counts change. Aisles and shelves
 * with nothing to show drop out, as there can be dozens, and a filter with one option stays hidden.
 */
export function buildFacets(rows: BrowseRow[], s: BrowseState, scope: Scope): Facets {
  const live = (skip: Group) => (r: BrowseRow) => passes(r, s, scope, skip);

  const aisleTally = tally(rows, (r) => r.aisle, live("aisle"));
  const aisles = CATEGORIES.filter((c) => aisleTally.all.has(c.slug))
    .map((c) => ({ value: c.slug, label: c.name, count: aisleTally.shown.get(c.slug) ?? 0 }))
    .filter((o) => o.count > 0 || s.aisles.includes(o.value));

  const inView = s.aisles.length
    ? new Set<CategorySlug>(s.aisles)
    : new Set(rows.filter((r) => !(scope.hideMedicine && !s.medicine && r.aisle === MEDICINE)).map((r) => r.aisle));
  let shelves: FacetOption[] = [];
  if (inView.size === 1) {
    const inAisle = rows.filter((r) => inView.has(r.aisle));
    const labels = new Map(inAisle.map((r) => [shelfKey(r.shelf), r.shelf]));
    const shelfTally = tally(inAisle, (r) => shelfKey(r.shelf), live("shelf"));
    shelves = [...shelfTally.all.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([value]) => ({ value, label: labels.get(value) ?? value, count: shelfTally.shown.get(value) ?? 0 }))
      .filter((o) => o.count > 0 || s.shelves.includes(o.value));
  }

  const matchTally = tally(rows, (r) => r.match, live("match"));
  const matches = (Object.keys(MATCH_TYPE_META) as MatchType[])
    .filter((m) => matchTally.all.has(m))
    .sort((a, b) => MATCH_TYPE_META[b].strength - MATCH_TYPE_META[a].strength)
    .map((m) => ({ value: m, label: MATCH_TYPE_META[m].label, count: matchTally.shown.get(m) ?? 0 }));

  const marketTally = tally(rows, (r) => r.market, live("market"));
  const markets = MARKET_CODES.filter((m) => marketTally.all.has(m)).map((m) => ({
    value: m,
    label: MARKET_LABEL[m],
    count: marketTally.shown.get(m) ?? 0,
  }));

  const hasPhoto = rows.some((r) => r.photo);
  const allPhoto = rows.every((r) => r.photo);

  return {
    aisles,
    shelves: shelves.length > 1 ? shelves : [],
    matches,
    markets,
    allMarkets: rows.filter(live("market")).length,
    photo: hasPhoto && !allPhoto ? rows.filter((r) => r.photo && live("photo")(r)).length : null,
  };
}
