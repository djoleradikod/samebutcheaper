import { livePrograms, liveSubNetwork, pickAffiliateEnv, type Env } from "./affiliate-links";
import feedRunsJson from "../../data/prices/feed-runs.json";
import { feedReadiness, type FeedRuns } from "./feed-status";
import { legalMissing } from "./legal";
import { letterSettings } from "./letter-settings";
import { mailConfigured } from "./mail";
import { termsChecks, type TermsBuild } from "./readiness-terms";

/** Numeric settings that fall back to a default when they don't parse. */
const MAIL_NUMBERS = [
  "NEWSLETTER_MAX_PER_RUN",
  "WATCH_MAX_PER_RUN",
  "WISH_MAX_PER_RUN",
  "RETENTION_CLICK_DETAIL_DAYS",
  "RETENTION_LOOKUP_DAYS",
  "RETENTION_REPORT_DAYS",
  "RETENTION_WANTED_DAYS",
  "RETENTION_WISH_DAYS",
  "RETENTION_SEND_DAYS",
];

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
  /** The contact address pages were built with (NEXT_PUBLIC_CONTACT_EMAIL at build time); unchecked when absent. */
  contactEmail?: string;
  /** The catalogue the site was built with, for the programme terms checks (src/lib/readiness-terms.ts). */
  build?: TermsBuild;
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

  // Docker compose reads it from .env, and the web containers get the same .env. Only checked where it is known.
  const pg = env.POSTGRES_PASSWORD?.trim();
  if (pg !== undefined) {
    add({
      id: "postgres-password",
      label: "Database password",
      level: "blocker",
      ok: pg.length >= 16 && !PLACEHOLDER.test(pg),
      detail: !pg ? "not set" : PLACEHOLDER.test(pg) ? "still the placeholder from .env.example" : pg.length < 16 ? "shorter than 16 characters" : "set",
      fix: "Set POSTGRES_PASSWORD in .env to a long random string (openssl rand -hex 24) before the first deploy. It only takes effect when the database is first created; to change it later, see docs/deploy.md, \"Rotating a secret\".",
    });
  }

  if (facts.contactEmail !== undefined) {
    const domain = (a: string) => /@([^\s>]+)>?\s*$/.exec(a)?.[1]?.toLowerCase() ?? "";
    const siteDomain = host.replace(/^www\./, "");
    const onSite = (a: string) => Boolean(siteDomain) && (domain(a) === siteDomain || domain(a).endsWith(`.${siteDomain}`));
    const off = [
      onSite(facts.contactEmail) ? null : `contact address ${facts.contactEmail}`,
      !env.MAIL_FROM?.trim() || onSite(env.MAIL_FROM) ? null : `MAIL_FROM ${env.MAIL_FROM.trim()}`,
    ].filter(Boolean);
    add({
      id: "own-addresses",
      label: "Email addresses on the site's domain",
      level: "recommended",
      ok: local || off.length === 0,
      detail: local ? "no public address yet" : off.length ? `not on ${siteDomain}: ${off.join("; ")}` : `on ${siteDomain}`,
      fix: "The contact address is fixed when the site is built: set the repository variable CONTACT_EMAIL (NEXT_PUBLIC_CONTACT_EMAIL for a local build) to an address on your domain and rebuild. MAIL_FROM must be on the domain verified in Resend.",
    });
  }

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
  checks.push(...termsChecks(env, aff, facts.build));

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
    detail: mailConfigured(env)
      ? "set"
      : "not set: sign-ups and price watches are saved but nobody gets a confirmation email, and nothing else is sent (it is only logged)",
    fix: "Create a Resend account, verify the domain, then set RESEND_API_KEY and MAIL_FROM.",
  });

  // German law (DDG §5) wants a legal notice before marketing email reaches German readers, and confirmation emails
  // go to whoever signs up. Without email nothing goes out, so until then it is only recommended.
  const missingLegal = legalMissing(env);
  add({
    id: "legal-notice",
    label: "Legal notice (Impressum)",
    level: mailConfigured(env) ? "blocker" : "recommended",
    ok: missingLegal.length === 0,
    detail: missingLegal.length
      ? `not published (${missingLegal.join(", ")} not set): /impressum says so, and the weekly letter is held back for readers in Germany and Austria`
      : "published at /impressum",
    fix: "Set LEGAL_NAME, LEGAL_ADDRESS and LEGAL_EMAIL to the site owner's real details (LEGAL_PHONE, LEGAL_VAT_ID and LEGAL_RESPONSIBLE when they apply). Required before sending any email to a German address.",
  });

  const letter = letterSettings(env);
  add({
    id: "weekly-letter",
    label: "Weekly letter",
    level: "recommended",
    ok: letter.on && letter.postalAddress !== null && mailConfigured(env),
    detail: !letter.on
      ? "off: confirmed subscribers get nothing after they confirm"
      : !letter.postalAddress
        ? "on, but held back: MAIL_POSTAL_ADDRESS is not set"
        : !mailConfigured(env)
          ? "on, but email isn't set up, so it is only logged"
          : `on, from weekday ${letter.weekday} of each week, up to ${letter.cap} a run`,
    fix: "Look at it first (npm run newsletter:preview, or the test button below), then set MAIL_POSTAL_ADDRESS to the postal address marketing email must carry, and NEWSLETTER_WEEKLY=on.",
  });

  const badNumbers = MAIL_NUMBERS.filter((k) => env[k]?.trim() && !(Number(env[k]) >= 1 && Number.isFinite(Number(env[k]))));
  if (env.NEWSLETTER_WEEKDAY?.trim() && !/^[1-7]$/.test(env.NEWSLETTER_WEEKDAY.trim())) badNumbers.push("NEWSLETTER_WEEKDAY");
  add({
    id: "mail-numbers",
    label: "Send caps and retention periods",
    level: "optional",
    ok: badNumbers.length === 0,
    detail: badNumbers.length ? `not a number, so the default is used: ${badNumbers.join(", ")}` : "defaults, or valid values",
    fix: "Each takes a whole number of days or emails (NEWSLETTER_WEEKDAY: 1 for Monday to 7 for Sunday). See .env.example.",
  });

  add({
    id: "admin-email",
    label: "Admin email for test sends",
    level: "optional",
    ok: set("ADMIN_EMAIL"),
    detail: set("ADMIN_EMAIL") ? "set" : "not set: type an address each time you send a test letter",
    fix: "Set ADMIN_EMAIL to fill in the address for “Send a test to me” in /admin.",
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
  // ---- Affiliate price feeds (docs/feeds.md). The feed URLs are a GitHub secret, so the price watch's own record of
  // ---- its runs says which networks are set up; a configured one with no price in 14 days is flagged.
  add(feedReadiness(feedRunsJson as FeedRuns, new Date().toISOString().slice(0, 10)));
  return checks;
}

export function summarize(checks: Check[]) {
  const failing = (level: Check["level"]) => checks.filter((c) => c.level === level && !c.ok);
  return { ready: failing("blocker").length === 0, blockers: failing("blocker"), recommended: failing("recommended"), optional: failing("optional") };
}
