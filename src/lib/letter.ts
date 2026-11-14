import { createHash } from "node:crypto";
import { and, asc, eq, inArray, not, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { MATCH_TYPE_META } from "./categories";
import { catalogueData, type CatalogueView } from "./catalog-data";
import { legalNotice, NEEDS_LEGAL_NOTICE } from "./legal";
import { letterSettings } from "./letter-settings";
import { localFor, type Local } from "./localize";
import { log } from "./log";
import { esc, mailConfigured, sendMail } from "./mail";
import { BATCH_MAX, sendBatch } from "./mail-batch";
import { button, COLORS, fullName, readerLang, shell, sitePath, tagged, textFooter, yearlyNote, type Footer } from "./mail-layout";
import { listHeaders, unsubscribeUrl } from "./newsletter";
import type { Bundle, Pair } from "./types";
import { unitLabel } from "./unit-format";
import { getT } from "./i18n";
import type { Lang } from "./i18n/lang";
import { productName } from "./i18n/product-name";
import { kitMailable, pairMailable } from "./programme-terms";

/**
 * The weekly letter. Once a week, to every confirmed address that asked for it (subscribers.newsletter "yes"):
 * the newest swaps and kits and the biggest savings that address hasn't been sent before, in its own currency when
 * we know its country (src/lib/localize.ts), built from the catalogue only. No images, no tracking pixels; links to
 * our own pages carry utm_source=newsletter.
 *
 * Upkeep calls runWeeklyLetter every day. It does nothing until NEWSLETTER_WEEKLY=on, MAIL_POSTAL_ADDRESS is set
 * and email works, and nothing before NEWSLETTER_WEEKDAY (1 Monday to 7 Sunday, default 4) of each ISO week. Each
 * address gets an issue at most once a week: the send is claimed in `sends` under the week's key first.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;
const { subscribers, sends, appState } = schema;

/** "2026-W46" */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
export const isoWeekday = (d: Date) => d.getUTCDay() || 7;

/** When each catalogue record was first seen by upkeep, so "new" means new on the site, not newly priced. */
export type Seen = Record<string, string>;
const SEEN_KEY = "catalogue_seen";
const BEFORE_LETTERS = "1970-01-01";

const pairKey = (slug: string) => `p:${slug}`;
const kitKey = (slug: string) => `b:${slug}`;

/**
 * Records the first sighting of every record in the catalogue. The first time it runs, everything already there
 * counts as old, so the first letter isn't "new" from top to bottom.
 */
export async function noteCatalogue(db: DB, catalogue: CatalogueView, now: Date): Promise<Seen> {
  const [row] = await db.select().from(appState).where(eq(appState.key, SEEN_KEY)).limit(1);
  const first = !row;
  const seen: Seen = { ...((row?.value as Seen | undefined) ?? {}) };
  const today = now.toISOString().slice(0, 10);
  let added = 0;
  for (const key of [...catalogue.pairs.map((p) => pairKey(p.slug)), ...catalogue.bundles.map((b) => kitKey(b.slug))]) {
    if (!seen[key]) {
      seen[key] = first ? BEFORE_LETTERS : today;
      added++;
    }
  }
  if (added || first) {
    await db
      .insert(appState)
      .values({ key: SEEN_KEY, value: seen, updatedAt: now })
      .onConflictDoUpdate({ target: appState.key, set: { value: seen, updatedAt: now } });
  }
  return seen;
}

export type Issue = {
  country: string | null;
  fresh: ({ kind: "pair"; pair: Pair } | { kind: "kit"; kit: Bundle })[];
  biggest: Pair[];
  kits: Bundle[];
  /** Every record it carries, as "p:slug" and "b:slug". */
  keys: string[];
};

const NEW_DAYS = 8;

/** One subscriber's issue, or null when there's nothing they haven't had. */
export function buildIssue(input: { catalogue: CatalogueView; country: string | null; sent: ReadonlySet<string>; seen: Seen; now: Date }): Issue | null {
  const local = localFor(input.country);
  const since = new Date(input.now.getTime() - NEW_DAYS * 86400000).toISOString().slice(0, 10);
  const isNew = (key: string) => (input.seen[key] ?? BEFORE_LETTERS) >= since;
  // A record whose prices a store's affiliate terms withhold, or whose store bars email, is left out (programme-terms.ts).
  const pairs = input.catalogue.pairs.filter((p) => local.shows(p) && pairMailable(p) && !input.sent.has(pairKey(p.slug)));
  const kits = input.catalogue.bundles.filter((b) => local.shows(b) && kitMailable(b) && !input.sent.has(kitKey(b.slug)));
  const seenOn = (key: string) => input.seen[key] ?? BEFORE_LETTERS;

  const fresh: Issue["fresh"] = [
    ...pairs.filter((p) => isNew(pairKey(p.slug))).map((pair) => ({ kind: "pair" as const, pair, at: seenOn(pairKey(pair.slug)), pct: pair.savingsPct })),
    ...kits.filter((k) => isNew(kitKey(k.slug))).map((kit) => ({ kind: "kit" as const, kit, at: seenOn(kitKey(kit.slug)), pct: kit.netSavingsPct })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at) || b.pct - a.pct)
    .slice(0, 6)
    .map((f) => (f.kind === "pair" ? { kind: f.kind, pair: f.pair } : { kind: f.kind, kit: f.kit }));
  const inFresh = new Set(fresh.map((f) => (f.kind === "pair" ? pairKey(f.pair.slug) : kitKey(f.kit.slug))));

  const biggest = pairs
    .filter((p) => !inFresh.has(pairKey(p.slug)) && p.savingsPct >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const kitList = kits
    .filter((k) => !inFresh.has(kitKey(k.slug)) && k.netSavingsPct >= 10)
    .sort((a, b) => b.netSavingsPct - a.netSavingsPct)
    .slice(0, 2);
  const keys = [...inFresh, ...biggest.map((p) => pairKey(p.slug)), ...kitList.map((k) => kitKey(k.slug))];
  if (!keys.length) return null;
  return { country: input.country, fresh, biggest, kits: kitList, keys };
}

type LetterOpts = { siteUrl: string; contactEmail: string; postalAddress?: string | null };

/** A kit's name without the list of what's in it: "La Roche-Posay Breakout-Fighting Set - High Strength". German when the kit has it. */
function kitName(kit: Bundle, lang: Lang = "en") {
  const name = (lang === "de" && kit.de?.name) || kit.bundle.name;
  return fullName(kit.bundle.brand, name.split(":")[0].trim());
}

/** One swap as a letter (or a wish answer) lists it, with its yearly saving where that is honest (see yearlyNote). */
export function pairLines(pair: Pair, local: Local, link: string, lang: Lang = "en") {
  const t = getT(lang);
  const unit = unitLabel(pair.brand.unit, lang);
  const head = fullName(pair.alternative.brand, productName(pair.alternative.product, lang));
  const instead = t("mailLetter.instead", fullName(pair.brand.brand, productName(pair.brand.product, lang)));
  const yearly = yearlyNote(pair, local, lang);
  const match = lang === "en" ? MATCH_TYPE_META[pair.match_type].label : t(`match.${pair.match_type}.label`);
  const facts = t("mailLetter.facts", match, Math.round(pair.savingsPct), local.unit(pair.alternative.ppu, pair.brand.unit, pair.currency), local.unit(pair.brand.ppu, pair.brand.unit, pair.currency), unit);
  const html = `<tr><td style="padding:14px 0;border-top:1px solid ${COLORS.line}">
<p style="margin:0;font-size:16px;line-height:1.35;font-weight:600"><a href="${esc(link)}" style="color:${COLORS.ink};text-decoration:none">${esc(head)}</a></p>
<p style="margin:2px 0 6px;font-size:14px;line-height:1.4;color:${COLORS.ink2}">${esc(instead)}</p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${COLORS.ink}">${esc(facts)}</p>
${yearly ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.45;color:${COLORS.ink2}">${esc(yearly)}</p>\n` : ""}<p style="margin:0;font-size:14px"><a href="${esc(link)}" style="color:${COLORS.cobalt};text-decoration:underline">${t("mailLetter.whatMatches")}</a></p>
</td></tr>`;
  return { html, text: [`* ${head}`, `  ${instead}`, `  ${facts}`, ...(yearly ? [`  ${yearly}`] : []), `  ${link}`].join("\n") };
}

function kitLines(kit: Bundle, local: Local, link: string, lang: Lang = "en") {
  const t = getT(lang);
  const head = kitName(kit, lang);
  const facts = t("mailLetter.rebuilt", kit.components.length, Math.round(kit.netSavingsPct), local.money(kit.equivalentTotal, kit.currency), local.money(kit.bundle.price, kit.currency));
  const html = `<tr><td style="padding:14px 0;border-top:1px solid ${COLORS.line}">
<p style="margin:0 0 6px;font-size:16px;line-height:1.35;font-weight:600"><a href="${esc(link)}" style="color:${COLORS.ink};text-decoration:none">${esc(head)}</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${COLORS.ink}">${esc(facts)}</p>
<p style="margin:0;font-size:14px"><a href="${esc(link)}" style="color:${COLORS.cobalt};text-decoration:underline">${t("mailLetter.seePieces")}</a></p>
</td></tr>`;
  return { html, text: [`* ${head}`, `  ${facts}`, `  ${link}`].join("\n") };
}

/** The email for one issue. `token` is the subscriber's link token; a test send passes a placeholder. */
export function letterMail(issue: Issue, input: { to: string; token: string; issueKey: string; test?: boolean; lang?: Lang }, opts: LetterOpts) {
  const lang = input.lang ?? "en";
  const t = getT(lang);
  const local = localFor(issue.country, false, lang);
  const campaign = `weekly-${input.issueKey}`;
  const link = (path: string) => tagged(`${opts.siteUrl}${sitePath(path, lang)}`, campaign);
  const sections: { title: string; rows: { html: string; text: string }[] }[] = [];
  if (issue.fresh.length) {
    sections.push({
      title: t("mailLetter.newOnSite"),
      rows: issue.fresh.map((f) => (f.kind === "pair" ? pairLines(f.pair, local, link(`/compare/${f.pair.slug}`), lang) : kitLines(f.kit, local, link(`/bundle/${f.kit.slug}`), lang))),
    });
  }
  if (issue.biggest.length) {
    sections.push({ title: t("mailLetter.bigSavings"), rows: issue.biggest.map((p) => pairLines(p, local, link(`/compare/${p.slug}`), lang)) });
  }
  if (issue.kits.length) {
    sections.push({ title: t("mailLetter.kits"), rows: issue.kits.map((k) => kitLines(k, local, link(`/bundle/${k.slug}`), lang)) });
  }
  const lead = issue.fresh[0] ?? (issue.biggest[0] ? { kind: "pair" as const, pair: issue.biggest[0] } : issue.kits[0] ? { kind: "kit" as const, kit: issue.kits[0] } : null);
  const total = issue.keys.length;
  const leadText = !lead
    ? t("mailLetter.leadNone")
    : lead.kind === "pair"
      ? t("mailLetter.leadPair", lead.pair.alternative.brand, lead.pair.brand.brand, Math.round(lead.pair.savingsPct))
      : t("mailLetter.leadKit", kitName(lead.kit, lang), Math.round(lead.kit.netSavingsPct));
  const subject = `${input.test ? t("mailLetter.test") : ""}${leadText}${total > 1 ? t("mailLetter.andMore", total - 1) : ""}`;
  const priceNote = t("mailLetter.priceNote", local.known ? local.currency : null);
  const footer: Footer = {
    why: t("mailLetter.why"),
    stopThis: { label: t("mailLetter.stopThis"), url: unsubscribeUrl(opts.siteUrl, input.token, "letter", lang) },
    stopAll: unsubscribeUrl(opts.siteUrl, input.token, undefined, lang),
    siteUrl: opts.siteUrl,
    contactEmail: opts.contactEmail,
    postalAddress: opts.postalAddress,
    lang,
  };
  const hasKits = issue.kits.length > 0 || issue.fresh.some((f) => f.kind === "kit");
  const intro = t("mailLetter.intro", total, hasKits);
  const body =
    `<h1 style="margin:0 0 6px;font-size:22px;line-height:1.25">${t("mailLetter.heading")}</h1>` +
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:${COLORS.ink2}">${esc(intro)}</p>` +
    sections
      .map(
        (s) =>
          `<h2 style="margin:22px 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.muted}">${esc(s.title)}</h2>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.rows.map((r) => r.html).join("")}</table>`,
      )
      .join("") +
    `<p style="margin:22px 0 16px">${button(t("mailLetter.seeEvery"), link("/biggest-savings"))}</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted}">${esc(priceNote)}</p>`;
  const text = [
    t("mailLetter.heading"),
    intro,
    "",
    ...sections.flatMap((s) => [s.title.toUpperCase(), "", ...s.rows.map((r) => r.text + "\n")]),
    `${t("mailLetter.seeEvery")}: ${link("/biggest-savings")}`,
    "",
    priceNote,
    "",
    textFooter(footer),
  ].join("\n");
  return { to: input.to, subject, text, html: shell({ title: subject, preheader: intro, body, footer }), headers: listHeaders(opts.siteUrl, input.token, "letter") };
}

export { letterSettings };

export type LetterRun =
  | { status: "off" | "no-postal-address" | "not-today" }
  | { status: "no-mail"; waiting: number }
  /** `held`: readers in DE or AT waiting for the legal notice (src/lib/legal.ts). */
  | { status: "ran"; issue: string; sent: number; empty: number; failed: number; held: number };

/** A stable key for one batch: the issue and exactly who is in it, so a retry of the same batch is the same request. */
function batchKey(issueKey: string, ids: number[]) {
  return `weekly-${issueKey}-${createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 32)}`;
}

/**
 * Sends this week's issue to everyone who hasn't had it, up to the run's cap. Safe to run as often as you like.
 *
 * Each reader's letter is claimed in `sends` (unique per reader, kind and week) before anything is sent, so two runs
 * at once, or a run after a crash, never send it twice. Claimed letters go to Resend in batches of up to 100 (one
 * request each, keyed on the issue and its readers). A refused batch (nothing sent) is retried one email at a time;
 * a failed or unanswered one releases its claims, and the next run tries those readers again.
 */
export async function runWeeklyLetter(
  db: DB,
  opts: { siteUrl: string; contactEmail: string; env?: Env; now?: Date; catalogue?: CatalogueView; pauseMs?: number; batchSize?: number },
): Promise<LetterRun> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const settings = letterSettings(env);
  if (!settings.on) return { status: "off" };
  if (!settings.postalAddress) return { status: "no-postal-address" };
  if (isoWeekday(now) < settings.weekday) return { status: "not-today" };
  const issueKey = isoWeek(now);
  const notYet = sql`not exists (select 1 from ${sends} where ${sends.subscriberId} = ${subscribers.id} and ${sends.kind} = 'weekly' and ${sends.key} = ${issueKey})`;
  const readers = and(eq(subscribers.status, "confirmed"), eq(subscribers.newsletter, "yes"), notYet);
  // Without a published legal notice, German and Austrian readers wait (src/lib/legal.ts).
  const legal = legalNotice(env);
  const inHeldCountry = inArray(sql`coalesce(${subscribers.country}, '')`, [...NEEDS_LEGAL_NOTICE]);
  const due = legal ? readers : and(readers, not(inHeldCountry));
  const [{ n: held }] = legal
    ? [{ n: 0 }]
    : await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(subscribers).where(and(readers, inHeldCountry));
  if (held) log.info("letter.held_back", { reason: "no-legal-notice", held, issue: issueKey });
  if (!mailConfigured(env)) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(subscribers).where(due);
    if (n) log.info("letter.not_sent", { reason: "mail-not-configured", waiting: n, issue: issueKey });
    return { status: "no-mail", waiting: n };
  }
  const catalogue = opts.catalogue ?? catalogueData();
  const seen = await noteCatalogue(db, catalogue, now);
  const people = await db.select().from(subscribers).where(due).orderBy(asc(subscribers.id)).limit(settings.cap);
  const run = { status: "ran" as const, issue: issueKey, sent: 0, empty: 0, failed: 0, held };
  const size = Math.max(1, Math.min(BATCH_MAX, opts.batchSize ?? BATCH_MAX));
  const letterOpts = { ...opts, postalAddress: settings.postalAddress };

  for (let at = 0; at < people.length; at += size) {
    const ready: { claim: number; person: (typeof people)[number]; issue: Issue; mail: ReturnType<typeof letterMail> }[] = [];
    for (const person of people.slice(at, at + size)) {
      if (!person.token) continue;
      const history = await db
        .select({ items: sends.items })
        .from(sends)
        .where(and(eq(sends.subscriberId, person.id), eq(sends.kind, "weekly"), eq(sends.status, "sent")));
      const had = new Set(history.flatMap((h) => (Array.isArray(h.items) ? (h.items as string[]) : [])));
      const issue = buildIssue({ catalogue, country: person.country, sent: had, seen, now });
      const [claim] = await db
        .insert(sends)
        .values({ subscriberId: person.id, kind: "weekly", key: issueKey, status: issue ? "sending" : "empty", createdAt: now })
        .onConflictDoNothing()
        .returning({ id: sends.id });
      if (!claim) continue;
      if (!issue) {
        run.empty++;
        continue;
      }
      ready.push({ claim: claim.id, person, issue, mail: letterMail(issue, { to: person.email, token: person.token, issueKey, lang: readerLang(person.lang) }, letterOpts) });
    }
    if (!ready.length) continue;

    const done = async (r: (typeof ready)[number], id: string | null) => {
      await db.update(sends).set({ status: "sent", providerId: id, items: r.issue.keys }).where(eq(sends.id, r.claim));
      run.sent++;
    };
    const release = async (r: (typeof ready)[number]) => {
      await db.delete(sends).where(eq(sends.id, r.claim));
      run.failed++;
    };
    const oneByOne = async () => {
      for (const r of ready) {
        const result = await sendMail({ ...r.mail, idempotencyKey: `weekly-${issueKey}-${r.person.id}` }, env);
        if (result.ok) await done(r, result.id);
        else await release(r);
        if (opts.pauseMs) await new Promise((res) => setTimeout(res, opts.pauseMs));
      }
    };

    if (ready.length === 1) {
      await oneByOne();
      continue;
    }
    const result = await sendBatch(
      ready.map((r) => r.mail),
      batchKey(issueKey, ready.map((r) => r.person.id)),
      env,
    );
    if (result.ok) {
      for (const [i, r] of ready.entries()) await done(r, result.ids[i]);
    } else if (result.reason === "invalid") {
      // Resend refused the whole batch, so none of it went: send each on its own, so one bad address can't hold up the rest.
      await oneByOne();
    } else {
      for (const r of ready) await release(r);
    }
    if (opts.pauseMs) await new Promise((res) => setTimeout(res, opts.pauseMs));
  }
  if (run.failed) log.warn("letter.some_failed", { issue: issueKey, failed: run.failed });
  return run;
}

/** A placeholder token for test sends: the links in a test email look real but do nothing. */
export const TEST_TOKEN = "test-send-links-do-nothing";

/** The issue a brand-new subscriber in `country` would get today. For previews and test sends. */
export async function sampleIssue(db: DB | null, country: string | null, now = new Date(), catalogue = catalogueData()) {
  const seen = db ? await noteCatalogue(db, catalogue, now) : {};
  return buildIssue({ catalogue, country, sent: new Set(), seen, now });
}
