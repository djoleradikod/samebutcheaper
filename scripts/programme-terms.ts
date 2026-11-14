/**
 * The catalogue build's pass for affiliate programme terms (src/lib/programme-terms.ts). It runs after every figure is
 * worked out from the real prices, and changes only what a programme's terms bar from being shown:
 *  - a side whose price is withheld is recorded in `withheld` (pairs and kits) and the record's score drops to 0, so it
 *    never leads a list ranked by saving; a basket records which of its lines are withheld;
 *  - a side whose store bars price history keeps no history;
 *  - a side whose store allows only its own images loses our photo, and a photo no record shows any more leaves the
 *    credits page.
 * A link to a path the store's terms bar (its pharmacy) fails the build.
 */
import { barredPath, historyBarred, photoBarred, priceWithheld, rulesFor, termsOff, type Withheld } from "../src/lib/programme-terms";
import type { Bundle, Catalog, Pair, Preset } from "../src/lib/types";

type Parts = { pairs: Pair[]; bundles: Bundle[]; presets: Preset[]; credits: Catalog["credits"] };

/** A price in prose: "$5.97", "£4", "GBP 4.75", "74.6 cents", "1.4p". */
const PRICE = /[$£€]\s?\d|\b(?:USD|GBP|EUR|CAD)\s?\d|\d\s?(?:cents?|p)\b/;

/**
 * Prose without the sentences that quote a price. A withheld record's text can name the price we saw ("Hershey's 8 oz
 * at $5.97 at Walmart"), which is the price the store's terms withhold. Such a sentence keeps only the clauses before
 * its first price, or goes; the rest of the text stays. Empty text becomes `fallback`.
 */
