/**
 * The questions a shopper types about a swap ("is Equate the same as Claritin", "what's the difference", "how much
 * cheaper", "where can I buy it"), answered only from the record: its match type, the same-or-different table, its
 * differences text, its prices and its store. Pure, so the swap page, its JSON-LD and the tests read the same words.
 *
 * Two forms:
 * - Without a Local, the answers name no price and no store. That form is in the static HTML every country shares.
 * - With one, prices read in that shopper's currency and the store answer says what applies where they are.
 *   The record's own form is `swapFaq(pair, recordLocal())`: its market's currency and store, nothing converted.
 *   That is what a crawler sees, and what the FAQPage JSON-LD carries.
 */
import { storeName } from "./affiliate";
import { MATCH_TYPE_META } from "./categories";
import { comparison, sortDifferences, splitSentences, type CompareRow } from "./compare";
import { inSentence, monthYear } from "./format";
import { localFor, MARKET_ADJECTIVE, type Local } from "./localize";
import { countryInSentence, lookForQuery, pharmacyNote } from "./markets";
import { deliversTo } from "./sellers";
import { matchClaim } from "./seo";
import type { Pair } from "./types";
import { unitDisplay } from "./unit-format";

export type FaqItem = { q: string; a: string };

/** The record as it reads in its own market: own currency, own store. What a shopper we can't place sees. */
export function recordLocal(): Local {
  return localFor(null);
}

/** Another currency than the record's, used only to find which sentences hold a price. */
function otherCurrencyLocal(pair: Pair) {
  return localFor(pair.currency === "USD" ? "GB" : "US");
}

/** True when a sentence names an amount of money in the record's currency. */
export function hasPrice(text: string, pair: Pair) {
  return otherCurrencyLocal(pair).prose(text, pair.currency) !== text;
}

/** The stores the record was priced at, by name, unless the name is part of a product's brand (Anker sells Anker, Tesco sells Tesco Health). */
function recordStores(pair: Pair) {
  const brands = `${pair.brand.brand} ${pair.alternative.brand}`.toLowerCase();
  return [pair.alternative, pair.brand]
    .map((p) => storeName(p.retailer, p.url))
    .filter((name) => name.length > 2 && !brands.includes(name.toLowerCase()));
}

/** True when a sentence names one of the stores this record was priced at. */
export function namesStore(text: string, pair: Pair) {
  return recordStores(pair).some((name) => text.toLowerCase().includes(name.toLowerCase()));
}

/**
 * Sentences of written catalogue text, with prices in this shopper's currency, or, with no Local, without the ones
 * that name a price or the record's store: the static HTML is the same for every country.
 */
function sentencesFor(text: string, pair: Pair, local?: Local) {
  const list = splitSentences(text);
  return local ? list.map((s) => local.prose(s, pair.currency)) : list.filter((s) => !hasPrice(s, pair) && !namesStore(s, pair));
}

function listWords(words: string[]) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** The rows a page can say match: label rows and researched rows, never the pack or the price. */
function sameRows(rows: CompareRow[]) {
  return rows.filter((r) => r.verdict === "same" && r.kind !== "pack" && r.kind !== "price");
}

const rowName = (r: CompareRow) => (r.kind === "test" ? r.aspect : inSentence(r.aspect));

function sameAnswer(pair: Pair) {
  const { brand: b, alternative: a, match_type: type } = pair;
  const c = comparison(pair);
  const meta = MATCH_TYPE_META[type].description;
  const confidence =
    type === "same_kind"
      ? ""
      : pair.confidence === "high"
        ? " Both labels were confirmed from primary sources."
        : " The evidence is strong, but not every detail came from a primary source.";
  if (type === "same_kind") {
    return `We can't say they are. ${matchClaim(type, a.brand, b.brand)} (${inSentence(pair.subcategory)}), priced from real sources. ${MATCH_TYPE_META.same_kind.description.replace(/^The same kind of product, priced from real sources\. /, "")}`;
  }
  if (type === "identical_active") {
    const actives = c.ingredients.filter((r) => r.verdict === "same").map((r) => `${inSentence(r.aspect)}${r.alternative && /\d/.test(r.alternative) ? ` ${r.alternative}` : ""}`);
    const inactive = c.rows.find((r) => r.kind === "inactive_check")
      ? " Inactive ingredients can differ, so read the label if you have allergies."
      : c.rows.some((r) => r.kind === "formula" && r.verdict === "same")
        ? " The labels list the same inactive ingredients too."
        : "";
    return `${matchClaim(type, a.brand, b.brand)}${actives.length ? `: ${listWords(actives)}` : ""}. ${meta}${inactive}${confidence}`;
  }
  if (type === "equivalent_spec") {
    const same = sameRows([...c.ingredients, ...c.rows])
      .map(rowName)
      .filter((name) => !namesStore(name, pair) && !hasPrice(name, pair));
    const on = same.length ? ` They match on ${listWords(same.slice(0, 5))}${same.length > 5 ? ` and ${same.length - 5} more points` : ""}.` : "";
    return `Not the same product, but ${matchClaim(type, a.brand, b.brand)}. ${meta}${on}${confidence}`;
  }
  return `${matchClaim(type, a.brand, b.brand)}. ${meta}${confidence}`;
}

