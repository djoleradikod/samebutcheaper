/**
 * The launch checklist on the command line:  npm run preflight [path/to/.env]
 * Reads the env file (default .env) plus the environment, checks the database when DATABASE_URL is reachable,
 * and exits 1 while anything blocks a public launch. /admin shows the same list for the running site.
 */
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { readinessChecks, summarize } from "../src/lib/readiness";
import journal from "../drizzle/meta/_journal.json";

const file = process.argv[2] ?? ".env";
const env: Record<string, string | undefined> = {};
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
} else {
  console.log(`(no ${file}; checking the environment only)`);
}
Object.assign(env, process.env);

let database: "ok" | "down" | "not-configured" = "not-configured";
let migrationsApplied: number | null = null;
if (env.DATABASE_URL) {
  const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await sql`select 1`;
    database = "ok";
    migrationsApplied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`.then((r) => r[0].n as number).catch(() => 0);
  } catch {
    database = "down";
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}

const checks = readinessChecks(env, {
  siteUrl: env.NEXT_PUBLIC_SITE_URL ?? "",
  // Docker compose builds DATABASE_URL itself, so on a server it is only known inside the containers.
  database: env.DATABASE_URL ? database : env.POSTGRES_PASSWORD ? "unknown" : "not-configured",
  migrationsApplied,
  migrationsExpected: journal.entries.length,
});
const mark = { blocker: "MUST FIX", recommended: "should fix", optional: "optional" } as const;
for (const c of checks) {
  console.log(`${c.ok ? "ok        " : mark[c.level].padEnd(10)} ${c.label}: ${c.detail}`);
  if (!c.ok && c.fix) console.log(`           -> ${c.fix}`);
}
const { blockers, recommended } = summarize(checks);
// The database can only be judged from here when DATABASE_URL is given.
const real = blockers.filter((c) => !(c.id === "database" && !env.DATABASE_URL && env.POSTGRES_PASSWORD));
console.log(
  real.length
    ? `\n${real.length} thing(s) to fix before opening to the public.`
    : `\nNothing blocks a launch.${recommended.length ? ` ${recommended.length} thing(s) would make it earn or work better.` : ""}`,
);
process.exit(real.length ? 1 : 0);
