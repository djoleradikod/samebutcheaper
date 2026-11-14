/**
 * Launch checks for affiliate programme terms (src/lib/programme-terms.ts, docs/research/R11-programme-terms.md), part
 * of src/lib/readiness.ts:
 *  - programme-terms-off: PROGRAMME_TERMS_OFF set, here or when the catalogue was built: a joined programme's rules
 *    are off, so pages may show what its terms bar. Warn.
 *  - daily-prices: a joined programme lets a shown price be at most N hours old, and no working daily refresh exists
 *    for it (no feed, or, on the running site, a build older than a day). Fail.
 *  - terms-conflicts: a joined programme's terms bar something the site still does (Walmart: "dupe" wording, while
 *    its swaps are listed under /dupe/ addresses). Warn; nothing is renamed by this.
 * Pure: the catalogue facts come in as `TermsBuild`.
 */
import type { Env } from "./affiliate-links";
import { dupeWordAllowed, feedLineStores, feedStores, joined, priceRuleOf } from "./programme-terms";
import { linkStoreName } from "./affiliate";
import { linkStore, PROGRAMME_REGISTRY } from "./programmes";
import type { Check } from "./readiness";
import type { Catalog, ProductSide } from "./types";

/** What the checks need from the catalogue the site was built with. */
export type TermsBuild = {
  generatedAt: string;
  /** PROGRAMME_TERMS_OFF as the catalogue was built with it. */
  termsOff: string | null;
  /** Stores some sides were priced from through their own programme's feed. */
  fedStores: string[];
  /** Per store: swaps with a side there whose programme bars "dupe" wording (each has a /dupe/ address). */
  dupeSwaps: Record<string, number>;
  /** True for the catalogue the running site serves (its age then says whether builds really come daily). */
  served: boolean;
};

const ALL_ON = new Set<string>();

export function termsBuildFacts(catalog: Pick<Catalog, "generatedAt" | "pairs" | "bundles" | "programmeTerms">, served: boolean): TermsBuild {
  const sides = [
    ...catalog.pairs.flatMap((p) => (["brand", "alternative"] as const).map((s) => ({ side: p[s], seen: p.prices[s] }))),
    ...catalog.bundles.flatMap((b) => [{ side: b.bundle, seen: b.prices.kit }, ...b.components.map((c) => ({ side: c, seen: b.prices[`item-${c.replaces}`] }))]),
  ];
  const dupeSwaps: Record<string, number> = {};
  for (const p of catalog.pairs) {
    for (const side of [p.brand, p.alternative]) {
      // Every swap is listed on its brand's /dupe/ page and links to it (src/lib/dupes.ts).
      if (dupeWordAllowed([side], p.market, ALL_ON)) continue;
      const store = linkStore({ retailer: side.retailer, url: side.url ?? null });
      dupeSwaps[store] = (dupeSwaps[store] ?? 0) + 1;
      break;
    }
  }
  return { generatedAt: catalog.generatedAt, termsOff: catalog.programmeTerms?.off ?? null, fedStores: [...feedStores(sides)].sort(), dupeSwaps, served };
}

/** A served build older than this means the daily deploy isn't happening. */
const DAILY_HOURS = 26;

export function termsChecks(env: Env, aff: Env, build: TermsBuild | undefined, now = Date.now()): Check[] {
  const checks: Check[] = [];
  const merged = { ...env, ...aff };
  const fed = new Set(build?.fedStores ?? []);
  const isJoined = (store: string) => joined(store, merged) || fed.has(store);
  const name = (store: string) => linkStoreName({ retailer: store as ProductSide["retailer"], url: store === "amazon" ? "https://www.amazon.com/" : `https://www.${store}.com/` });

  const off = [env.PROGRAMME_TERMS_OFF?.trim() ? `PROGRAMME_TERMS_OFF=${env.PROGRAMME_TERMS_OFF.trim()} here` : null, build?.termsOff ? `the catalogue was built with PROGRAMME_TERMS_OFF=${build.termsOff}` : null].filter(Boolean);
  checks.push({
    id: "programme-terms-off",
    label: "Affiliate programme rules switched off",
    level: "recommended",
    ok: off.length === 0,
    detail: off.length ? `${off.join("; ")}: a joined programme's rules (withheld prices, no price history, no photos) may be off` : "not set",
    fix: "PROGRAMME_TERMS_OFF is only for comparing builds. Remove it from .env and the AFFILIATE_ENV secret, and rebuild.",
  });

  // Stores whose programme lets a shown price be at most so many hours old.
  const timed = Object.keys(PROGRAMME_REGISTRY).filter((s) => priceRuleOf(s)?.maxAgeHours && isJoined(s));
  const feeds = new Set(feedLineStores(env.PRICE_FEED_URLS));
  const problems: string[] = [];
  const notes: string[] = [];
  for (const store of timed) {
    const rule = priceRuleOf(store)!;
    if (rule.only === "api") {
      notes.push(`${name(store)}: its prices come only from its own API, which we don't read yet, so they stay withheld`);
      continue;
    }
    if (!feeds.has(store) && !fed.has(store)) {
      problems.push(`${name(store)}: no feed is set up, so every ${name(store)} price stays withheld`);
      continue;
    }
    const age = build ? (now - Date.parse(build.generatedAt)) / 3_600_000 : 0;
    if (build?.served && age > DAILY_HOURS) problems.push(`${name(store)}: the running build is ${Math.floor(age)} hours old, so its prices have been withheld since its feed reading turned ${rule.maxAgeHours} hours old`);
    else if (build?.served && !fed.has(store)) problems.push(`${name(store)}: the running build has no price from its feed`);
    else notes.push(`${name(store)}: its feed is read before each build, and the deploy runs daily`);
  }
  checks.push({
    id: "daily-prices",
    label: "Daily price refresh",
    level: problems.length ? "blocker" : timed.length ? "recommended" : "optional",
    ok: problems.length === 0,
    detail: !timed.length ? "no joined programme limits how old a shown price may be" : [...problems, ...notes].join("; "),
    fix: "Add the programme's feed to the PRICE_FEED_URLS secret (docs/feeds.md). The deploy workflow then reads it and rebuilds every day (docs/prices-daily.md); check that the scheduled Deploy runs succeed. A price older than the programme allows is withheld by itself in the meantime.",
  });

  const conflicts: string[] = [];
  for (const [store, entry] of Object.entries(PROGRAMME_REGISTRY)) {
    if (!isJoined(store)) continue;
    const n = build?.dupeSwaps[store] ?? 0;
    if (entry.terms?.dupeWording === false && n > 0)
      conflicts.push(`${name(store)}'s terms bar "dupe" comparisons, and ${n} swap${n === 1 ? "" : "s"} with a ${name(store)} side ${n === 1 ? "is" : "are"} listed under /dupe/ addresses`);
  }
  checks.push({
    id: "terms-conflicts",
    label: "Joined programmes' terms against the site",
    level: "recommended",
    ok: conflicts.length === 0,
    detail: conflicts.length ? conflicts.join("; ") : "nothing found",
    fix: "docs/research/R11-programme-terms.md, \"Risks\", says what each conflict needs: rename the /dupe/ pages (with permanent redirects) or ask the programme in writing before relying on it.",
  });
  return checks;
}
