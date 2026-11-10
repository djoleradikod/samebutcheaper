import { connection, type NextRequest } from "next/server";
import { affiliateEnv } from "@/lib/affiliate-links";
import { getSiteStats } from "@/lib/catalog";
import { readinessChecks, summarize } from "@/lib/readiness";
import { dbStatus, MIGRATIONS_EXPECTED } from "@/lib/server/db-status";
import { SITE } from "@/lib/site";

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

/** The last probe of the label databases, kept a minute so this URL can't be used to hammer them. */
let lastProbe: { at: number; sources: Record<string, unknown> } | null = null;

async function probeSources() {
  if (lastProbe && Date.now() - lastProbe.at < 60_000) return lastProbe.sources;
  const entries = await Promise.all(Object.entries(SOURCES).map(async ([k, url]) => [k, await probe(url)] as const));
  lastProbe = { at: Date.now(), sources: Object.fromEntries(entries) };
  return lastProbe.sources;
}

/**
 * GET /api/health: is the server up. Always 200 while the process can answer, so Docker doesn't restart a web
 * server over a database blip (pages are static and keep working).
 * GET /api/health?ready=1: 503 unless the database answers with every migration applied and nothing on the
 * launch checklist blocks. Use it for the deploy script and an uptime monitor.
 * GET /api/health?sources=1 also checks that the server can reach the label databases behind /check, and
 * whether photo reading is configured.
 */
export async function GET(req: NextRequest) {
  await connection();
  const status = await dbStatus();
  const checks = readinessChecks(process.env, {
    siteUrl: SITE.url,
    ...status,
    migrationsExpected: MIGRATIONS_EXPECTED,
    affiliateEnv: affiliateEnv(),
  });
  const { ready, blockers } = summarize(checks);
  const body: Record<string, unknown> = {
    status: "ok",
    pairs: getSiteStats().pairs,
    database: status.database,
    migrations: status.migrationsApplied === null ? null : `${status.migrationsApplied}/${MIGRATIONS_EXPECTED}`,
    ready,
    // Names only: what is wrong is on /admin, behind the password.
    blockers: blockers.map((c) => c.id),
  };
  if (req.nextUrl.searchParams.has("sources")) {
    body.sources = await probeSources();
    body.photoReading = Boolean(process.env.ANTHROPIC_API_KEY);
    body.openfdaKey = Boolean(process.env.OPENFDA_API_KEY);
  }
  const wantReady = req.nextUrl.searchParams.has("ready");
  return Response.json(body, { status: wantReady && !ready ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
