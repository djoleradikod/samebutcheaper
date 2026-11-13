/**
 * Titles, descriptions, alternates and dates for search engines and AI assistants. Pure, so the templates are tested
 * against the whole catalogue (scripts/tests/seo.test.ts) and the page files only call them.
 *
 * Rules the templates keep:
 * - Say it in the words people search with: "X vs Y", "generic for X", "cheaper alternative to X", "cheapest <ingredient>".
 * - No money amounts. The head is the same for every country, and a price there would be in one market's currency. A
 *   percentage, a month and the market the prices are from are true for everyone.
 * - The site name is added by the layout's title template, so a title here stays under TITLE_MAX.
 * - Claims follow the match type, as the pages do: "same active ingredient" only where the record proves it.
 */
import { splitSentences } from "./compare";
import { dupeActives } from "./dupes";
import { inSentence, monthYear } from "./format";
import { MARKET_ADJECTIVE, oneOfEachSwap, shortMonth } from "./localize";
import type { MarketCode } from "./markets";
import type { Bundle, MatchType, Pair, Preset } from "./types";
import { unitDisplay } from "./unit-format";

/** Google shows about 60 characters of a title. The layout adds " | SameButCheaper" after this. */
export const TITLE_MAX = 60;
/** And about 155 of a description. */
export const DESCRIPTION_MAX = 155;

/** Cuts at a word boundary and marks the cut. Text that fits comes back unchanged. */
export function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.(-]+$/, "")}…`;
}

/** Sentences joined until the next one would pass `max`. Never cuts a sentence, unless the first one alone is too long. */
export function fitSentences(sentences: string[], max = DESCRIPTION_MAX) {
  let out = "";
  for (const s of sentences.map((x) => x.trim()).filter(Boolean)) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max) break;
    out = next;
  }
  return out || clip(sentences.find((s) => s.trim()) ?? "", max);
}

const pctText = (n: number) => `${Math.round(n)}%`;

/** "loratadine 10 mg", "ibuprofen 200 mg + caffeine": the actives a medicine search names. Null when the match isn't on actives. */
export function activesPhrase(pair: Pick<Pair, "match_type" | "brand">, max = 2) {
  const names = dupeActives({ ...pair, slug: "", subcategory: "" });
  if (!names) return null;
  const rows = pair.brand.key_ingredients.filter((i) => i.name.trim());
  return rows
    .slice(0, max)
    .map((i, n) => {
      const name = names[n] ?? i.name;
      const amount = i.amount && i.amount.length <= 12 && /\d/.test(i.amount) ? ` ${i.amount}` : "";
      return `${name.charAt(0).toLowerCase()}${name.slice(1)}${amount}`;
    })
    .join(" + ");
}

/** "Wet cat food", "AA batteries": a subcategory as a search would write it. */
function kindPhrase(subcategory: string) {
  return inSentence(subcategory.replace(/\s+-\s+/g, " ").replace(/\s*\(.*?\)\s*/g, " ").trim()).replace(/\s+/g, " ");
}

/** Product name without the brand repeated in front and without the pack size after a comma. */
function productPhrase(brand: string, product: string) {
  const bare = brand.replace(/\s*\(.*\)\s*$/, "");
  return product
    .replace(new RegExp(`^${bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "")
    .split(/,\s/)[0]
    .trim();
}

/* ------------------------------------------------------------------ swaps */

type SwapTitleInput = Pick<Pair, "slug" | "market" | "brand" | "alternative" | "match_type" | "subcategory" | "savingsPct" | "twin">;

/**
 * Candidate titles, from the shortest to the most specific. The first that is unique in the catalogue and fits is used.
 * A twin (the same swap priced in another market) always says whose prices it has, so the two never share a title.
 */
