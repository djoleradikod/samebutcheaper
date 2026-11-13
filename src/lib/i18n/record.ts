/**
 * Which text a record shows on a page: its German text (data/i18n/de/, put on the record as `de` by the catalogue
 * build) on a German page, else its English.
 *
 * A record's German is used whole or not at all, so a page never mixes German and English sentences from one record.
 * It is also left out where the page converts the record's prices: conversion rewrites the English prices in place, and
 * German prose has no such rewrite. Today that is never the case, since German pages show euros and only euro records
 * have German.
 */
import glossary from "../../../data/i18n/de/glossary.json";
import type { Local } from "../localize";
import { MARKETS } from "../markets";
import type { ClaimDe, PairDe, ShelfLifeDe } from "../schema";
import type { Lang } from "./lang";

const SUBCATEGORIES: Record<string, string> = glossary.subcategories;

/** A subcategory's name in the page's language. One the glossary lacks keeps its English name. */
export function subcategoryName(name: string, lang: Lang) {
  return lang === "de" ? (SUBCATEGORIES[name] ?? name) : name;
}

/** Whether there's a German name for this subcategory. */
export function hasGermanSubcategory(name: string) {
  return name in SUBCATEGORIES;
}

/** The record's German text when this page shows it, else null. */
export function germanText(record: { de?: PairDe; currency: string }, local: Local): PairDe | null {
  if (local.lang !== "de" || !record.de) return null;
  return local.converts(record.currency as Parameters<Local["converts"]>[0]) ? null : record.de;
}

/** The language a record's text reads in on this page: "en" on a German page means it needs the "Auf Englisch" note. */
export function recordLang(record: { de?: PairDe; currency: string }, local: Local): Lang {
  return germanText(record, local) ? "de" : "en";
}

type ClaimText = { markets: string[]; title: string; finding: string; caveat: string; de?: ClaimDe };

/** A finding in the page's language. `lang` says which it came out in. */
export function claimText<T extends ClaimText>(claim: T, local: Local): T & { lang: Lang } {
  const currency = claim.markets.length === 1 ? MARKETS[claim.markets[0] as keyof typeof MARKETS]?.currency : undefined;
  const converts = currency ? local.converts(currency) : false;
  if (local.lang === "de" && claim.de && !converts) return { ...claim, ...claim.de, lang: "de" };
  return { ...claim, lang: "en" };
}

type ShelfText = { label: string; unopened: string; opened: string; storage: string; note: string; de?: ShelfLifeDe };

/** A shelf-life record in the page's language. It names no price, so German always fits. */
export function shelfText<T extends ShelfText>(shelf: T, lang: Lang): T & { lang: Lang } {
  if (lang === "de" && shelf.de) return { ...shelf, ...shelf.de, lang: "de" };
  return { ...shelf, lang: "en" };
}
