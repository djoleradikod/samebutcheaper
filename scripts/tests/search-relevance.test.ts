/**
 * Search relevance against the real catalogue (src/lib/search-rank.ts, src/lib/search-index.ts): what a shopper in the
 * US, the UK and Germany gets first for brand, product, ingredient and aisle searches, in English and German, and that
 * nothing unrelated is passed off as a hit.
 *
 *   npm run catalog && npx tsx --test scripts/tests/search-relevance.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { CATEGORIES } from "../../src/lib/categories";
import { categories as germanAisles } from "../../src/lib/i18n/de/site";
import { subcategoryName } from "../../src/lib/i18n/record";
import { forCountry, localFor } from "../../src/lib/localize";
import { ingredientNames, searchBundles, searchPairs, type AisleNames } from "../../src/lib/search-index";
import { distance, fold, queryWords, tokens, type Tier } from "../../src/lib/search-rank";
import type { Catalog, Pair } from "../../src/lib/types";

const { pairs, bundles: catalogBundles } = catalog as unknown as Catalog;

/** The aisle names as the index route builds them: English, then German. */
const AISLES: AisleNames = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, `${c.name}\n${(germanAisles as Record<string, { name: string }>)[c.slug].name}`]),
);

/** A swap as the search index carries it (src/app/search/index.json/route.ts), keeping the record for checks. */
function item(p: Pair) {
  return {
    slug: p.slug,
    market: p.market,
    title: p.title,
    category: p.category,
    subcategory: p.subcategory,
    brandName: p.brand.brand,
    brandProduct: p.brand.product,
    altName: p.alternative.brand,
    altProduct: p.alternative.product,
    ing: ingredientNames(p),
    de: { subcategory: subcategoryName(p.subcategory, "de") },
    record: p,
  };
}

const engines = new Map<string, { search: ReturnType<typeof searchPairs<ReturnType<typeof item>>>; listed: ReturnType<typeof item>[] }>();
function engineFor(country: string) {
  let e = engines.get(country);
  if (!e) {
    const listed = forCountry(pairs, localFor(country)).map(item);
    engines.set(country, (e = { search: searchPairs(listed, AISLES), listed }));
  }
  return e;
}
const find = (country: string, q: string) => engineFor(country).search.search(q);

/**
 * What a search should lead with: this swap among the best-ranked hits (ties keep the catalogue's own order, which new
 * records can change), at this tier: 0 brand, 1 product name, 2 ingredient, 3 aisle or shelf.
 */
type Case = [country: string, query: string, top: string, tier: Tier];