function swapTitleCandidates(p: SwapTitleInput): string[] {
  const vs = `${p.brand.brand} vs ${p.alternative.brand}`;
  const what = activesPhrase(p) ?? kindPhrase(p.subcategory);
  const tail = `${pctText(p.savingsPct)} cheaper`;
  const adjective = MARKET_ADJECTIVE[p.market];
  const market = p.twin ? ` (${adjective} prices)` : "";
  const brandProduct = productPhrase(p.brand.brand, p.brand.product);
  const altProduct = productPhrase(p.alternative.brand, p.alternative.product);
  const named = `${p.brand.brand} ${brandProduct} vs ${p.alternative.brand}`;
  const variant = p.brand.product.split(/,\s/)[1]?.trim();
  return [
    `${vs} ${what}: ${tail}${market}`,
    `${vs}: ${tail}${market}`,
    `${named}: ${tail}${market}`,
    `${named}${market}`,
    `${named} (${adjective} prices)`,
    `${named} ${altProduct} (${adjective} prices)`,
    // Products that differ only after the first comma, such as weight bands: "23-44 lbs".
    ...(variant ? [`${vs}, ${variant}: ${tail}${market}`, `${named}, ${variant} (${adjective} prices)`] : []),
    `${p.brand.product} vs ${p.alternative.product} (${adjective} prices)`,
  ];
}

/**
 * One title per swap, unique across the catalogue. Each swap takes its first candidate that fits in TITLE_MAX and no
 * other swap wants; where none fits, the shortest one no other swap wants.
 */
export function swapTitles(pairs: readonly SwapTitleInput[]): Map<string, string> {
  const options = pairs.map((p) => ({ slug: p.slug, list: swapTitleCandidates(p) }));
  const wanted = new Map<string, number>();
  for (const o of options) for (const t of new Set(o.list)) wanted.set(t.toLowerCase(), (wanted.get(t.toLowerCase()) ?? 0) + 1);
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const o of options) {
    const free = (t: string) => !taken.has(t.toLowerCase()) && wanted.get(t.toLowerCase()) === 1;
    // Over the length, a whole title beats a cut one: Google shortens it on screen, and assistants read all of it.
    const title =
      o.list.find((t) => t.length <= TITLE_MAX && free(t)) ??
      [...o.list].filter(free).sort((a, b) => a.length - b.length)[0] ??
      o.list[o.list.length - 1];
    taken.add(title.toLowerCase());
    out.set(o.slug, title);
  }
  return out;
}

/** What the record shows, in the words its match type allows. Mirrors the swap page's verdict line. */
export function matchClaim(matchType: MatchType, alt: string, brand: string) {
  return {
    identical_active: `${alt} has the same active ingredient as ${brand}`,
    identical_formula: `${alt} has the same formula on the label as ${brand}`,
    same_manufacturer: `${alt} comes from the same manufacturer as ${brand}`,
    equivalent_spec: `${alt} does the same job as ${brand}`,
    same_kind: `${alt} is the same kind of product as ${brand}`,
  }[matchType];
}

/**
 * "Is Equate the same as Claritin? Equate has the same active ingredient (loratadine 10 mg) and costs 88% less per
 * tablet at US prices checked November 2026." A same-kind swap says what its record can't show.
 */
export function swapDescription(p: Pick<Pair, "match_type" | "brand" | "alternative" | "savingsPct" | "market" | "price_checked">) {
  const a = p.alternative.brand;
  const b = p.brand.brand;
  const actives = p.match_type === "identical_active" ? activesPhrase(p, 3) : null;
  const { label } = unitDisplay(p.brand.unit);
  const per = label === "each" ? "" : ` ${label}`;
  const price = `costs ${pctText(p.savingsPct)} less${per} at ${MARKET_ADJECTIVE[p.market]} prices checked ${shortMonth(p.price_checked)}`;
  const claim = matchClaim(p.match_type, a, b);
  const lead =
    p.match_type === "same_kind"
      ? [`${claim} and costs ${pctText(p.savingsPct)} less${per} at ${MARKET_ADJECTIVE[p.market]} prices, but our records don't show they match inside.`]
      : [`${claim}${actives ? ` (${actives})` : ""} and ${price}.`];
  const question = `Is ${a} the same as ${b}?`;
  const withQuestion = [question, ...lead].join(" ");
  const first = withQuestion.length <= DESCRIPTION_MAX ? [withQuestion] : lead;
  return fitSentences([...first, "What differs, the sources, and where to buy."]);
}

