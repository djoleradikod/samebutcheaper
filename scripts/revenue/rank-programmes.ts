/**
 * Which affiliate programmes to join first: each programme in data/sellers/programmes.json with the swaps and kit
 * pieces whose buy links it would tag, and, when DATABASE_URL is set, its share of the last 90 days' outbound clicks.
 * Writes the tables in docs/research/R9-programmes.md:
 *
 *   npm run catalog && npx tsx scripts/revenue/rank-programmes.ts [--days 90]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";
import { clickStore, linkStore, PROGRAMME_REGISTRY, programmeOf, signupOf } from "../../src/lib/programmes";

type Side = { retailer: string; url: string };
type Catalog = { pairs: { slug: string; market: string; brand: Side; alternative: Side }[]; bundles: { slug: string; market: string; bundle: Side; components: Side[] }[] };

export type Reach = { store: string; swaps: number; cheaperSides: number; kitPieces: number; markets: string[] };
type MarketReach = { slugs: Set<string>; cheaperSides: number; kitPieces: number };

/** Per store and record market: swaps with a buy link there, how many of those are the cheaper side, and kit links. */
export function reachByStore(catalog: Catalog): Map<string, Map<string, MarketReach>> {
  const out = new Map<string, Map<string, MarketReach>>();
  const get = (store: string, market: string) => {
    const m = out.get(store) ?? out.set(store, new Map()).get(store)!;
    return m.get(market) ?? m.set(market, { slugs: new Set(), cheaperSides: 0, kitPieces: 0 }).get(market)!;
  };
  for (const p of catalog.pairs) {
    for (const [side, isCheaper] of [[p.alternative, true], [p.brand, false]] as const) {
      const r = get(linkStore(side), p.market);
      r.slugs.add(p.slug);
      if (isCheaper) r.cheaperSides++;
    }
  }
  for (const b of catalog.bundles) for (const side of [b.bundle, ...b.components]) get(linkStore(side), b.market).kitPieces++;
  return out;
}

/** A store's reach, counting only the markets a programme pays for (all markets when it names none). */
export function reachIn(store: string, byMarket: Map<string, MarketReach>, markets: string[]): Reach {
  const keep = [...byMarket].filter(([m]) => !markets.length || markets.includes(m));
  return {
    store,
    swaps: new Set(keep.flatMap(([, r]) => [...r.slugs])).size,
    cheaperSides: keep.reduce((n, [, r]) => n + r.cheaperSides, 0),
    kitPieces: keep.reduce((n, [, r]) => n + r.kitPieces, 0),
    markets: keep.map(([m]) => m).sort(),
  };
}

export type ProgrammeRank = { key: string; network: string; stores: string[]; swaps: number; cheaperSides: number; kitPieces: number; clickShare: number | null; signup: string | null; markets: string[] };

/** Programmes we could join, most reach first: swaps plus kit links, then click share. "none" and "unknown" are left out. */
export function rankProgrammes(reach: Map<string, Map<string, MarketReach>>, clicksByStore: Map<string, number> | null): { ranked: ProgrammeRank[]; unknown: Reach[] } {
  const total = clicksByStore ? [...clicksByStore.values()].reduce((a, b) => a + b, 0) : 0;
  const groups = new Map<string, ProgrammeRank>();
  const unknown: Reach[] = [];
  for (const [store, byMarket] of reach) {
    const e = programmeOf(store);
    if (e.network === "unknown") {
      unknown.push(reachIn(store, byMarket, []));
      continue;
    }
    const r = reachIn(store, byMarket, e.markets);
    if (!r.markets.length) continue;
    if (e.network === "none") continue;
    const key = e.programme ?? `${e.network}:${r.store}`;
    const g = groups.get(key) ?? { key, network: e.network, stores: [], swaps: 0, cheaperSides: 0, kitPieces: 0, clickShare: clicksByStore ? 0 : null, signup: signupOf(e), markets: [] };
    g.stores.push(r.store);
    g.swaps += r.swaps;
    g.cheaperSides += r.cheaperSides;
    g.kitPieces += r.kitPieces;
    g.markets = [...new Set([...g.markets, ...r.markets])].sort();
    if (clicksByStore && total) g.clickShare = (g.clickShare ?? 0) + (clicksByStore.get(r.store) ?? 0) / total;
    groups.set(key, g);
  }
  const ranked = [...groups.values()].sort((a, b) => b.swaps + b.kitPieces - (a.swaps + a.kitPieces) || (b.clickShare ?? 0) - (a.clickShare ?? 0) || a.key.localeCompare(b.key));
  unknown.sort((a, b) => b.swaps + b.kitPieces - (a.swaps + a.kitPieces) || a.store.localeCompare(b.store));
  return { ranked, unknown };
}

async function clickShares(days: number): Promise<Map<string, number> | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client, { schema });
    const rows = await db.select({ retailer: schema.clicks.retailer, host: schema.clicks.host }).from(schema.clicks).where(gte(schema.clicks.createdAt, new Date(Date.now() - days * 86_400_000)));
    const m = new Map<string, number>();
    for (const r of rows) m.set(clickStore(r.retailer, r.host), (m.get(clickStore(r.retailer, r.host)) ?? 0) + 1);
    return m;
  } finally {
    await client.end();
  }
}

async function main() {
  const i = process.argv.indexOf("--days");
  const days = i >= 0 ? Number(process.argv[i + 1]) || 90 : 90;
  const catalog = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "src", "generated", "catalog.json"), "utf8")) as Catalog;
  const shares = await clickShares(days);
  const { ranked, unknown } = rankProgrammes(reachByStore(catalog), shares);
  const share = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}%`);
  console.log(`| # | Programme | Network | Stores | Markets | Swaps | Cheaper-side links | Kit links | Click share (${days} days) | Sign up |`);
  console.log("|---:|---|---|---|---|---:|---:|---:|---:|---|");
  ranked.forEach((g, n) => console.log(`| ${n + 1} | ${g.key} | ${g.network} | ${g.stores.join(", ")} | ${g.markets.join(", ")} | ${g.swaps} | ${g.cheaperSides} | ${g.kitPieces} | ${share(g.clickShare)} | ${g.signup ?? "-"} |`));
  console.log("\nStores with no programme found yet:\n");
  console.log("| Store | Markets | Swaps | Kit links | What we know |");
  console.log("|---|---|---:|---:|---|");
  for (const u of unknown) console.log(`| ${u.store} | ${u.markets.join(", ")} | ${u.swaps} | ${u.kitPieces} | ${(PROGRAMME_REGISTRY[u.store]?.note ?? "no entry").replace(/\|/g, "/")} |`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
