/**
 * What the site stores, where, for how long and who else sees it: the facts both privacy pages are written from
 * (/privacy from src/lib/i18n/en/privacy.ts, /datenschutz from src/lib/i18n/de/datenschutz.ts, both rendered by
 * src/components/PrivacyPolicy.tsx). scripts/tests/privacy-facts.test.ts reads the code for every cookie, browser
 * storage key and service worker cache and fails when one is missing here, or when either page leaves one out.
 *
 * Where each fact comes from:
 *  - cookies: src/proxy.ts (sbc_country on the first request; sbc_src only deleted), src/lib/client/country.ts
 *    (sbc_country, sbc_others when the visitor switches), src/components/ConsentChoice.tsx (sbc_consent);
 *  - browser storage: src/lib/client/savedList.ts, buyingOften.ts, src/components/BundleBuyList.tsx;
 *  - the service worker's caches: public/sw.js;
 *  - tables and their periods: src/db/schema.ts and src/lib/maintenance.ts (retention);
 *  - logs: src/lib/log.ts (no IP or email addresses), deploy/Caddyfile (the access log), src/lib/rate-limit.ts (per IP
 *    address, in memory only), src/lib/visitor.ts (the daily hash);
 *  - outside services: src/lib/mail.ts (Resend), src/app/api/identify/route.ts and src/lib/receipt/photo.ts (Anthropic,
 *    only with ANTHROPIC_API_KEY), src/lib/lookup/* (the product databases, asked by our server), /check's result
 *    photos (loaded by the browser from Open Food Facts' image servers), src/lib/affiliate-links.ts (the networks a
 *    store link can pass through), docs/deploy.md (Hetzner).
 */
import { gatedStores } from "./consent";
import { CONSENT_COOKIE, CONSENT_DAYS } from "./consent-core";
import { legalNotice, type LegalNotice } from "./legal";
import { retention } from "./maintenance";

type Env = Record<string, string | undefined>;

/** Every cookie the site can set, with how long it lasts. */
export const COOKIES = {
  sbc_country: { days: 365 },
  sbc_others: { days: 365 },
  [CONSENT_COOKIE]: { days: CONSENT_DAYS },
} as const;
export type CookieName = keyof typeof COOKIES;

/** Cookies the site no longer sets. A browser that still has one loses it on its next page view (src/proxy.ts). */
export const RETIRED_COOKIES = ["sbc_src"] as const;

/** localStorage keys, each set only by the visitor's own action. A key ending in ":" is followed by a kit's slug. */
export const BROWSER_STORAGE = ["sbc:saved", "sbc:how-often", "sbc:kit-ticks:"] as const;

/** The service worker's caches (public/sw.js), by the prefix before the version. */
export const SERVICE_WORKER_CACHES = ["sbc-shell-", "sbc-static-", "sbc-images-"] as const;

/** What the server runs with, read when a privacy page is requested. */
export type PolicyFacts = {
  keep: ReturnType<typeof retention>;
  /** Whether photos can be read (ANTHROPIC_API_KEY is set). */
  photos: boolean;
  /** How many nightly database copies are kept (BACKUP_KEEP_DAYS, read by deploy/backup.sh too). */
  backupDays: number;
  /** The legal notice, or null while LEGAL_NAME, LEGAL_ADDRESS or LEGAL_EMAIL is missing. */
  notice: LegalNotice | null;
  /** Stores whose programme asks for consent before its tracking (src/lib/consent.ts). Empty: nothing asks. */
  consentStores: string[];
};

/** The nightly copies kept. */
export function backupDays(env: Env) {
  const n = Number.parseInt(env.BACKUP_KEEP_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

export function policyFacts(env: Env = process.env): PolicyFacts {
  return {
    keep: retention(env),
    photos: Boolean(env.ANTHROPIC_API_KEY?.trim()),
    backupDays: backupDays(env),
    notice: legalNotice(env),
    consentStores: gatedStores(),
  };
}

/** The cookies a visitor can get today: the consent cookie only while something asks for consent. */
export function activeCookies(f: Pick<PolicyFacts, "consentStores">): CookieName[] {
  return (Object.keys(COOKIES) as CookieName[]).filter((c) => c !== CONSENT_COOKIE || f.consentStores.length > 0);
}

/** One privacy page's words, the same shape in each language. Text in `backticks` renders as code; {mail} and {impressum} are links. */
export type PolicyText = {
  meta: { title: string; description: string };
  page: {
    eyebrow: string;
    title: string;
    intro: string;
    loading: string;
    controllerHeading: string;
    collectHeading: string;
    logsHeading: string;
    cookiesHeading: string;
    storageHeading: string;
    processorsHeading: string;
    basesHeading: string;
    rightsHeading: string;
    choicesHeading: string;
  };
  controller: (notice: LegalNotice | null) => string[];
  collected: (f: PolicyFacts) => { lead: string; text: string }[];
  logs: (f: PolicyFacts) => string[];
  /** One paragraph per cookie, in COOKIES order, each naming it in backticks. */
  cookie: { [K in CookieName]: (days: number) => string };
  /** Before and after the cookies themselves. */
  cookiesIntro: (f: PolicyFacts) => string;
  cookiesAfter: (f: PolicyFacts) => string[];
  storage: string[];
  processors: (f: PolicyFacts) => string[];
  bases: (f: PolicyFacts) => string[];
  rights: string[];
  choices: string;
  whoRuns: string;
  impressumLink: string;
};

/** Every paragraph of a page's cookie section. */
export function cookieParagraphs(text: PolicyText, f: PolicyFacts): string[] {
  return [text.cookiesIntro(f), ...activeCookies(f).map((c) => text.cookie[c](COOKIES[c].days)), ...text.cookiesAfter(f)];
}

/** Every sentence a page can show for these facts, in order, for the tests. */
export function allParagraphs(text: PolicyText, f: PolicyFacts): string[] {
  return [
    ...Object.values(text.page),
    ...text.controller(f.notice),
    ...text.collected(f).flatMap((i) => [i.lead, i.text]),
    ...text.logs(f),
    ...cookieParagraphs(text, f),
    ...text.storage,
    ...text.processors(f),
    ...text.bases(f),
    ...text.rights,
    text.choices,
    text.whoRuns,
  ];
}