const CASES: Case[] = [
  // Germany: brands, products, ingredients and shelves, in German, with and without umlauts.
  ["DE", "nurofen", "nurofen-vs-ibu-ratiopharm-400mg-de", 0],
  ["DE", "Nurofen", "nurofen-vs-ibu-ratiopharm-400mg-de", 0],
  ["DE", "nurofen saft", "nurofen-junior-40mg-ml-vs-ibuprofen-stada-40mg-ml-saft-de", 1],
  ["DE", "ibuprofensaft", "nurofen-junior-40mg-ml-vs-ibuprofen-stada-40mg-ml-saft-de", 1],
  ["DE", "ibuprofen", "nurofen-vs-ibu-ratiopharm-400mg-de", 1],
  ["DE", "cetirizin", "zyrtec-vs-cetirizin-adgc-10mg-de", 1],
  ["DE", "zyrtec", "zyrtec-vs-cetirizin-adgc-10mg-de", 0],
  ["DE", "aspirin", "aspirin-vs-ass-500-1a-pharma-de", 0],
  ["DE", "ass", "aspirin-vs-ass-500-1a-pharma-de", 1],
  ["DE", "paracetamol", "ben-u-ron-vs-paracetamol-adgc-500mg-de", 1],
  ["DE", "ben-u-ron", "ben-u-ron-vs-paracetamol-adgc-500mg-de", 0],
  ["DE", "voltaren", "voltaren-forte-vs-diclox-forte-gel-de", 0],
  ["DE", "diclofenac", "voltaren-forte-vs-diclox-forte-gel-de", 2],
  ["DE", "schmerzmittel", "aspirin-vs-ass-500-1a-pharma-de", 3],
  ["DE", "nasenspray", "otriven-vs-nasenspray-sine-al-0-1-de", 1],
  ["DE", "zäpfchen", "dulcolax-zaepfchen-vs-pyrilax-10mg-de", 1],
  ["DE", "zaepfchen", "dulcolax-zaepfchen-vs-pyrilax-10mg-de", 1],
  ["DE", "allergie", "zyrtec-vs-cetirizin-adgc-10mg-de", 3],
  ["DE", "persil", "persil-universal-kraft-gel-vs-jeden-tag-vollwaschmittel-fluessig-de", 0],
  ["DE", "nutella", "nutella-vs-ja-nuss-nougat-creme-de", 0],
  ["DE", "olivenöl", "bertolli-natives-olivenoel-extra-vs-bellasan-natives-olivenoel-extra-de", 1],
  ["DE", "olivenoel", "bertolli-natives-olivenoel-extra-vs-bellasan-natives-olivenoel-extra-de", 1],
  ["DE", "spülmittel", "pril-original-limette-vs-penny-blik-zitrone-de", 1],
  ["DE", "spuelmittel", "frosch-spuelmittel-limone-vs-shine-washing-up-liquid-concentrated-de", 1],
  // The US.
  ["US", "claritin", "claritin-vs-equate-loratadine-10mg", 0],
  ["US", "loratadine", "claritin-vs-equate-loratadine-10mg", 1],
  ["US", "allegra", "allegra-vs-equate-fexofenadine-180mg", 0],
  ["US", "fexofenadine", "allegra-vs-members-mark-fexofenadine-180mg", 1],
  ["US", "zyrtec", "zyrtec-vs-equate-cetirizine-10mg", 0],
  ["US", "cetirizine", "zyrtec-vs-kirkland-aller-tec-cetirizine-10mg", 1],
  ["US", "tylenol", "tylenol-extra-strength-vs-equate-acetaminophen-500mg", 0],
  ["US", "acetaminophen", "tylenol-extra-strength-vs-equate-acetaminophen-500mg", 1],
  ["US", "paracetamol", "tylenol-extra-strength-vs-equate-acetaminophen-500mg", 2],
  ["US", "ibuprofen", "childrens-motrin-vs-equate-childrens-ibuprofen", 1],
  ["US", "benadryl", "benadryl-vs-equate-diphenhydramine-25mg", 0],
  ["US", "famotidine", "pepcid-ac-maximum-strength-vs-equate-famotidine-20mg", 1],
  ["US", "pepcid", "pepcid-ac-maximum-strength-vs-equate-famotidine-20mg", 0],
  ["US", "docusate", "colace-vs-equate-stool-softener-docusate-100mg", 1],
  ["US", "rogaine", "mens-rogaine-5-solution-vs-equate-minoxidil-5-solution", 0],
  ["US", "minoxidil", "womens-rogaine-2-solution-vs-equate-minoxidil-2-solution", 1],
  ["US", "dish soap", "dawn-liquid-dish-soap-vs-uline-liquid-dish-soap", 1],
  ["US", "almond butter", "justins-almond-butter-vs-kirkland-signature-creamy-almond-butter", 1],
  ["US", "trash bags", "glad-forceflex-vs-kirkland-flex-tech-13-gallon", 1],
  ["US", "aa batteries", "duracell-coppertop-aa-vs-kirkland-signature-aa", 1],
  // The UK.
  ["GB", "nurofen", "nurofen-vs-tesco-health-ibuprofen-200mg-gb", 0],
  ["GB", "nurofen for children", "nurofen-for-children-vs-tesco-health-ibuprofen-100mg-5ml-suspension-gb", 1],
  ["GB", "nurofen capsules", "nurofen-soft-capsules-vs-tesco-health-ibuprofen-liquid-capsules-200mg-gb", 1],
  ["GB", "ibuprofen", "nurofen-vs-tesco-health-ibuprofen-200mg-gb", 1],
  ["GB", "paracetamol", "panadol-advance-vs-tesco-health-paracetamol-500mg-gb", 1],
  ["GB", "panadol", "panadol-advance-vs-tesco-health-paracetamol-500mg-gb", 0],
  ["GB", "calpol", "calpol-infant-vs-tesco-health-paracetamol-120mg-5ml-suspension-gb", 0],
  ["GB", "cetirizine", "piriteze-vs-tesco-health-cetirizine-10mg-gb", 1],
  ["GB", "loperamide", "imodium-original-vs-tesco-health-loperamide-2mg-gb", 1],
  ["GB", "imodium", "imodium-original-vs-tesco-health-loperamide-2mg-gb", 0],
  ["GB", "gaviscon", "gaviscon-original-vs-tesco-health-heartburn-indigestion-liquid-gb", 0],
  ["GB", "lemsip", "lemsip-max-cold-flu-capsules-vs-tesco-max-strength-cold-flu-capsules-gb", 0],
  ["GB", "washing up liquid", "fairy-original-vs-asda-original-washing-up-liquid-gb", 1],
  ["GB", "ketchup", "heinz-tomato-ketchup-vs-waitrose-essential-ketchup-gb", 1],
  ["GB", "nappies", "pampers-baby-dry-size-4-vs-tesco-fred-and-flo-ultra-dry-size-4-gb", 1],
];

