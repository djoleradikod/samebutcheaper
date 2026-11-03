import { connection, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getSiteStats } from "@/lib/catalog";

/** One cheap request to each label database the product check uses. */
const SOURCES = {
  openfda: "https://api.fda.gov/drug/label.json?limit=1",
  dsld: "https://api.ods.od.nih.gov/dsld/v9/search-filter?q=vitamin&size=1",
  openbeautyfacts: "https://world.openbeautyfacts.org/api/v2/product/3337875597180.json?fields=code",
  openfoodfacts: "https://world.openfoodfacts.org/api/v2/product/3017620422003.json?fields=code",
} as const;

async function probe(url: string) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "SameButCheaper/0.2 (health check)" },
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed", ms: Date.now() - started };
  }
}

/**
 * GET /api/health: site and database status.
 * GET /api/health?sources=1 also checks that the server can reach the label
 * databases behind /check, and whether photo reading is configured.
 */
export async function GET(req: NextRequest) {
  await connection();
  const db = getDb();
  let database: "ok" | "down" | "not-configured" = "not-configured";
  if (db) {
    try {
      await db.execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "down";
    }
  }
  const body: Record<string, unknown> = { status: "ok", pairs: getSiteStats().pairs, database };
  if (req.nextUrl.searchParams.has("sources")) {
    const entries = await Promise.all(Object.entries(SOURCES).map(async ([k, url]) => [k, await probe(url)] as const));
    body.sources = Object.fromEntries(entries);
    body.photoReading = Boolean(process.env.ANTHROPIC_API_KEY);
    body.openfdaKey = Boolean(process.env.OPENFDA_API_KEY);
  }
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
