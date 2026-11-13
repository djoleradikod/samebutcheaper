import { livePrograms, liveSubNetwork, pickAffiliateEnv, type Env } from "./affiliate-links";
import { mailConfigured } from "./mail";

/**
 * What still stands between this install and a public launch. The same list feeds /admin, `npm run preflight`
 * (run on the server before going live) and the `ready` flag of /api/health.
 *
 *  - blocker: don't launch without it (insecure, or a core feature is off).
 *  - recommended: the site runs, but loses money or misses something visitors are promised.
 *  - optional: nice to have.
 */
export type Check = {
  id: string;
  label: string;
  level: "blocker" | "recommended" | "optional";
  ok: boolean;
  /** What we found. */
  detail: string;
  /** What to do when it isn't ok. */
  fix?: string;
};

export type Facts = {
  /** The address pages were built with (NEXT_PUBLIC_SITE_URL at build time). */
  siteUrl: string;
  database: "ok" | "down" | "not-configured" | "unknown";
  /** Migrations recorded in the database, null when unknown. */
  migrationsApplied: number | null;
  migrationsExpected: number;
  /** Affiliate settings the site was built with; defaults to the ones in `env`. */
  affiliateEnv?: Env;
};

const PLACEHOLDER = /^(change-?me.*|sbc|password|admin|secret|test|changeme)$/i;

export function readinessChecks(env: Env, facts: Facts): Check[] {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const set = (k: string) => Boolean(env[k]?.trim());

  let host = "";
  let https = false;
  try {
    const u = new URL(facts.siteUrl);
    host = u.hostname;
    https = u.protocol === "https:";
  } catch {}
  const local = !host || host === "localhost" || /^(127\.|10\.|192\.168\.|0\.0\.0\.0)/.test(host);
  add({
    id: "site-url",
    label: "Public address",
    level: "blocker",
    ok: https && !local,
    detail: facts.siteUrl || "not set",
    fix: "Set NEXT_PUBLIC_SITE_URL to the https:// address and rebuild. Sitemap, canonical links, share images and email links all use it.",
  });
  add({
    id: "own-domain",
    label: "Own domain",
    level: "recommended",
    ok: https && !local && !/\.(sslip|nip)\.io$/.test(host),
    detail: host || "not set",
    fix: "Affiliate networks review the live site on its real domain before approving it, so a temporary address can't earn.",
  });

  const migrated = facts.migrationsApplied !== null && facts.migrationsApplied >= facts.migrationsExpected;
  add({
    id: "database",
    label: "Database",
    level: "blocker",
    ok: facts.database === "ok" && migrated,
    detail:
      facts.database !== "ok"
        ? facts.database === "unknown" ? "not checked" : facts.database
        : `${facts.migrationsApplied ?? "?"} of ${facts.migrationsExpected} migrations applied`,
    fix:
      facts.database === "ok"
        ? "Run the migrate service (docker compose up migrate) or npm run db:migrate."
        : "Set DATABASE_URL (docker compose does this) and make sure Postgres is up. Without it no click, sale or sign-up is recorded.",
  });

  const admin = env.ADMIN_PASSWORD?.trim() ?? "";
  add({
    id: "admin-password",
    label: "Admin password",
    level: "blocker",
    ok: admin.length >= 12 && !PLACEHOLDER.test(admin),
    detail: !admin ? "not set, /admin is off" : admin.length < 12 ? "shorter than 12 characters" : PLACEHOLDER.test(admin) ? "a placeholder" : "set",
    fix: "Set ADMIN_PASSWORD to a long random string (openssl rand -base64 18).",
  });

  const salt = env.CLICK_HASH_SALT?.trim() ?? "";
  add({
    id: "click-salt",
    label: "Visitor hash salt",
    level: "blocker",
    ok: salt.length >= 16 && !PLACEHOLDER.test(salt),
    detail: !salt ? "not set" : PLACEHOLDER.test(salt) ? "still the placeholder" : salt.length < 16 ? "shorter than 16 characters" : "set",
    fix: "Set CLICK_HASH_SALT to a random string (openssl rand -hex 24). With the placeholder, the visitor hashes we store could be reversed to IP addresses.",
  });

  const aff = facts.affiliateEnv ?? pickAffiliateEnv(env);
  const live = livePrograms(aff).length;
  const sub = liveSubNetwork(aff);
  add({
    id: "affiliate",
    label: "Affiliate programs",
    level: "recommended",
    ok: live > 0 || sub !== null,
    detail: live || sub ? `${live} direct program${live === 1 ? "" : "s"}${sub ? ` + ${sub}` : ""}` : "none: no link earns anything",
    fix: "Add the IDs from each network as you are approved (docs/affiliate-playbook.md), then rebuild.",
  });

  const postback = env.POSTBACK_SECRET?.trim() ?? "";
  add({
    id: "postback-secret",
    label: "Sale postbacks",
    level: "recommended",
    ok: postback.length >= 16 && !PLACEHOLDER.test(postback),
    detail: !postback ? "not set, networks can't report sales" : postback.length < 16 ? "shorter than 16 characters" : "set",
    fix: "Set POSTBACK_SECRET (openssl rand -hex 24) and register the postback URL in each network.",
  });

  add({
    id: "mail",
    label: "Email sending",
    level: "recommended",
    ok: mailConfigured(env),
    detail: mailConfigured(env) ? "set" : "not set: sign-ups are saved but nobody gets a confirmation email",
    fix: "Create a Resend account, verify the domain, then set RESEND_API_KEY and MAIL_FROM.",
  });

  add({
    id: "photo-reading",
    label: "Photo label reading",
    level: "optional",
    ok: set("ANTHROPIC_API_KEY"),
    detail: set("ANTHROPIC_API_KEY") ? "on" : "off: the photo button explains it isn't available",
    fix: "Set ANTHROPIC_API_KEY (about two cents a photo).",
  });
  add({
    id: "openfda-key",
    label: "openFDA key",
    level: "optional",
    ok: set("OPENFDA_API_KEY"),
    detail: set("OPENFDA_API_KEY") ? "set" : "not set: 1,000 drug label lookups a day for the whole site",
    fix: "Get a free key at open.fda.gov/apis/authentication and set OPENFDA_API_KEY.",
  });
  add({
    id: "client-ip",
    label: "Visitor address behind a CDN",
    level: "optional",
    ok: set("CLIENT_IP_HEADER"),
    detail: set("CLIENT_IP_HEADER") ? env.CLIENT_IP_HEADER!.trim() : "not set: correct without a CDN",
    fix: "Once Cloudflare is in front, set CLIENT_IP_HEADER=cf-connecting-ip, or rate limits and unique-visitor counts see Cloudflare's addresses.",
  });
  return checks;
}

export function summarize(checks: Check[]) {
  const failing = (level: Check["level"]) => checks.filter((c) => c.level === level && !c.ok);
  return { ready: failing("blocker").length === 0, blockers: failing("blocker"), recommended: failing("recommended"), optional: failing("optional") };
}