function differentAnswer(pair: Pair, local?: Local) {
  const { brand: b, alternative: a } = pair;
  const c = comparison(pair);
  const wins = [...c.ingredients, ...c.rows]
    .filter((r) => r.verdict === "brand_better")
    .map(rowName)
    .filter((name) => local || !namesStore(name, pair));
  const points = sentencesFor(sortDifferences(pair.differences).points.join(" "), pair, local);
  const parts = [
    ...(wins.length ? [`${b.brand} wins on ${listWords(wins)}.`] : []),
    ...points,
  ];
  if (!parts.length) {
    return local || !pair.differences.trim()
      ? `Our records show no difference between ${a.brand} and ${b.brand} beyond the pack and the price.`
      : `The differences on file are on this page, with the prices in your currency.`;
  }
  return parts.join(" ");
}

function cheaperAnswer(pair: Pair, local?: Local) {
  const { brand: b, alternative: a, currency } = pair;
  const { label } = unitDisplay(b.unit);
  const per = label === "each" ? "" : ` ${label}`;
  const pct = `${Math.round(pair.savingsPct)}%`;
  const when = `at the ${MARKET_ADJECTIVE[pair.market]} prices we checked in ${monthYear(pair.price_checked)}`;
  const old = pair.priceOld ? " Those prices are over a year old, so check before you buy." : "";
  if (!local) return `${a.brand} costs ${pct} less${per} than ${b.brand}, ${when}.${old}`;
  const at = label === "each" ? "" : ` ${label}`;
  return `${a.brand} costs ${local.unit(a.ppu, b.unit, currency)}${at} against ${local.unit(b.ppu, b.unit, currency)} for ${b.brand}, ${pct} less, ${when}.${old}`;
}

function buyAnswer(pair: Pair, local?: Local) {
  const { alternative: a, market } = pair;
  const month = monthYear(pair.price_checked);
  const where = MARKET_ADJECTIVE[market];
  const section = `"Buying where you live" on this page lists stores to search where you are.`;
  if (!local) return `We checked the price at a ${where} store in ${month}. ${section}`;
  if (local.sells(a.retailer, market)) {
    const maybe = local.known && local.country !== market && deliversTo(a.retailer, market, local.country) === "maybe";
    const store = storeName(a.retailer, a.url);
    return `We checked the price at ${store} in ${month}.${maybe ? ` ${store} may ship it to ${countryInSentence(local.country)}, so check at checkout.` : ""} Prices change, so check at the store before you buy.`;
  }
  const query = lookForQuery(pair.lookFor, local.country);
  const pharmacy = pair.category === "otc-medicine" ? pharmacyNote(local.country) : null;
  return `We checked the price at a ${where} store that doesn't deliver to ${countryInSentence(local.country)}. Look for "${query}" at stores there.${pharmacy ? ` ${pharmacy}` : ""} ${section}`;
}

/** The questions, in the order a doubtful shopper asks them. */
export function swapFaq(pair: Pair, local?: Local): FaqItem[] {
  const { brand: b, alternative: a } = pair;
  return [
    { q: `Is ${a.brand} the same as ${b.brand}?`, a: sameAnswer(pair) },
    { q: `What is different about ${a.brand}?`, a: differentAnswer(pair, local) },
    { q: `How much cheaper is ${a.brand} than ${b.brand}?`, a: cheaperAnswer(pair, local) },
    { q: `Where can I buy ${a.brand}?`, a: buyAnswer(pair, local) },
  ];
}

/** FAQPage JSON-LD from the same items the page shows. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
