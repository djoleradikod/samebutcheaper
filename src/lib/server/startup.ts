import "server-only";
import { getDb } from "@/db";
import { affiliateEnv } from "@/lib/affiliate-links";
import { log } from "@/lib/log";
import { runMaintenance } from "@/lib/maintenance";
import { readinessChecks, summarize } from "@/lib/readiness";
import { SITE } from "@/lib/site";
import { dbStatus, MIGRATIONS_EXPECTED } from "./db-status";

const HOUR = 3600_000;

async function upkeep() {
  const db = getDb();
  if (!db) return;
  try {
    const report = await runMaintenance(db, { siteUrl: SITE.url, minHoursSinceLast: 20 });
    if (report) log.info("maintenance.done", report);
  } catch (err) {
    log.error("maintenance.failed", { err });
  }
}

async function reportReadiness() {
  try {
    const status = await dbStatus();
    const checks = readinessChecks(process.env, { siteUrl: SITE.url, ...status, migrationsExpected: MIGRATIONS_EXPECTED, affiliateEnv: affiliateEnv() });
    const { ready, blockers, recommended } = summarize(checks);
    log[ready ? "info" : "warn"]("startup.readiness", {
      ready,
      blockers: blockers.map((c) => c.id),
      recommended: recommended.map((c) => c.id),
    });
  } catch (err) {
    log.error("startup.readiness_failed", { err });
  }
}

/** Called once per server process from src/instrumentation.ts. */
export function startServerTasks() {
  const g = globalThis as unknown as { __sbcStarted?: boolean };
  if (g.__sbcStarted) return;
  g.__sbcStarted = true;
  // Not in development, and not in the workers `next build` starts to prerender pages.
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  void reportReadiness();
  // A minute after start (migrations have finished by then), then every six hours; a run within 20 hours of the
  // last one does nothing, so this comes to once a day however often the server restarts.
  setTimeout(() => void upkeep(), 60_000).unref();
  setInterval(() => void upkeep(), 6 * HOUR).unref();
}
