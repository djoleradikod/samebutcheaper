/**
 * What each country lists, for the handover and the owner's choice on unrated products:
 * swaps by default and with the control on, how many of those are rated, baskets, kits and bulk rows.
 * Usage, after npm run catalog: npx tsx scripts/qa/country_counts.ts [CA]
 * With a country code it also prints what that country lists by default, by market and seller.
 *
 * Expected after the country round of 13 Nov 2026 (Canada judged by seller like everywhere else):
 *   CA 32 swaps by default and 185 with the control (US only), 1 basket and 0 kits by default, 9 and 37 with it.
 *   US 213: Canadian records whose stores don't sell in the US (Loblaws, walmart.ca) no longer list there.
 * A change in these is a change in what shoppers can buy, so say why in the commit.
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
console.log("country | swaps | with control | rated (survive hiding unrated) | baskets | with control | kits | with control | bulk");
for (const code of ["IE", "GB", "DE", "US", "CA", "HR", "AT", "CH", "FR", "NL", "PL", "AU", null]) {
  const local = localFor(code);
  const wide = localFor(code, true);
  const swaps = forCountry(catalog.pairs, local);
  const all = forCountry(catalog.pairs, wide);
  const rated = swaps.filter((p) => p.alternative.rating).length;
  const bulk = swaps.filter((p) => p.bulkView.bigger && p.category !== "otc-medicine").length;
  const cells = [
    code ?? "unknown",
    swaps.length,
    all.length,
    rated,
    forCountry(catalog.presets, local).length,
    forCountry(catalog.presets, wide).length,
    forCountry(catalog.bundles, local).length,
    forCountry(catalog.bundles, wide).length,
    bulk,
  ];
  console.log(cells.join(" | "));
}
const byMarket: Record<string, { n: number; rated: number }> = {};
for (const p of catalog.pairs) {
  byMarket[p.market] ??= { n: 0, rated: 0 };
  byMarket[p.market].n++;
  if (p.alternative.rating) byMarket[p.market].rated++;
}
console.log("by market priced in:", JSON.stringify(byMarket));

const asked = process.argv[2];
if (asked) {
  const by: Record<string, number> = {};
  for (const p of forCountry(catalog.pairs, localFor(asked))) {
    const key = `${p.market} ${p.sellers.join("+")}`;
    by[key] = (by[key] ?? 0) + 1;
  }
  console.log(`${asked} lists by default, by market and seller:`, JSON.stringify(by));
}
