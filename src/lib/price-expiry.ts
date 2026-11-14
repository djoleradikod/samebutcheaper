/**
 * Withholding a record's prices, once at build time and again whenever a time-limited price runs out.
 *
 * The catalogue build (scripts/programme-terms.ts) withholds every price a programme's terms bar on the day of the
 * build. A price a programme allows only for a while (Walmart and Amazon: refreshed within 24 hours) is shown, and
 * the side carries a `limited` entry saying until when. `expireCatalog` then withholds those sides once their time
 * has come, exactly as the build would have: no price, no saving, no score, no price sentences in the prose. The
 * server runs it from a timer (src/lib/server/price-clock.ts) and re-renders the pages, so a price never outlives its
 * programme's window on a page, even when the next deploy is late or fails.
 *
 * Pure: the build script, the server and tests share it.
 */
import type { Limited, Withheld } from "./programme-terms";
import type { Bundle, Catalog, Pair, Preset } from "./types";

/** A price in prose: "$5.97", "£4", "GBP 4.75", "74.6 cents", "85.1¢", "1.4p". */
const PRICE = /[$£€]\s?\d|\b(?:USD|GBP|EUR|CAD)\s?\d|\d\s?(?:cents?|p)\b|\d\s?¢/;

/** A saving in prose, which a withheld record's summary can't state either: "40% less", "half the price". */
const SAVING = /\d\s?%\s?(?:less|cheaper|lower|off|saving)|\bhalf the price\b/i;

/** Where a sentence may be cut: "; ", ", and ", " — ", but never inside brackets. */
const CLAUSE_BREAK = /;\s+|,\s+(?:and|but|while|so|which)\s+|\s+—\s+/g;
const depthAt = (s: string, i: number) => {
  let d = 0;
  for (const ch of s.slice(0, i)) d += ch === "(" || ch === "[" ? 1 : ch === ")" || ch === "]" ? -1 : 0;
  return d;
};
const balanced = (s: string) => depthAt(s, s.length) === 0;

/**
 * Prose without the sentences that quote a price. A withheld record's text can name the price we saw ("Hershey's 8 oz
 * at $5.97 at Walmart"), which is the price the store's terms withhold. Such a sentence keeps only the clauses before
 * its first price, or goes; the rest of the text stays. A cut never falls inside brackets, and a kept part whose
 * brackets don't close goes too. Empty text becomes `fallback`. `pattern` widens what counts (a saving, in summaries).
 */
export function withoutPrices(text: string, fallback = "", only: (sentence: string) => boolean = () => true, pattern: RegExp = PRICE) {
  if (!pattern.test(text)) return text;
  const kept = text
    .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
    .map((sentence) => {
      if (!pattern.test(sentence) || !only(sentence)) return sentence;
      // "Same 0.454% stannous fluoride, and four tubes cost $16.43" keeps its first half.
      const body = sentence.replace(/[.!?]$/, "");
      const cuts = [...body.matchAll(CLAUSE_BREAK)].filter((m) => depthAt(body, m.index) === 0);
      let end = -1;
      let from = 0;
      for (const m of cuts) {
        if (pattern.test(body.slice(from, m.index))) break;
        end = m.index;
        from = m.index + m[0].length;
      }
      if (end <= 0) return "";
      const head = body.slice(0, end).replace(/[,;:]$/, "");
      return balanced(head) ? `${head}.` : "";
    })
    .filter(Boolean)
    .join(" ");
  return kept || fallback;
}

/** A withheld record's summary: no price and no saving. */
const PRICE_OR_SAVING = new RegExp(`${PRICE.source}|${SAVING.source}`, "i");
export function withoutSavings(text: string, fallback = "") {
  return withoutPrices(text, fallback, () => true, PRICE_OR_SAVING);
}

/**
 * A record whose own prices may show can still quote, in passing, a price at a store whose terms withhold prices
 * ("Vital Farms was $6.67 at Walmart Supercenter"). Those sentences lose their price clauses the same way; every
 * other sentence, and the text's own prices, stay. `stores` are display names ("Walmart"); "Walmart.ca" is another
 * store and is not matched.
 */
export function withoutStorePrices(text: string, stores: readonly string[], fallback = "") {
  if (!stores.length) return text;
  const named = new RegExp(`\\b(?:${stores.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b(?!\\.[a-z])`, "i");
  return withoutPrices(text, fallback, (sentence) => named.test(sentence));
}

/** Whether a piece of prose quotes a price. */
export function quotesPrice(text: string) {
  return PRICE.test(text);
}

/** In place of evidence that was nothing but the prices we saw. */
export const PRICES_LEFT_OUT = "We compared the two listings' pack sizes and prices. The store's affiliate terms let us show only prices it supplies, so they are left out here.";

/** In place of a summary that was nothing but its price or saving. */
export const SUMMARY_LEFT_OUT = "What matches and what differs is below.";

/**
 * A swap with these sides withheld: the saving built on them is not kept to be ranked, averaged or quoted anywhere
 * (every list, title and "up to" figure reads 0 and leaves it out), and the prose loses its price sentences. Pages show
 * "see the price at <store>" instead (src/lib/withheld.ts). In place.
 */
