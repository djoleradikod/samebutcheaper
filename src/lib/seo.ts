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
import { countryOfPath, PREFIXED_COUNTRIES, withCountry, type PrefixedCountry } from "./country-url";
import { localFor, MARKET_ADJECTIVE, oneOfEachSwap, shortMonth, type Listed } from "./localize";
import type { Bundle, MatchType, Pair, Preset } from "./types";
import { unitDisplay } from "./unit-format";
import { langForPage, type Lang } from "./i18n/lang";
import { getT } from "./i18n";
import { shortDateDe } from "./i18n/format";
import { subcategoryName } from "./i18n/record";
import { unitLabel } from "./unit-format";

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

type SwapTitleInput = Pick<Pair, "slug" | "market" | "brand" | "alternative" | "match_type" | "subcategory" | "savingsPct" | "twin" | "de">;

/** "Loratadin 10 mg": the actives in German, from the record's German label rows. Null without them. */
function activesPhraseDe(pair: SwapTitleInput, max = 2) {
  if (!activesPhrase(pair, max) || !pair.de?.ingredients) return null;
  return pair.de.ingredients.brand
    .filter((i) => i.name.trim())
    .slice(0, max)
    .map((i) => `${i.name}${i.amount && i.amount.length <= 12 && /\d/.test(i.amount) ? ` ${i.amount}` : ""}`)
    .join(" + ");
}

/**
 * Candidate titles, from the shortest to the most specific. The first that is unique in the catalogue and fits is used.
 * A twin (the same swap priced in another market) always says whose prices it has, so the two never share a title.
 */
function swapTitleCandidates(p: SwapTitleInput, lang: Lang = "en"): string[] {
  const t = getT(lang);
  const vs = t("seo.vs", p.brand.brand, p.alternative.brand);
  const what = lang === "en" ? (activesPhrase(p) ?? kindPhrase(p.subcategory)) : (activesPhraseDe(p) ?? subcategoryName(p.subcategory, lang));
  const tail = t("seo.cheaper", Math.round(p.savingsPct));
  const prices = t("seo.marketPrices", p.market);
  const market = p.twin ? ` (${prices})` : "";
  const brandProduct = productPhrase(p.brand.brand, p.brand.product);
  const altProduct = productPhrase(p.alternative.brand, p.alternative.product);
  const named = t("seo.vs", `${p.brand.brand} ${brandProduct}`, p.alternative.brand);
  const variant = p.brand.product.split(/,\s/)[1]?.trim();
  return [
    `${vs} ${what}: ${tail}${market}`,
    `${vs}: ${tail}${market}`,
    `${named}: ${tail}${market}`,
    `${named}${market}`,
    `${named} (${prices})`,
    `${named} ${altProduct} (${prices})`,
    // Products that differ only after the first comma, such as weight bands: "23-44 lbs".
    ...(variant ? [`${vs}, ${variant}: ${tail}${market}`, `${named}, ${variant} (${prices})`] : []),
    `${t("seo.vs", p.brand.product, p.alternative.product)} (${prices})`,
  ];
}

/**
 * One title per swap, unique across the catalogue. Each swap takes its first candidate that fits in TITLE_MAX and no
 * other swap wants; where none fits, the shortest one no other swap wants.
 */