test(`${CASES.length} searches lead with the right swap at the right tier`, () => {
  assert.ok(CASES.length >= 40);
  const failures: string[] = [];
  for (const [country, q, top, tier] of CASES) {
    const { hits, didYouMean } = find(country, q);
    const head = hits[0];
    if (!head) {
      failures.push(`${country} "${q}": no hits`);
      continue;
    }
    // The best-ranked group: every hit as good as the first.
    const best = hits.filter((h) => h.tier === head.tier && h.quality === head.quality).map((h) => h.item.slug);
    if (didYouMean) failures.push(`${country} "${q}": corrected to "${didYouMean}"`);
    if (head.tier !== tier) failures.push(`${country} "${q}": first hit at tier ${head.tier}, want ${tier}`);
    if (!best.includes(top)) failures.push(`${country} "${q}": ${top} not among the best (${best.slice(0, 4).join(", ")})`);
  }
  assert.deepEqual(failures, []);
});

test("a brand search lists only that brand's swaps: no fuzzy filler passed off as hits", () => {
  const { hits } = find("DE", "nurofen");
  assert.ok(hits.length >= 2);
  for (const h of hits) assert.match(`${h.item.brandName} ${h.item.brandProduct}`, /nurofen/i, h.item.slug);
  for (const unrelated of ["vividrin", "otriven", "allergodil"]) assert.ok(!hits.some((h) => h.item.slug.startsWith(unrelated)), unrelated);
});

test("an ingredient search finds every listed swap with that ingredient, in English or German", () => {
  for (const [country, q, re] of [
    ["DE", "ibuprofen", /ibuprofen/i],
    ["GB", "ibuprofen", /ibuprofen/i],
    ["US", "ibuprofen", /ibuprofen/i],
    ["DE", "cetirizin", /^cetirizin/i],
    ["US", "cetirizine", /^cetirizine/i],
    ["GB", "paracetamol", /paracetamol/i],
  ] as const) {
    const found = new Set(find(country, q).hits.map((h) => h.item.slug));
    const want = engineFor(country).listed.filter((p) => p.ing.split("\n").some((n) => n.split(/[\s-]+/).some((w) => re.test(w))));
    assert.ok(want.length > 0, `${country} ${q}: nothing to find`);
    for (const p of want) assert.ok(found.has(p.slug), `${country} "${q}" misses ${p.slug}`);
  }
});

