/**
 * Revenue report for the owner, on a computer with the database address (no public route, docs/feeds.md):
 *
 *   DATABASE_URL=postgres://... npm run report:revenue                 # last 28 days, per week
 *   npm run report:revenue -- --days 14 --by day --top 20
 *   npm run report:revenue -- --exports ~/Downloads/commissions        # Awin or Impact commission CSVs
 *   npm run report:revenue -- --json > revenue.json
 *
 * Exports default to reports/commissions/ (ignored by git: they hold order ids and amounts). Read only: it never writes
 * to the database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { readExportFolder, type Earning } from "./revenue/exports";
import { buildReport, mergeEarnings, renderReport, type ClickRow } from "./revenue/report";

const ROOT = join(import.meta.dirname, "..");

export function parseArgs(argv: string[]) {
  const value = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const days = Math.max(1, Math.min(366, Number(value("--days") ?? 28) || 28));
  const by = (value("--by") ?? (days > 14 ? "week" : "day")) === "day" ? "day" : "week";
  const top = Math.max(1, Number(value("--top") ?? 15) || 15);
  return { days, by, top, exports: value("--exports") ?? join(ROOT, "reports", "commissions"), json: argv.includes("--json") } as const;
}

function catalogLookups() {
  try {
    const c = JSON.parse(readFileSync(join(ROOT, "src", "generated", "catalog.json"), "utf8")) as { pairs: { slug: string; title: string }[]; bundles: { slug: string; title: string }[] };
    const kits = new Set(c.bundles.map((b) => b.slug));
    const titles = new Map([...c.pairs, ...c.bundles].map((r) => [r.slug, r.title]));
    return { isKit: (s: string) => kits.has(s), title: (s: string) => titles.get(s) ?? s };
  } catch {
    return { isKit: () => false, title: (s: string) => s };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the site's Postgres address (read only is enough).");
    process.exit(2);
  }
  const until = new Date();
  const since = new Date(until.getTime() - args.days * 86_400_000);
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  try {
    const c = schema.clicks;
    const v = schema.conversions;
    const [clicks, conversions] = await Promise.all([
      db
        .select({ createdAt: c.createdAt, slug: c.pairSlug, side: c.side, retailer: c.retailer, program: c.program, country: c.country, host: c.host, referrer: c.referrer, clickId: c.clickId })
        .from(c)
        .where(and(gte(c.createdAt, since), lt(c.createdAt, until))),
      db.select().from(v).where(gte(v.createdAt, since)),
    ]);
    const fromDb: Earning[] = conversions.map((x) => ({
      network: x.network,
      orderId: x.orderId,
      clickId: x.clickId,
      advertiser: x.program ?? "",
      commission: Number(x.commission),
      sale: x.sale === null ? null : Number(x.sale),
      currency: x.currency,
      status: x.status === "reversed" ? "reversed" : x.status === "approved" ? "approved" : "pending",
      day: x.createdAt.toISOString().slice(0, 10),
      file: "database",
    }));
    const exported = readExportFolder(args.exports);
    const report = buildReport(clicks as ClickRow[], mergeEarnings(fromDb, exported.earnings), { by: args.by, ...catalogLookups() });
    if (args.json) console.log(JSON.stringify(report, null, 1));
    else
      console.log(
        renderReport(report, { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), top: args.top, exportFiles: exported.files, problems: exported.problems }),
      );
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
