import { and, asc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { MATCH_TYPE_META } from "./categories";
import { catalogueData, type CatalogueView } from "./catalog-data";
import { letterSettings } from "./letter-settings";
import { localFor, type Local } from "./localize";
import { log } from "./log";
import { esc, mailConfigured, sendMail } from "./mail";
import { button, COLORS, fullName, shell, tagged, textFooter, type Footer } from "./mail-layout";
import { listHeaders, unsubscribeUrl } from "./newsletter";
import type { Bundle, Pair } from "./types";
import { unitDisplay } from "./unit-format";

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
  const pairs = input.catalogue.pairs.filter((p) => local.shows(p) && !input.sent.has(pairKey(p.slug)));
  const kits = input.catalogue.bundles.filter((b) => local.shows(b) && !input.sent.has(kitKey(b.slug)));
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

/** A kit's name without the list of what's in it: "La Roche-Posay Breakout-Fighting Set - High Strength". */
function kitName(kit: Bundle) {
  return fullName(kit.bundle.brand, kit.bundle.name.split(":")[0].trim());
}

function pairLines(pair: Pair, local: Local, link: string) {
  const unit = unitDisplay(pair.brand.unit).label;
  const head = fullName(pair.alternative.brand, pair.alternative.product);
  const instead = `instead of ${fullName(pair.brand.brand, pair.brand.product)}`;
  const facts = `${MATCH_TYPE_META[pair.match_type].label}. ${Math.round(pair.savingsPct)}% less: ${local.unit(pair.alternative.ppu, pair.brand.unit, pair.currency)} against ${local.unit(pair.brand.ppu, pair.brand.unit, pair.currency)} ${unit}.`;
  const html = `<tr><td style="padding:14px 0;border-top:1px solid ${COLORS.line}">
<p style="margin:0;font-size:16px;line-height:1.35;font-weight:600"><a href="${esc(link)}" style="color:${COLORS.ink};text-decoration:none">${esc(head)}</a></p>
<p style="margin:2px 0 6px;font-size:14px;line-height:1.4;color:${COLORS.ink2}">${esc(instead)}</p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${COLORS.ink}">${esc(facts)}</p>
<p style="margin:0;font-size:14px"><a href="${esc(link)}" style="color:${COLORS.cobalt};text-decoration:underline">What matches and what differs</a></p>
</td></tr>`;
  return { html, text: [`* ${head}`, `  ${instead}`, `  ${facts}`, `  ${link}`].join("\n") };
}

function kitLines(kit: Bundle, local: Local, link: string) {
  const head = kitName(kit);
  const facts = `Rebuilt from ${kit.components.length} cheaper pieces for ${Math.round(kit.netSavingsPct)}% less: ${local.money(kit.equivalentTotal, kit.currency)} for the same amount, against ${local.money(kit.bundle.price, kit.currency)} for the kit.`;
  const html = `<tr><td style="padding:14px 0;border-top:1px solid ${COLORS.line}">
<p style="margin:0 0 6px;font-size:16px;line-height:1.35;font-weight:600"><a href="${esc(link)}" style="color:${COLORS.ink};text-decoration:none">${esc(head)}</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.45;color:${COLORS.ink}">${esc(facts)}</p>
<p style="margin:0;font-size:14px"><a href="${esc(link)}" style="color:${COLORS.cobalt};text-decoration:underline">See the pieces</a></p>
</td></tr>`;
  return { html, text: [`* ${head}`, `  ${facts}`, `  ${link}`].join("\n") };
}

/** The email for one issue. `token` is the subscriber's link token; a test send passes a placeholder. */
export function letterMail(issue: Issue, input: { to: string; token: string; issueKey: string; test?: boolean }, opts: LetterOpts) {
  const local = localFor(issue.country);
  const campaign = `weekly-${input.issueKey}`;
  const link = (path: string) => tagged(`${opts.siteUrl}${path}`, campaign);
  const sections: { title: string; rows: { html: string; text: string }[] }[] = [];
  if (issue.fresh.length) {
    sections.push({
      title: "New on the site",
      rows: issue.fresh.map((f) => (f.kind === "pair" ? pairLines(f.pair, local, link(`/compare/${f.pair.slug}`)) : kitLines(f.kit, local, link(`/bundle/${f.kit.slug}`)))),
    });
  }
  if (issue.biggest.length) {
    sections.push({ title: "Big savings you haven't had from us yet", rows: issue.biggest.map((p) => pairLines(p, local, link(`/compare/${p.slug}`))) });
  }
  if (issue.kits.length) {
    sections.push({ title: "Kits, rebuilt for less", rows: issue.kits.map((k) => kitLines(k, local, link(`/bundle/${k.slug}`))) });
  }
  const lead = issue.fresh[0] ?? (issue.biggest[0] ? { kind: "pair" as const, pair: issue.biggest[0] } : issue.kits[0] ? { kind: "kit" as const, kit: issue.kits[0] } : null);
  const total = issue.keys.length;
  const leadText = !lead
    ? "New swaps this week"
    : lead.kind === "pair"
      ? `${lead.pair.alternative.brand} instead of ${lead.pair.brand.brand}, ${Math.round(lead.pair.savingsPct)}% less`
      : `${kitName(lead.kit)}, ${Math.round(lead.kit.netSavingsPct)}% less`;
  const subject = `${input.test ? "[Test] " : ""}${leadText}${total > 1 ? `, and ${total - 1} more` : ""}`;
  const priceNote = `Prices are as we last checked them at the store. Where a price reads “about”, we converted it to ${local.known ? local.currency : "your currency"} at the ECB reference rate. Prices change between our checks: the store's own page has today's.`;
  const footer: Footer = {
    why: "You get this because you asked for new swaps from SameButCheaper and confirmed your address. One email a week at most.",
    stopThis: { label: "Unsubscribe from the weekly letter", url: unsubscribeUrl(opts.siteUrl, input.token, "letter") },
    stopAll: unsubscribeUrl(opts.siteUrl, input.token),
    siteUrl: opts.siteUrl,
    contactEmail: opts.contactEmail,
    postalAddress: opts.postalAddress,
  };
  const hasKits = issue.kits.length > 0 || issue.fresh.some((f) => f.kind === "kit");
  const intro = `${total} ${hasKits ? "swaps and kits" : total === 1 ? "swap" : "swaps"} you haven't had from us yet, each checked against at least two sources.`;
  const body =
    `<h1 style="margin:0 0 6px;font-size:22px;line-height:1.25">This week's swaps</h1>` +
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:${COLORS.ink2}">${esc(intro)}</p>` +
    sections
      .map(
        (s) =>
          `<h2 style="margin:22px 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:${COLORS.muted}">${esc(s.title)}</h2>` +
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${s.rows.map((r) => r.html).join("")}</table>`,
      )
      .join("") +
    `<p style="margin:22px 0 16px">${button("See every swap", link("/biggest-savings"))}</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted}">${esc(priceNote)}</p>`;
  const text = [
    "This week's swaps",
    intro,
    "",
    ...sections.flatMap((s) => [s.title.toUpperCase(), "", ...s.rows.map((r) => r.text + "\n")]),
    `See every swap: ${link("/biggest-savings")}`,
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
  | { status: "ran"; issue: string; sent: number; empty: number; failed: number };


/** Sends this week's issue to everyone who hasn't had it, up to the run's cap. Safe to run as often as you like. */
export async function runWeeklyLetter(
  db: DB,
  opts: { siteUrl: string; contactEmail: string; env?: Env; now?: Date; catalogue?: CatalogueView; pauseMs?: number },
): Promise<LetterRun> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const settings = letterSettings(env);
  if (!settings.on) return { status: "off" };
  if (!settings.postalAddress) return { status: "no-postal-address" };
  if (isoWeekday(now) < settings.weekday) return { status: "not-today" };
  const issueKey = isoWeek(now);
  const due = and(
    eq(subscribers.status, "confirmed"),
    eq(subscribers.newsletter, "yes"),
    sql`not exists (select 1 from ${sends} where ${sends.subscriberId} = ${subscribers.id} and ${sends.kind} = 'weekly' and ${sends.key} = ${issueKey})`,
  );
  if (!mailConfigured(env)) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(subscribers).where(due);
    if (n) log.info("letter.not_sent", { reason: "mail-not-configured", waiting: n, issue: issueKey });
    return { status: "no-mail", waiting: n };
  }
  const catalogue = opts.catalogue ?? catalogueData();
  const seen = await noteCatalogue(db, catalogue, now);
  const people = await db.select().from(subscribers).where(due).orderBy(asc(subscribers.id)).limit(settings.cap);
  const run = { status: "ran" as const, issue: issueKey, sent: 0, empty: 0, failed: 0 };
  for (const person of people) {
    if (!person.token) continue;
    const history = await db
      .select({ items: sends.items })
      .from(sends)
      .where(and(eq(sends.subscriberId, person.id), eq(sends.kind, "weekly"), eq(sends.status, "sent")));
    const sent = new Set(history.flatMap((h) => (Array.isArray(h.items) ? (h.items as string[]) : [])));
    const issue = buildIssue({ catalogue, country: person.country, sent, seen, now });
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
    const mail = letterMail(issue, { to: person.email, token: person.token, issueKey }, { ...opts, postalAddress: settings.postalAddress });
    const result = await sendMail({ ...mail, idempotencyKey: `weekly-${issueKey}-${person.id}` }, env);
    if (!result.ok) {
      await db.delete(sends).where(eq(sends.id, claim.id));
      run.failed++;
      continue;
    }
    await db.update(sends).set({ status: "sent", providerId: result.id, items: issue.keys }).where(eq(sends.id, claim.id));
    run.sent++;
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
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
