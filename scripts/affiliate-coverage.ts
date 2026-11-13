/**
 * Which catalog links each affiliate program covers, and which stores have
 * none. Run after `npm run catalog`:  npm run affiliate:coverage
 */
import { readFileSync } from "node:fs";
import { programFor } from "../src/lib/affiliate-links";

type Side = { url: string; retailer: string };
const catalog = JSON.parse(readFileSync(new URL("../src/generated/catalog.json", import.meta.url), "utf8")) as {
  pairs: { market: string; brand: Side; alternative: Side }[];
  bundles: { market: string; bundle: Side; components: Side[] }[];
};

const rows = new Map<string, { program: string; links: number; alt: number }>();
function add(market: string, s: Side, isAlt: boolean) {
  let host = "?";
  try {
    host = new URL(s.url).hostname.replace(/^www\./, "");
  } catch {}
  const key = `${market} ${host}`;
  const r = rows.get(key) ?? { program: programFor(s.url)?.id ?? "-", links: 0, alt: 0 };
  r.links++;
  if (isAlt) r.alt++;
  rows.set(key, r);
}
for (const p of catalog.pairs) {
  add(p.market, p.brand, false);
  add(p.market, p.alternative, true);
}
for (const b of catalog.bundles) {
  add(b.market, b.bundle, false);
  for (const c of b.components) add(b.market, c, true);
}

const sorted = [...rows.entries()].sort((a, b) => b[1].links - a[1].links);
const total = sorted.reduce((n, [, r]) => n + r.links, 0);
const covered = sorted.filter(([, r]) => r.program !== "-").reduce((n, [, r]) => n + r.links, 0);
console.log("market host                         program            links  cheaper-side");
for (const [k, r] of sorted) console.log(`${k.padEnd(36)} ${r.program.padEnd(18)} ${String(r.links).padStart(5)}  ${String(r.alt).padStart(5)}`);
console.log(`\n${covered} of ${total} links (${Math.round((100 * covered) / total)}%) go to a store with a direct program.`);
console.log("The rest can still earn through a sub-network (SKIMLINKS_ID or SOVRN_KEY).");