test("an ingredient never matches inside another ingredient", () => {
  const slugs = find("DE", "cetirizin").hits.map((h) => h.item.slug);
  assert.ok(!slugs.some((s) => s.includes("levocetirizin")), slugs.join(", "));
});

test("German shelves, compounds and umlaut spellings find the same swaps", () => {
  const same = (a: string, b: string) =>
    assert.deepEqual(
      find("DE", a).hits.map((h) => h.item.slug),
      find("DE", b).hits.map((h) => h.item.slug),
      `${a} / ${b}`,
    );
  same("zäpfchen", "zaepfchen");
  same("zäpfchen", "zapfchen");
  same("olivenöl", "olivenoel");
  same("Spülmittel", "SPUELMITTEL");
  const pain = find("DE", "schmerzmittel").hits;
  assert.ok(pain.length >= 5);
  // The shelf leads; a children's syrup whose name splits into "Schmerz" and "Mittel" may follow, all of them medicine.
  assert.equal(pain[0].item.de.subcategory, "Schmerzmittel");
  for (const h of pain) assert.ok(h.item.category === "otc-medicine" || h.item.category === "baby", h.item.slug);
  for (const h of pain.filter((h) => h.quality === 0)) assert.equal(h.item.de.subcategory, "Schmerzmittel", h.item.slug);
  // "spray" is the head of "Nasenspray", so it finds nasal sprays; "gel" is not hidden in "Geflügel".
  assert.ok(find("DE", "spray").hits.some((h) => /nasenspray/i.test(h.item.altProduct)));
  assert.ok(!find("DE", "gel").hits.some((h) => /gefl(ü|ue)gel/i.test(`${h.item.brandProduct} ${h.item.altProduct}`) && !/\bgel\b/i.test(h.item.title)));
});

test("short words and numbers match whole words only", () => {
  const slugs = find("US", "aa batteries").hits.map((h) => h.item.slug);
  assert.ok(slugs.length > 0);
  assert.ok(!slugs.some((s) => /-aaa-/.test(s)), slugs.join(", "));
});

test("a spelling slip is corrected only when nothing matches as typed, and says so", () => {
  const typo = find("DE", "nurofn");
  assert.equal(typo.didYouMean, "Nurofen");
  assert.ok(typo.hits.length > 0 && typo.hits.every((h) => /nurofen/i.test(h.item.brandName)));
  assert.equal(find("US", "zyrtek").didYouMean, "Zyrtec");
  assert.equal(find("DE", "nurofen").didYouMean, null);
  // Too far from anything: no guess.
  const none = find("GB", "qwertyuiop");
  assert.deepEqual([none.hits.length, none.didYouMean], [0, null]);
  // Under four letters, no guessing either.
  assert.equal(find("DE", "nrf").didYouMean, null);
});

test("kits are found by the brand's set and by their pieces", () => {
  const kits = searchBundles(catalogBundles);
  const advil = kits.search("advil").hits;
  assert.ok(advil.length > 0 && advil[0].tier === 0, "advil kit");
  assert.ok(advil.every((h) => /advil/i.test(h.item.bundle.brand)));
  assert.deepEqual(kits.search("qwertyuiop").hits, []);
});

test("folding and words", () => {
  assert.equal(fold("Zäpfchen"), fold("Zaepfchen"));
  assert.equal(fold("Straße"), "strasse");
  assert.deepEqual(tokens("Ibuprofen 400mg Filmtabletten"), ["ibuprofen", "400", "mg", "filmtabletten"]);
  assert.deepEqual(queryWords("Nurofen für Kinder"), ["nurofen", "kinder"]);
  assert.deepEqual(queryWords("the"), ["the"]);
  assert.equal(distance("nurofn", "nurofen", 2), 1);
  assert.equal(distance("zyrtek", "zyrtec", 1), 1);
  assert.equal(distance("abcdef", "badcfe", 2), 3);
});
