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
import { comparison, sortDifferences, splitSentences, type CompareRow } from "./compare";
import { inSentence, monthYear } from "./format";
import { localFor, type Local } from "./localize";
import { lookForQuery } from "./markets";
import { deliversTo } from "./sellers";
import { matchClaim } from "./seo";
import type { Pair } from "./types";
import { unitDisplay, unitLabel } from "./unit-format";
import { getT, type Lang } from "./i18n";
import { comparisonDe, differencesDe } from "./i18n/compare-de";
import { listWords as listWordsIn } from "./i18n/format";
import { germanText, subcategoryName } from "./i18n/record";

export type FaqItem = { q: string; a: string };

/** The record as it reads in its own market: own currency, own store. What a shopper we can't place sees. In German on a German page. */
export function recordLocal(lang: Lang = "en"): Local {
  return localFor(null, false, lang);
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

function listWords(words: string[], lang: Lang = "en") {
  return listWordsIn(words, lang);
}

/** The table this page shows: in German on a German page, with the record's German where it has some. */
function tableFor(pair: Pair, lang: Lang, local?: Local) {
  const c = comparison(pair);
  if (lang === "en") return c;
  return comparisonDe(c, pair, local ? germanText(pair, local) : null);
}

/** "Same claim" in the page's language: "Equate has the same active ingredient as Claritin". */
function claimIn(lang: Lang, type: Pair["match_type"], alt: string, brand: string) {
  return lang === "en" ? matchClaim(type, alt, brand) : `${alt} ${getT(lang)(`swap.verdict.${type}`, brand)}`;
}

/** The rows a page can say match: label rows and researched rows, never the pack or the price. */
function sameRows(rows: CompareRow[]) {
  return rows.filter((r) => r.verdict === "same" && r.kind !== "pack" && r.kind !== "price");
}

/** A row's name inside a sentence. German nouns keep their capitals. */
const rowName = (r: CompareRow, lang: Lang) => (r.kind === "test" || lang === "de" ? r.aspect : inSentence(r.aspect));

function sameAnswer(pair: Pair, lang: Lang, local?: Local) {
  const { brand: b, alternative: a, match_type: type } = pair;
  const t = getT(lang);
  const c = tableFor(pair, lang, local);
  const claim = claimIn(lang, type, a.brand, b.brand);
  const meta = t(`match.${type}.description`);
  const confidence = type === "same_kind" ? "" : pair.confidence === "high" ? t("faq.confidenceHigh") : t("faq.confidenceMedium");
  if (type === "same_kind") {
    return t("faq.sameKind", claim, lang === "en" ? inSentence(pair.subcategory) : subcategoryName(pair.subcategory, lang));
  }
  if (type === "identical_active") {
    const actives = c.ingredients
      .filter((r) => r.verdict === "same")
      .map((r) => `${lang === "en" ? inSentence(r.aspect) : r.aspect}${r.alternative && /\d/.test(r.alternative) ? ` ${r.alternative}` : ""}`);
    const inactive = c.rows.find((r) => r.kind === "inactive_check")
      ? t("faq.inactiveDiffer")
      : c.rows.some((r) => r.kind === "formula" && r.verdict === "same")
        ? t("faq.inactiveSame")
        : "";
    return `${t("faq.actives", claim, actives.length ? listWords(actives, lang) : "")} ${meta}${inactive}${confidence}`;
  }
  if (type === "equivalent_spec") {
    const same = sameRows([...c.ingredients, ...c.rows])
      .map((r) => rowName(r, lang))
      .filter((name) => !namesStore(name, pair) && !hasPrice(name, pair));
    const on = same.length ? t("faq.matchOn", listWords(same.slice(0, 5), lang), same.length > 5 ? same.length - 5 : 0) : "";
    return `${t("faq.notSame", claim)} ${meta}${on}${confidence}`;
  }
  return `${t("faq.claimSentence", claim)} ${meta}${confidence}`;
}

function differentAnswer(pair: Pair, lang: Lang, local?: Local) {
  const { brand: b, alternative: a } = pair;
  const t = getT(lang);
  const c = tableFor(pair, lang, local);
  const wins = [...c.ingredients, ...c.rows]
    .filter((r) => r.verdict === "brand_better")
    .map((r) => rowName(r, lang))
    .filter((name) => local || !namesStore(name, pair));
  const english = sentencesFor(sortDifferences(pair.differences).points.join(" "), pair, local);
  const points = lang === "en" ? english : differencesDe(english, pair, local ? germanText(pair, local) : null);
  const parts = [...(wins.length ? [t("faq.brandWinsOn", b.brand, listWords(wins, lang))] : []), ...points];
  if (!parts.length) {
    return local || !pair.differences.trim() ? t("faq.noDifference", a.brand, b.brand) : t("faq.differencesOnPage");
  }
  return parts.join(" ");
}

function cheaperAnswer(pair: Pair, lang: Lang, local?: Local) {
  const { brand: b, alternative: a, currency } = pair;
  const t = getT(lang);
  const { label } = unitDisplay(b.unit);
  const per = label === "each" ? "" : unitLabel(b.unit, lang);
  const pct = Math.round(pair.savingsPct);
  const when = t("faq.when", pair.market, monthYear(pair.price_checked, lang));
  const old = pair.priceOld && pair.freshness.tier === "stale" ? t("faq.old") : "";
  if (!local) return `${t("faq.cheaperPlain", a.brand, pct, per, b.brand, when)}${old}`;
  return `${t("faq.cheaperLocal", a.brand, local.unit(a.ppu, b.unit, currency), per, local.unit(b.ppu, b.unit, currency), b.brand, pct, when)}${old}`;
}

function buyAnswer(pair: Pair, lang: Lang, local?: Local) {
  const { alternative: a, market } = pair;
  const t = getT(lang);
  const month = monthYear(pair.price_checked, lang);
  const section = t("faq.section");
  if (!local) return `${t("faq.checkedAtA", market, month)} ${section}`;
  if (local.sells(a.retailer, market)) {
    const maybe = local.known && local.country !== market && deliversTo(a.retailer, market, local.country) === "maybe";
    const store = storeName(a.retailer, a.url);
    return `${t("faq.checkedAt", store, month)}${maybe ? t("faq.mayShip", store, local.country) : ""}${t("faq.pricesChange")}`;
  }
  const query = lookForQuery(pair.lookFor, local.country);
  const pharmacy = pair.category === "otc-medicine" ? t("faq.pharmacy", local.country) : null;
  return `${t("faq.noDelivery", market, local.country, query)}${pharmacy ? ` ${pharmacy}` : ""} ${section}`;
}

/** The questions, in the order a doubtful shopper asks them. The language is the Local's (English without one). */
export function swapFaq(pair: Pair, local?: Local): FaqItem[] {
  const { brand: b, alternative: a } = pair;
  const lang = local?.lang ?? "en";
  const t = getT(lang);
  return [
    { q: t("faq.q.same", a.brand, b.brand), a: sameAnswer(pair, lang, local) },
    { q: t("faq.q.different", a.brand), a: differentAnswer(pair, lang, local) },
    { q: t("faq.q.cheaper", a.brand, b.brand), a: cheaperAnswer(pair, lang, local) },
    { q: t("faq.q.buy", a.brand), a: buyAnswer(pair, lang, local) },
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
