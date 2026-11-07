/**
 * What each country lists, for the handover and the owner's choice on unrated products:
 * swaps by default and with the control on, how many of those are rated, baskets, kits and bulk rows.
 * Usage, after npm run catalog: npx tsx scripts/qa/country_counts.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { forCountry, localFor, type Listed } from "../../src/lib/localize";

type Row = Listed & { alternative: { rating: { label: string } | null }; bulkView: { bigger?: unknown }; category: string };
const catalog = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "src", "generated", "catalog.json"), "utf8")) as {
  pairs: Row[];
  bundles: Listed[];
  presets: Listed[];
};

console.log(`catalogue: ${catalog.pairs.length} records, ${catalog.pairs.length - catalog.pairs.filter((p) => p.twin).length / 2} different swaps, ${catalog.pairs.filter((p) => p.alternative.rating).length} rated, ${catalog.pairs.filter((p) => p.bulkView.bigger).length} with a bigger pack, ${catalog.pairs.filter((p) => p.category === "clothing").length} clothing`);
console.log("country | swaps | with control | rated (survive hiding unrated) | baskets | kits | bulk");
for (const code of ["IE", "GB", "DE", "US", "CA", "HR", "AT", "FR", "NL", "PL"]) {
  const local = localFor(code);
  const swaps = forCountry(catalog.pairs, local);
  const all = forCountry(catalog.pairs, localFor(code, true));
  const rated = swaps.filter((p) => p.alternative.rating).length;
  const bulk = swaps.filter((p) => p.bulkView.bigger && p.category !== "otc-medicine").length;
  console.log(`${code} | ${swaps.length} | ${all.length} | ${rated} | ${forCountry(catalog.presets, local).length} | ${forCountry(catalog.bundles, local).length} | ${bulk}`);
}
const byMarket: Record<string, { n: number; rated: number }> = {};
for (const p of catalog.pairs) {
  byMarket[p.market] ??= { n: 0, rated: 0 };
  byMarket[p.market].n++;
  if (p.alternative.rating) byMarket[p.market].rated++;
}
console.log("by market priced in:", JSON.stringify(byMarket));
