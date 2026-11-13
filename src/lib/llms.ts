/**
 * /llms.txt (https://llmstxt.org): what the site is, how far its claims go and where its pages are, for AI assistants.
 * Pure: the route passes the catalogue numbers in, so every figure is the live one and the test checks the format.
 */
import { CATEGORIES, MATCH_TYPE_META } from "./categories";
import { MARKET_LABEL, type MarketCode } from "./markets";
import type { MatchType } from "./types";

export type LlmsInput = {
  name: string;
  url: string;
  swaps: number;
  kits: number;
  baskets: number;
  brands: number;
  ingredients: number;
  markets: MarketCode[];
  /** Aisles with at least one swap. */
  aisles: string[];
  linksEarn: boolean;
  examples: { swap?: string; dupe?: string; brand?: string; ingredient?: string; kit?: string; basket?: string };
};

const ORDER: MatchType[] = ["identical_active", "identical_formula", "same_manufacturer", "equivalent_spec", "same_kind"];

function words(list: string[]) {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list.join("");
}

export function llmsText(i: LlmsInput) {
  const u = (path: string) => `${i.url}${path}`;
  const link = (name: string, path: string | undefined, note: string) => (path ? [`- [${name}](${u(path)}): ${note}`] : []);
  const aisleNames = CATEGORIES.filter((c) => i.aisles.includes(c.slug));
  return [
    `# ${i.name}`,
    "",
    "> Cheaper products that do the same job as brand-name ones, compared per unit (per tablet, per 100 g, per wash). Each swap says how far its evidence goes, lists what differs and where the brand is better, and links to at least two sources.",
    "",
    `The catalogue has ${i.swaps} swaps (a swap priced in two countries counts once), ${i.kits} brand kits rebuilt from cheaper pieces and ${i.baskets} baskets of swaps for a life moment, across ${aisleNames.length} aisles. Prices were checked in ${words(i.markets.map((m) => MARKET_LABEL[m]))}. Each record keeps its own country's currency, store and the month its price was checked. Pages show a visitor's own country's prices first; a visitor whose country isn't known sees each record in its own currency.`,
    "",
    "Where the data comes from: product labels, ingredient lists and spec sheets, regulators' label databases, retailers' own product pages on a dated visit, shelf prices recorded in Open Prices (Open Food Facts, ODbL), and published independent tests. Savings are worked out per unit from those dated prices. Prices change, so quote them with their month and market.",
    "",
    "Each swap carries one match label. Quote it as it is, since the labels promise different things:",
    "",
    ...ORDER.map((t) => `- ${MATCH_TYPE_META[t].label}: ${MATCH_TYPE_META[t].description}`),
    "",
    `"Same kind of product" is not evidence that two products match. Medicine and supplement pages are not medical advice. No brand or store pays to be listed or ranked. ${i.linksEarn ? "Some links to stores are affiliate links." : "No link earns the site anything today."}`,
    "",
    "## Page types",
    "",
    ...link("Swap", i.examples.swap, "/compare/<slug>. One brand product beside a cheaper one: the match label, a same-or-different table, prices per unit with their date, what differs, questions and answers, sources."),
    ...link("Generic for, or cheaper alternative to, a brand product", i.examples.dupe, "/dupe/<slug>. Every cheaper match for one brand product, biggest saving first."),
    ...link("Brand", i.examples.brand, `/brand/<slug>. Every swap and kit for one brand (${i.brands} brands).`),
    ...link("Ingredient", i.examples.ingredient, `/ingredient/<slug>. Brand-name products with one active ingredient and the cheaper ones with the same (${i.ingredients} ingredients).`),
    ...link("Kit", i.examples.kit, "/bundle/<slug>. A brand's kit rebuilt from cheaper pieces, with delivery counted."),
    ...link("Basket", i.examples.basket, "/basket/<slug>. A shopping list of swaps, both totals for the same amount."),
    "",
    "## Main pages",
    "",
    `- [Biggest savings](${u("/biggest-savings")}): every swap, ranked by saving per unit`,
    `- [Brands](${u("/brands")}): A to Z`,
    `- [Ingredients](${u("/ingredients")}): A to Z`,
    `- [Kits and baskets](${u("/bundles")})`,
    `- [Buying in bulk](${u("/bulk")}): bigger packs and how long things keep`,
    `- [Why it's worth switching](${u("/why")}): cited findings, including where the cheap option lost`,
    `- [How we check every swap](${u("/how-we-verify")}): the standards behind each label and where prices come from`,
    `- [About](${u("/about")})`,
    `- [Disclosure](${u("/disclosure")})`,
    "",
    "## Optional",
    "",
    ...aisleNames.map((c) => `- [${c.name}](${u(`/category/${c.slug}`)}): ${c.description}`),
    `- [Sitemap](${u("/sitemap.xml")}): every page, dated by its newest price check`,
    `- [Atom feed](${u("/feed.xml")}): the most recently checked swaps and kits`,
    "",
  ].join("\n");
}