export function withholdPair(p: Pair, withheld: NonNullable<Pair["withheld"]>) {
  p.withheld = { ...p.withheld, ...withheld };
  p.score = 0;
  p.savingsPct = 0;
  p.savingsPerPack = 0;
  p.evidence = withoutPrices(p.evidence, PRICES_LEFT_OUT);
  if (p.why) p.why = withoutPrices(p.why);
  if (p.differences) p.differences = withoutPrices(p.differences);
  p.summary = withoutSavings(p.summary, SUMMARY_LEFT_OUT);
  p.evidence_claims = p.evidence_claims
    ?.map((c) => ({ ...c, finding: withoutPrices(c.finding), ...(c.caveat ? { caveat: withoutPrices(c.caveat) } : {}) }))
    .filter((c) => c.finding);
}

/** The same for a kit. In place. */
export function withholdBundle(b: Bundle, withheld: Record<string, Withheld>) {
  b.withheld = { ...b.withheld, ...withheld };
  b.score = 0;
  b.savingsPct = 0;
  b.savings = 0;
  b.netSavings = 0;
  b.netSavingsPct = 0;
  b.evidence = withoutPrices(b.evidence, PRICES_LEFT_OUT);
  b.summary = withoutSavings(b.summary, "The same items, bought separately.");
  if (b.differences) b.differences = withoutPrices(b.differences);
}

/** A basket whose lines include withheld swaps shows no totals. In place. */
export function withholdPreset(preset: Preset, slugs: string[]) {
  preset.withheld = [...new Set([...(preset.withheld ?? []), ...slugs])];
  preset.score = 0;
  preset.savings = 0;
  preset.savingsPct = 0;
}

/**
 * A limited price is withheld this long before its programme's window closes, to cover the timer's granularity and
 * the time a page takes to re-render. A price read by the daily deploy shows for 23 of its 24 hours.
 */
export const EXPIRY_MARGIN_MS = 60 * 60_000;

const ends = (l: Limited) => Date.parse(l.until) - EXPIRY_MARGIN_MS;

/** Every moment, in milliseconds, at which some limited price in the catalogue must stop showing, earliest first. */
export function expiryMoments(catalog: Pick<Catalog, "pairs" | "bundles">): number[] {
  const out = new Set<number>();
  for (const r of [...catalog.pairs, ...catalog.bundles]) for (const l of Object.values(r.limited ?? {})) if (l) out.add(ends(l));
  return [...out].sort((a, b) => a - b);
}

/** The next moment after `now` at which a limited price must stop showing, or null when none is left. */
export function nextExpiry(catalog: Pick<Catalog, "pairs" | "bundles">, now: number): number | null {
  return expiryMoments(catalog).find((t) => t > now) ?? null;
}

const strip = <T extends Pair | Bundle>(r: T, keys: string[]): T => {
  const limited = { ...r.limited } as Record<string, Limited>;
  for (const k of keys) delete limited[k];
  const out = { ...r };
  if (Object.keys(limited).length) out.limited = limited as T["limited"];
  else delete out.limited;
  return out;
};

const asWithheld = (l: Limited): Withheld => ({ store: l.store, only: l.only, date: l.date, precision: l.precision });

/**
 * The catalogue as it must read at `now` (milliseconds): every limited price whose time has come (less the margin) is
 * withheld, and lists are re-ranked. Returns the same object when nothing has expired, so callers can cache by
 * identity; never changes the catalogue it is given.
 */
export function expireCatalog<C extends Pick<Catalog, "pairs" | "bundles" | "presets">>(catalog: C, now: number): C {
  if (!expiryMoments(catalog).some((t) => t <= now)) return catalog;
  const due = (r: Pair | Bundle) => Object.entries(r.limited ?? {}).filter(([, l]) => l && ends(l) <= now) as [string, Limited][];

  const pairs = catalog.pairs.map((p) => {
    const keys = due(p);
    if (!keys.length) return p;
    const copy = strip(structuredClone(p), keys.map(([k]) => k));
    withholdPair(copy, Object.fromEntries(keys.map(([k, l]) => [k, asWithheld(l)])));
    return copy;
  });
  const bundles = catalog.bundles.map((b) => {
    const keys = due(b);
    if (!keys.length) return b;
    const copy = strip(structuredClone(b), keys.map(([k]) => k));
    withholdBundle(copy, Object.fromEntries(keys.map(([k, l]) => [k, asWithheld(l)])));
    return copy;
  });
  const bySlug = new Map(pairs.map((p) => [p.slug, p]));
  const presets = catalog.presets.map((preset) => {
    const slugs = preset.lines.map((l) => l.pair).filter((slug) => bySlug.get(slug)?.withheld && !preset.withheld?.includes(slug));
    if (!slugs.length) return preset;
    const copy = structuredClone(preset);
    withholdPreset(copy, slugs);
    return copy;
  });
  // The same order the build gives: biggest score first (Array.prototype.sort is stable, so ties keep their order).
  const byScore = <T extends { score: number }>(xs: T[]) => [...xs].sort((a, b) => b.score - a.score);
  return { ...catalog, pairs: byScore(pairs), bundles: byScore(bundles), presets: byScore(presets) };
}