export function swapTitles(pairs: readonly SwapTitleInput[], lang: Lang = "en"): Map<string, string> {
  const options = pairs.map((p) => ({ slug: p.slug, list: swapTitleCandidates(p, lang) }));
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
export function swapDescription(
  p: Pick<Pair, "match_type" | "brand" | "alternative" | "savingsPct" | "market" | "price_checked" | "de">,
  lang: Lang = "en",
  /** The brand's product name in place of the brand's, where the brand alone would read like another swap. */
  brandName?: string,
) {
  const t = getT(lang);
  const a = p.alternative.brand;
  const b = brandName ?? p.brand.brand;
  const actives = p.match_type === "identical_active" ? (lang === "en" ? activesPhrase(p, 3) : activesPhraseDe({ ...p, slug: "", subcategory: "", twin: null }, 3)) : null;
  const { label } = unitDisplay(p.brand.unit);
  const per = label === "each" ? "" : unitLabel(p.brand.unit, lang);
  const pct = Math.round(p.savingsPct);
  const month = lang === "en" ? shortMonth(p.price_checked) : shortDateDe(p.price_checked, "month");
  const price = t("seo.costsLess", pct, per, p.market, month);
  const claim = lang === "en" ? matchClaim(p.match_type, a, b) : `${a} ${t(`swap.verdict.${p.match_type}`, b)}`;
  const lead = p.match_type === "same_kind" ? [t("seo.sameKindLead", claim, pct, per, p.market)] : [t("seo.lead", claim, actives ?? "", price)];
  const question = t("seo.question", a, b);
  const withQuestion = [question, ...lead].join(" ");
  const first = withQuestion.length <= DESCRIPTION_MAX ? [withQuestion] : lead;
  return fitSentences([...first, t("seo.more")]);
}

/**
 * Descriptions in German, unique across the catalogue: where two swaps would read the same (two Persil gels against one
 * own label), each names the brand's product instead of the brand alone. English keeps swapDescription as it was.
 */
export function swapDescriptionsDe(pairs: readonly Pair[]): Map<string, string> {
  // Each step names the brand's product more fully, for the swaps the step before left sharing a description.
  const steps: ((p: Pair) => string | undefined)[] = [
    () => undefined,
    (p) => p.brand.product.split(/,\s/)[0],
    (p) => p.brand.product.replace(/,\s[^,]*$/, ""),
  ];
  const out = new Map<string, string>();
  let left = [...pairs];
  for (const [i, step] of steps.entries()) {
    const d = new Map(left.map((p) => [p.slug, swapDescription(p, "de", step(p))]));
    const count = new Map<string, number>();
    for (const x of d.values()) count.set(x, (count.get(x) ?? 0) + 1);
    const last = i === steps.length - 1;
    for (const p of left) if (last || count.get(d.get(p.slug)!) === 1) out.set(p.slug, d.get(p.slug)!);
    left = left.filter((p) => !out.has(p.slug));
  }
  return out;
}

/* ----------------------------------------------- canonical, noindex, hreflang, x-default */

/**
 * The language half is the page's language (German under /de/, English everywhere else), the region says whose shelf
 * prices it has. See docs/country-urls.md.
 */
export function hreflangFor(country: string, section = "") {
  return `${langForPage(country, section)}-${country}`;
}

/**
 * Every indexable URL of one page: one per country that lists it, under that country's prefix, and the x-default.
 *
 * The rule, the same for every page type (docs/country-urls.md):
 * - A country's view is indexable when that country lists the page, i.e. `localFor(country).shows(record)`: the
 *   record's own market always, and another country only where its sellers sell there. A view a country doesn't list
 *   (/de/compare/<a US swap>) is `noindex, follow` with no canonical: a German shopper can open and share it, but it is
 *   a converted copy, and its links still lead somewhere.
 * - A record (swap, kit, basket): its twin's views join its own, since the twin is the same swap in another market, and
 *   a country lists at most one of the two. The x-default is the own-market URL of the record a visitor we can't place
 *   gets (see TWIN_ORDER in localize.ts). The unprefixed URL shows that visitor exactly the record's own view, so it
 *   canonicalises to the record's own-market URL and stays out of the sitemap.
 * - A hub (home, aisle, biggest savings, bundles): the unprefixed URL lists one record of every swap for a visitor we
 *   can't place, a page no country URL repeats, so it is the x-default and indexable itself.
 * Every indexable URL has a self canonical and names all the others, so hreflang is reciprocal by construction.
 */
export type Versions = {
  /** hreflang ("en-GB") to path ("/uk/compare/x"). */
  languages: Record<string, string>;
  xDefault: string;
};

type ListedRecord = Listed & { slug: string };

/** The countries with a prefix whose shoppers get this record in their lists. Its own market is always one. */
export function listedIn(record: Listed): PrefixedCountry[] {
  return PREFIXED_COUNTRIES.filter((c) => localFor(c).shows(record));
}

/** A record page's versions, with its twin's (pass the twin's own record, or null). */
export function recordVersions(section: "compare" | "bundle" | "basket", record: ListedRecord, twin: ListedRecord | null = null): Versions {
  const group = twin ? [record, twin] : [record];
  const languages: Record<string, string> = {};
  for (const c of PREFIXED_COUNTRIES) {
    const shown = group.find((r) => localFor(c).shows(r));
    if (shown) languages[hreflangFor(c, section)] = withCountry(`/${section}/${shown.slug}`, c);
  }
  const preferred = oneOfEachSwap(group)[0] ?? record;
  return { languages, xDefault: withCountry(`/${section}/${preferred.slug}`, preferred.market) };
}

/** A hub's versions: every country in `countries` (the ones whose view lists anything) and the unprefixed page. */
export function hubVersions(path: string, countries: readonly string[] = PREFIXED_COUNTRIES): Versions {
  const languages: Record<string, string> = {};
  for (const c of PREFIXED_COUNTRIES) if (countries.includes(c)) languages[hreflangFor(c)] = withCountry(path, c);
  return { languages, xDefault: path };
}

/** The indexable URLs among a page's versions. */
export function indexableUrls(v: Versions): string[] {
  return [...new Set([...Object.values(v.languages), v.xDefault])];
}

/** All of a page's alternates, as the head and the sitemap give them: each country's, then x-default. */
export function alternateLanguages(v: Versions): Record<string, string> {
  return { ...v.languages, "x-default": v.xDefault };
}

export type HeadRules = {
  canonical: string | null;
  languages: Record<string, string> | null;
  index: boolean;
};

/**
 * What the head says for one URL (`self`, public, e.g. "/de/compare/x") of a page with these versions. `ownView` is set
 * for a record's unprefixed URL: the URL whose content it repeats, which becomes its canonical.
 */
export function headRules(v: Versions, self: string, ownView?: string): HeadRules {
  if (indexableUrls(v).includes(self)) return { canonical: self, languages: alternateLanguages(v), index: true };
  if (ownView && !countryOfPath(self)) return { canonical: ownView, languages: null, index: true };
  return { canonical: null, languages: null, index: false };
}

/** headRules as Next metadata. `alternates` is always set, so the layout's canonical ("/") never leaks onto a page. */
export function headMetadata(rules: HeadRules) {
  return {
    alternates: {
      ...(rules.canonical ? { canonical: rules.canonical } : {}),
      ...(rules.languages ? { languages: rules.languages } : {}),
    },
    ...(rules.index ? {} : { robots: { index: false, follow: true } }),
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
export function categoryDescription(name: string, description: string, count: number, lang: Lang = "en") {
  const lead = count ? [getT(lang)("lists.category.metaLead", name, count)] : [];
  return fitSentences([...lead, ...splitSentences(description)]);
}

export function categoryTitle(name: string, count: number, lang: Lang = "en") {
  return getT(lang)("lists.category.metaTitle", name, count);
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