/* ---------------------------------------------------------- hreflang, x-default */

/** The page is in English everywhere. The region says whose shelf prices it has. */
export function hreflangFor(market: MarketCode) {
  return `en-${market}`;
}

/**
 * hreflang for a swap priced in two markets: each record names itself and its twin, and x-default is the record a
 * shopper we can't place sees (the one with English names, see TWIN_ORDER in localize.ts). Null for a swap with no twin.
 */
export function swapLanguages(p: Pick<Pair, "slug" | "market" | "twin" | "sellers">): Record<string, string> | null {
  if (!p.twin) return null;
  const self = { slug: p.slug, market: p.market, sellers: p.sellers, twin: p.twin };
  const twin = { slug: p.twin.slug, market: p.twin.market, sellers: [], twin: { slug: p.slug, market: p.market } };
  const preferred = oneOfEachSwap([self, twin])[0] ?? self;
  return {
    [hreflangFor(p.market)]: `/compare/${p.slug}`,
    [hreflangFor(p.twin.market)]: `/compare/${p.twin.slug}`,
    "x-default": `/compare/${preferred.slug}`,
  };
}

/* ---------------------------------------------------------- other page types */

/** "Generic for Claritin (loratadine)": only medicines have generics. Everything else is a cheaper alternative. */
export function dupeHeading(d: { brand: string; actives: string[] | null; subcategory: string; category: string }) {
  const what = d.actives ? d.actives.join(", ") : d.subcategory.toLowerCase();
  const isMedicine = d.category === "otc-medicine" && !!d.actives;
  return {
    what,
    title: isMedicine ? `Generic for ${d.brand}` : d.actives ? `Cheaper alternative to ${d.brand}` : `Cheaper alternatives to ${d.brand}`,
    noun: isMedicine ? "generic" : "cheaper alternative",
  };
}

export function dupeTitle(d: Parameters<typeof dupeHeading>[0], bestPct: number) {
  const h = dupeHeading(d);
  const full = `${h.title} (${h.what}): save up to ${pctText(bestPct)}`;
  if (full.length <= TITLE_MAX) return full;
  const short = `${h.title}: save up to ${pctText(bestPct)}`;
  return short.length <= TITLE_MAX ? short : clip(h.title, TITLE_MAX);
}

export function dupeDescription(
  d: Parameters<typeof dupeHeading>[0],
  pairs: Pick<Pair, "match_type" | "alternative" | "brand" | "savingsPct" | "market" | "price_checked" | "twin" | "sellers">[],
) {
  const h = dupeHeading(d);
  const one = oneOfEachSwap(pairs);
  const top = one[0];
  if (!top) return "";
  const checked = one.filter((p) => p.match_type !== "same_kind").length;
  const n = one.length;
  const lead =
    checked > 0
      ? `${checked} checked ${h.noun === "generic" ? `generic${checked === 1 ? "" : "s"}` : `match${checked === 1 ? "" : "es"}`} for ${d.brand}${d.actives ? ` (${h.what})` : ""}, compared per unit.`
      : `${n} cheaper product${n === 1 ? "" : "s"} of the same kind as ${d.brand}, compared per unit.`;
  return fitSentences([
    lead,
    `${matchClaim(top.match_type, top.alternative.brand, d.brand)} and costs ${pctText(top.savingsPct)} less at ${MARKET_ADJECTIVE[top.market]} prices.`,
    "Sources and differences on each.",
  ]);
}

export function brandTitle(name: string, bestPct: number) {
  const full = `Cheaper alternatives to ${name}: save up to ${pctText(bestPct)}`;
  return full.length <= TITLE_MAX ? full : clip(`Cheaper alternatives to ${name}`, TITLE_MAX);
}

