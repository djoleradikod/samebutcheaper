/**
 * The catalogue build's pass for affiliate programme terms (src/lib/programme-terms.ts). It runs after every figure is
 * worked out from the real prices, and changes only what a programme's terms bar from being shown:
 *  - a side whose price is withheld is recorded in `withheld` (pairs and kits) and the record's score drops to 0, so it
 *    never leads a list ranked by saving; a basket records which of its lines are withheld;
 *  - a side whose price shows only for a while (a feed price under a 24-hour rule) is recorded in `limited` with the
 *    moment it runs out, when the server withholds it the same way (src/lib/price-expiry.ts);
 *  - a side whose store bars price history keeps no history;
 *  - a side whose store allows only its own images loses our photo, and a photo no record shows any more leaves the
 *    credits page.
 * A link to a path the store's terms bar (its pharmacy) fails the build.
 */
import { buildEnv } from "../src/lib/affiliate-env-file";
import { linkStoreName } from "../src/lib/affiliate";
import { withholdBundle, withholdPair, withholdPreset, withoutStorePrices } from "../src/lib/price-expiry";
import { barredPath, feedStores, historyBarred, photoBarred, priceLimit, rulesFor, termsOff, type Limited, type Withheld } from "../src/lib/programme-terms";
import type { Bundle, Catalog, Pair, Preset } from "../src/lib/types";

export { withoutPrices } from "../src/lib/price-expiry";

type Parts = { pairs: Pair[]; bundles: Bundle[]; presets: Preset[]; credits: Catalog["credits"] };

/** Every side and kit piece with the price we saw, for `feedStores`. */
function sidesOf(parts: Parts) {
  return [
    ...parts.pairs.flatMap((p) => (["brand", "alternative"] as const).map((s) => ({ side: p[s], seen: p.prices[s] }))),
    ...parts.bundles.flatMap((b) => [{ side: b.bundle, seen: b.prices.kit }, ...b.components.map((c) => ({ side: c, seen: b.prices[`item-${c.replaces}`] }))]),
  ];
}

/**
 * `now` is the build's moment (an ISO time; a bare day means its start). A price a programme allows only for a while
 * is shown, with a `limited` entry saying until when (src/lib/price-expiry.ts withholds it then).
 */
export function applyProgrammeTerms(parts: Parts, now: string, off = termsOff(buildEnv(), feedStores(sidesOf(parts)))) {
  const errors: string[] = [];
  const counts = { pairs: 0, bundles: 0, presets: 0, photos: 0, histories: 0, limitedPairs: 0, limitedBundles: 0, quotes: 0 };

  for (const p of parts.pairs) {
    const withheld: NonNullable<Pair["withheld"]> = {};
    const limited: NonNullable<Pair["limited"]> = {};
    for (const side of ["brand", "alternative"] as const) {
      const s = p[side];
      if (barredPath(s, p.market, off)) errors.push(`${p.slug} ${side}: links a page the store's affiliate terms bar (${s.url})`);
      const r = priceLimit(s, p.prices[side], p.market, now, off);
      if (r && "withheld" in r) withheld[side] = r.withheld;
      if (r && "limited" in r) limited[side] = r.limited;
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
      withholdPair(p, withheld);
      counts.pairs++;
    } else if (Object.keys(limited).length) {
      // Shown for now, and withheld when the first of them runs out. A record with a side withheld already has no
      // saving left to lose, so it carries no limit.
      p.limited = limited;
      counts.limitedPairs++;
    }
  }

  for (const b of parts.bundles) {
    const withheld: Record<string, Withheld> = {};
    const limited: Record<string, Limited> = {};
    const pieces: [string, (typeof b.components)[number] | Bundle["bundle"]][] = [["kit", b.bundle], ...b.components.map((c): [string, typeof c] => [`item-${c.replaces}`, c])];
    for (const [key, piece] of pieces) {
      if (barredPath(piece, b.market, off)) errors.push(`${b.slug} ${key}: links a page the store's affiliate terms bar (${piece.url})`);
      const seen = b.prices[key];
      if (!seen) continue;
      const r = priceLimit(piece, seen, b.market, now, off);
      if (r && "withheld" in r) withheld[key] = r.withheld;
      if (r && "limited" in r) limited[key] = r.limited;
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
      withholdBundle(b, withheld);
      counts.bundles++;
    } else if (Object.keys(limited).length) {
      b.limited = limited;
      counts.limitedBundles++;
    }
  }

  // A record that keeps its own prices can still quote one at a store whose terms withhold prices in its market
  // ("Vital Farms was $6.67 at Walmart Supercenter"); that quote goes too. Prices the record quotes elsewhere stay.
  const ruled = new Map<string, Set<string>>();
  for (const { side, market } of [
    ...parts.pairs.flatMap((p) => [p.brand, p.alternative].map((side) => ({ side, market: p.market }))),
    ...parts.bundles.flatMap((b) => [b.bundle, ...b.components].map((side) => ({ side, market: b.market }))),
  ]) {
    if (rulesFor(side, market, off)?.prices) ruled.set(market, (ruled.get(market) ?? new Set()).add(linkStoreName(side as Parameters<typeof linkStoreName>[0])));
  }
  const scrub = (text: string, market: string, fallback = "") => {
    const out = withoutStorePrices(text, [...(ruled.get(market) ?? [])], fallback);
    if (out !== text) counts.quotes++;
    return out;
  };
  for (const p of parts.pairs) {
    if (p.withheld) continue;
    p.evidence = scrub(p.evidence, p.market, "We compared the two listings' pack sizes and prices.");
    if (p.why) p.why = scrub(p.why, p.market);
    if (p.differences) p.differences = scrub(p.differences, p.market);
    p.evidence_claims = p.evidence_claims
      ?.map((c) => ({ ...c, finding: scrub(c.finding, p.market), ...(c.caveat ? { caveat: scrub(c.caveat, p.market) } : {}) }))
      .filter((c) => c.finding);
  }
  for (const b of parts.bundles) {
    if (b.withheld) continue;
    b.evidence = scrub(b.evidence, b.market, "We compared the listings' pack sizes and prices.");
    b.summary = scrub(b.summary, b.market, "The same items, bought separately.");
    if (b.differences) b.differences = scrub(b.differences, b.market);
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
      withholdPreset(preset, withheld);
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