export function withoutPrices(text: string, fallback = "") {
  if (!PRICE.test(text)) return text;
  const kept = text
    .split(/(?<=[.!?])\s+(?=["“(]?[A-Z0-9])/)
    .map((sentence) => {
      if (!PRICE.test(sentence)) return sentence;
      // "Same 0.454% stannous fluoride, and four tubes cost $16.43" keeps its first half.
      const clauses = sentence.replace(/[.!?]$/, "").split(/(?:;\s+|,\s+(?:and|but|while|so|which)\s+|\s+—\s+)/);
      const first = clauses.findIndex((c) => PRICE.test(c));
      return first > 0 ? `${sentence.slice(0, sentence.indexOf(clauses[first - 1]) + clauses[first - 1].length).replace(/[,;:]$/, "")}.` : "";
    })
    .filter(Boolean)
    .join(" ");
  return kept || fallback;
}

/** In place of evidence that was nothing but the prices we saw. */
const PRICES_LEFT_OUT = "We compared the two listings' pack sizes and prices. The store's affiliate terms let us show only prices it supplies, so they are left out here.";

export function applyProgrammeTerms(parts: Parts, buildDay: string, off = termsOff()) {
  const errors: string[] = [];
  const counts = { pairs: 0, bundles: 0, presets: 0, photos: 0, histories: 0 };

  for (const p of parts.pairs) {
    const withheld: NonNullable<Pair["withheld"]> = {};
    for (const side of ["brand", "alternative"] as const) {
      const s = p[side];
      if (barredPath(s, p.market, off)) errors.push(`${p.slug} ${side}: links a page the store's affiliate terms bar (${s.url})`);
      const w = priceWithheld(s, p.prices[side], p.market, buildDay, off);
      if (w) withheld[side] = w;
      if (historyBarred(s, p.market, off) && p.prices[side].history.length) {
        p.prices[side] = { ...p.prices[side], history: [] };
        counts.histories++;
      }
      if (photoBarred(s, p.market, off) && s.photo) {
        s.photo = null;
        counts.photos++;
      }
    }
    // A bigger pack has no price log of its own, so a store whose terms limit prices never has its bigger pack shown.
    const big = p.bulkView.bigger;
    if (big && rulesFor({ retailer: big.retailer, url: big.url }, p.market, off)?.prices) p.bulkView = { breakEvenUnits: p.bulkView.breakEvenUnits };
    if (Object.keys(withheld).length) {
      p.withheld = withheld;
      // A saving we may not show is not kept to be ranked, averaged or quoted anywhere: every list, title and "up to"
      // figure reads 0 and leaves it out, and pages show "see the price at <store>" instead (src/lib/withheld.ts).
      p.score = 0;
      p.savingsPct = 0;
      p.savingsPerPack = 0;
      p.evidence = withoutPrices(p.evidence, PRICES_LEFT_OUT);
      if (p.why) p.why = withoutPrices(p.why);
      if (p.differences) p.differences = withoutPrices(p.differences);
      p.evidence_claims = p.evidence_claims?.map((c) => ({ ...c, finding: withoutPrices(c.finding), ...(c.caveat ? { caveat: withoutPrices(c.caveat) } : {}) })).filter((c) => c.finding);
      counts.pairs++;
    }
  }

  for (const b of parts.bundles) {
    const withheld: Record<string, Withheld> = {};
    const pieces: [string, (typeof b.components)[number] | Bundle["bundle"]][] = [["kit", b.bundle], ...b.components.map((c): [string, typeof c] => [`item-${c.replaces}`, c])];
    for (const [key, piece] of pieces) {
      if (barredPath(piece, b.market, off)) errors.push(`${b.slug} ${key}: links a page the store's affiliate terms bar (${piece.url})`);
      const seen = b.prices[key];
      if (!seen) continue;
      const w = priceWithheld(piece, seen, b.market, buildDay, off);
      if (w) withheld[key] = w;
      if (historyBarred(piece, b.market, off) && seen.history.length) {
        b.prices[key] = { ...seen, history: [] };
        counts.histories++;
      }
    }
    for (const c of b.components) {
      if (photoBarred(c, b.market, off) && c.photo) {
        c.photo = null;
        counts.photos++;
      }
    }
    if (photoBarred(b.bundle, b.market, off) && b.photo) {
      b.photo = null;
      counts.photos++;
    }
    if (Object.keys(withheld).length) {
      b.withheld = withheld;
      b.score = 0;
      b.savingsPct = 0;
      b.savings = 0;
      b.netSavings = 0;
      b.netSavingsPct = 0;
      b.evidence = withoutPrices(b.evidence, PRICES_LEFT_OUT);
      b.summary = withoutPrices(b.summary, "The same items, bought separately.");
      if (b.differences) b.differences = withoutPrices(b.differences);
      counts.bundles++;
    }
  }

  const bySlug = new Map(parts.pairs.map((p) => [p.slug, p]));
  for (const preset of parts.presets) {
    const lines = preset.lines.map((l) => bySlug.get(l.pair)!);
    const withheld = lines.filter((p) => p.withheld).map((p) => p.slug);
    // Photos follow their swap's, so a basket never shows one its swap may not.
    preset.lines.forEach((l, i) => {
      l.brandPhoto = lines[i].brand.photo?.src ?? null;
      l.altPhoto = lines[i].alternative.photo?.src ?? null;
    });
    preset.photos = preset.lines.map((l) => l.altPhoto).filter((x): x is string => !!x).slice(0, 4);
    preset.photoShare = Math.round((preset.lines.filter((l) => l.altPhoto || l.brandPhoto).length / preset.lines.length) * 100) / 100;
    if (withheld.length) {
      preset.withheld = withheld;
      preset.score = 0;
      preset.savings = 0;
      preset.savingsPct = 0;
      counts.presets++;
    }
  }

  // The credits page lists only photos a page still shows.
  const used = new Set<string>();
  for (const p of parts.pairs) for (const s of [p.brand, p.alternative]) if (s.photo) used.add(s.photo.src);
  for (const b of parts.bundles) {
    if (b.photo) used.add(b.photo.src);
    for (const c of b.components) if (c.photo) used.add(c.photo.src);
  }
  const kept = parts.credits.filter((c) => used.has(c.src));
  parts.credits.splice(0, parts.credits.length, ...kept);

  return { errors, counts };
}
