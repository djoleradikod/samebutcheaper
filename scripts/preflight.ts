/**
 * The launch checklist on the command line, red and green:
 *
 *   npm run preflight [path/to/.env]                         the configuration (src/lib/readiness.ts)
 *   npm run preflight [path/to/.env] -- --url <address>      ... and the go-live checks against the running site
 *
 * Reads the env file (default .env) plus the environment, checks the database when DATABASE_URL is reachable, and
 * exits 1 while anything blocks a public launch or a go-live check fails. /admin shows the configuration half for the
 * running site. The server's own state (marker, backups, disk, ports) is `deploy-remote.sh check`, run on the server.
 * docs/deploy.md says when to run which.
 */
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";
import { readinessChecks, summarize } from "../src/lib/readiness";
import journal from "../drizzle/meta/_journal.json";
import knownSlugs from "../src/generated/known-slugs.json";
import { goLiveChecks, type LiveCheck } from "./go-live";

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const PASS = paint(32, "PASS");
const FAIL = paint(31, "FAIL");
const WARN = paint(33, "WARN");
const SKIP = paint(90, "SKIP");

function parseArgs(argv: string[]) {
  let file = ".env";
  let url: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") url = argv[++i] ?? null;
    else if (!argv[i].startsWith("--")) file = argv[i];
  }
  return { file, url };
}

function readEnvFile(file: string) {
  const env: Record<string, string | undefined> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

async function main(): Promise<number> {
  const { file, url } = parseArgs(process.argv.slice(2));
  const env: Record<string, string | undefined> = existsSync(file) ? readEnvFile(file) : {};
  if (!existsSync(file)) console.log(`(no ${file}; checking the environment only)`);
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

  const site = env.NEXT_PUBLIC_SITE_URL ?? "";
  const checks = readinessChecks(env, {
    siteUrl: site,
    // Docker compose builds DATABASE_URL itself, so on a server it is only known inside the containers.
    database: env.DATABASE_URL ? database : env.POSTGRES_PASSWORD ? "unknown" : "not-configured",
    migrationsApplied,
    migrationsExpected: journal.entries.length,
    contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@samebutcheaper.com",
  });
  const tag = { blocker: "must fix", recommended: "should fix", optional: "optional" } as const;
  console.log(`\nConfiguration (${existsSync(file) ? file : "environment"})`);
  // The database can only be judged from here when DATABASE_URL is given.
  const unknownDb = (id: string) => id === "database" && !env.DATABASE_URL && Boolean(env.POSTGRES_PASSWORD);
  for (const c of checks) {
    if (unknownDb(c.id)) {
      console.log(`  ${SKIP}  ${c.label}: not checked from here (the go-live checks below, or /admin, show it)`);
      continue;
    }
    const mark = c.ok ? PASS : c.level === "blocker" ? FAIL : c.level === "recommended" ? WARN : SKIP;
    console.log(`  ${mark}  ${c.label}: ${c.detail}${c.ok ? "" : `  [${tag[c.level]}]`}`);
    if (!c.ok && c.fix && c.level !== "optional") console.log(`        -> ${c.fix}`);
  }
  const { blockers, recommended } = summarize(checks);
  const real = blockers.filter((c) => !unknownDb(c.id));

  const live: LiveCheck[] = [];
  const section = (title: string, list: LiveCheck[]) => {
    console.log(`\n${title}`);
    for (const c of list) {
      console.log(`  ${c.ok === null ? SKIP : c.ok ? PASS : FAIL}  ${c.label}: ${c.detail}`);
      if (c.ok === false && c.fix) console.log(`        -> ${c.fix}`);
    }
    live.push(...list);
  };
  if (url) section(`Go-live (${url}, built for ${site || "?"})`, await goLiveChecks(url, site || url, { slug: knownSlugs.compare[0] }));

  const liveFailed = live.filter((c) => c.ok === false);
  const problems = real.length + liveFailed.length;
  console.log(
    problems
      ? `\n${paint(31, `${problems} thing(s) to fix before opening to the public.`)}`
      : `\n${paint(32, "Nothing blocks a launch.")}${recommended.length ? ` ${recommended.length} thing(s) would make it earn or work better.` : ""}${url ? "" : " Run again with --url <address> once it is deployed."}`,
  );
  return problems ? 1 : 0;
}

main().then((code) => process.exit(code));