/** Names what the brand's swaps are for, since "cheaper than Apple" means nothing without it. */
export function brandDescription(name: string, kinds: string[], count: number, matchLine: string) {
  const list = [...new Set(kinds.map(kindPhrase))].slice(0, 3);
  const what = list.length ? `: ${list.join(", ")}` : "";
  return fitSentences([`${count} cheaper alternative${count === 1 ? "" : "s"} to ${name} products${what}, compared per unit with sources.`, matchLine]);
}

export function ingredientTitle(name: string, isMedicine: boolean) {
  const n = inSentence(name);
  const t = isMedicine ? `Cheapest ${n}: brand names vs generics` : `Cheapest ${n}: brand names vs cheaper matches`;
  return t.length <= TITLE_MAX ? t : clip(`Cheapest ${n}`, TITLE_MAX);
}

export function ingredientDescription(name: string, brands: string[], count: number) {
  const shown = brands.slice(0, 3).join(", ");
  return fitSentences([
    `${count} product${count === 1 ? "" : "s"} with ${inSentence(name)} as the brand names have it${shown ? ` (${shown})` : ""}, each beside a cheaper one with the same ingredient.`,
    "Compared per unit, with the label sources.",
  ]);
}

/** The count first, since it's what the search result can't show elsewhere, then the aisle's own description. */
export function categoryDescription(name: string, description: string, count: number) {
  const lead = count ? [`${count} cheaper alternatives to brand-name ${inSentence(name)}, compared per unit with sources.`] : [];
  return fitSentences([...lead, ...splitSentences(description)]);
}

export function categoryTitle(name: string, count: number) {
  return count ? `Cheaper ${inSentence(name)}: ${count} brand-name swaps` : `Cheaper ${inSentence(name)}`;
}

/** "Momentous Nightly Sleep rebuilt for 85% less": the kit's name up to its pack details. */
export function bundleTitle(b: Pick<Bundle, "bundle" | "netSavingsPct">) {
  const name = b.bundle.name.split(/,\s|\s\(/)[0].trim();
  const tail = ` rebuilt for ${pctText(b.netSavingsPct)} less`;
  return name.length + tail.length <= TITLE_MAX ? `${name}${tail}` : clip(name, TITLE_MAX);
}

export function bundleDescription(b: Pick<Bundle, "bundle" | "netSavingsPct" | "market" | "price_checked" | "components">) {
  const name = b.bundle.name.split(/,\s|\s\(/)[0].trim();
  const n = b.components.length;
  return fitSentences([
    `${name}, rebuilt from ${n} cheaper product${n === 1 ? "" : "s"} that cover the same amount.`,
    `${pctText(b.netSavingsPct)} less after delivery, at ${MARKET_ADJECTIVE[b.market]} prices checked ${monthYear(b.price_checked)}.`,
    "Each piece with its sources.",
  ]);
}

export function basketTitle(p: Pick<Preset, "title" | "savingsPct" | "market">) {
  const t = `${p.title}: the same shop for ${pctText(p.savingsPct)} less`;
  return t.length <= TITLE_MAX ? t : clip(p.title, TITLE_MAX);
}

export function basketDescription(p: Pick<Preset, "audience" | "lines" | "savingsPct" | "market">) {
  const n = p.lines.length;
  return fitSentences([
    `${p.audience}.`,
    `${n} brand-name items and the cheaper swap for each: the same amount for ${pctText(p.savingsPct)} less, at ${MARKET_ADJECTIVE[p.market]} prices.`,
  ]);
}

/* ------------------------------------------------------------------- dates */

/** "2026-11" (a record's price_checked) as the first of that month, UTC. Null when it doesn't read as a date. */
export function checkedDate(iso: string | undefined | null): Date | null {
  const m = iso?.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
}

/** The newest of these dates, for a page that lists records. */
export function newest(dates: (string | undefined | null)[]): Date | null {
  return dates.map(checkedDate).reduce<Date | null>((a, d) => (d && (!a || d > a) ? d : a), null);
}
