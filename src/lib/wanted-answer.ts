import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { catalogueData, type CatalogueView } from "./catalog-data";
import { noteCatalogue, pairLines, type Seen } from "./letter";
import { localFor } from "./localize";
import { log } from "./log";
import { esc, mailConfigured, sendMail } from "./mail";
import { button, COLORS, readerLang, shell, sitePath, tagged, textFooter, type Footer } from "./mail-layout";
import { getT } from "./i18n";
import type { Lang } from "./i18n/lang";
import { listHeaders, unsubscribeUrl } from "./newsletter";
import type { Pair } from "./types";
import { searchFields, wishMatcher } from "./wanted-match";

/**
 * Answers "tell me when you add it". Daily upkeep looks for active, confirmed requests that a swap now answers
 * (src/lib/wanted-match.ts: the site search must find it and the words must name the product), and writes to each
 * person once with the swap, then ends the request. Only a swap that went live on or after the day they asked
 * counts ("first seen" by upkeep, as the weekly letter keeps it), and only one their country lists.
 *
 * Each email is claimed in `sends` (kind "wish", key "wish-<id>") before it goes, so a second run, or two at once,
 * can't send it twice. At most `limit` a run; the rest go on the next.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;
const { wishes, subscribers, sends } = schema;

/** Most swaps one answer lists. */
const SHOW = 3;

type MailOpts = { siteUrl: string; contactEmail: string; postalAddress?: string | null };

export function wishMail(input: { to: string; token: string; query: string; country: string | null; lang?: Lang; pairs: Pair[] }, opts: MailOpts) {
  const lang = input.lang ?? "en";
  const t = getT(lang);
  const local = localFor(input.country, false, lang);
  const campaign = "wish-answered";
  const lead = input.pairs[0];
  const subject = t("mailWish.subject", input.query);
  const intro = t("mailWish.intro", input.query, input.pairs.length);
  const rows = input.pairs.map((p) => pairLines(p, local, tagged(`${opts.siteUrl}${sitePath(`/compare/${p.slug}`, lang)}`, campaign), lang));
  const footer: Footer = {
    why: t("mailWish.why", input.query),
    stopAll: unsubscribeUrl(opts.siteUrl, input.token),
    siteUrl: opts.siteUrl,
    contactEmail: opts.contactEmail,
    postalAddress: opts.postalAddress,
    lang,
  };
  const more = tagged(`${opts.siteUrl}${sitePath("/search", lang)}?q=${encodeURIComponent(input.query)}`, campaign);
  const priceNote = t("mailWish.priceNote");
  const body =
    `<h1 style="margin:0 0 8px;font-size:21px;line-height:1.3">${esc(subject)}</h1>` +
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:${COLORS.ink2}">${esc(intro)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map((r) => r.html).join("")}</table>` +
    `<p style="margin:18px 0 16px">${button(t("mailWish.seeAll"), more)}</p>` +
    `<p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.muted}">${esc(priceNote)}</p>`;
  const text = [subject, "", intro, "", ...rows.map((r) => r.text + "\n"), `${t("mailWish.seeAll")}: ${more}`, "", priceNote, "", textFooter(footer)].join("\n");
  return {
    to: input.to,
    subject,
    text,
    html: shell({ title: subject, preheader: t("mailWish.preheader", lead.alternative.brand, lead.brand.brand), body, footer }),
    headers: listHeaders(opts.siteUrl, input.token),
  };
}

export type WishRun = { waiting: number; matched: number; sent: number; notSent: number };

/** The swaps that answer one request: matched, listed in its country, and live since the day it was asked. */
export function answersFor(
  wish: { query: string; country: string | null; createdAt: Date },
  match: (q: string) => { slug: string }[],
  bySlug: Map<string, Pair>,
  seen: Seen,
): Pair[] {
  const local = localFor(wish.country);
  const asked = wish.createdAt.toISOString().slice(0, 10);
  return match(wish.query)
    .map((s) => bySlug.get(s.slug))
    .filter((p): p is Pair => Boolean(p && local.shows(p) && (seen[`p:${p.slug}`] ?? "1970-01-01") >= asked))
    .slice(0, SHOW);
}

export async function runWishAnswers(db: DB, opts: MailOpts & { env?: Env; now?: Date; catalogue?: CatalogueView; limit?: number; pauseMs?: number }): Promise<WishRun> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const catalogue = opts.catalogue ?? catalogueData();
  const limit = opts.limit ?? 100;
  const rows = await db
    .select({ wish: wishes, sub: subscribers })
    .from(wishes)
    .innerJoin(subscribers, eq(subscribers.id, wishes.subscriberId))
    .where(and(eq(wishes.status, "active"), eq(subscribers.status, "confirmed")))
    .orderBy(asc(wishes.id));
  const run: WishRun = { waiting: rows.length, matched: 0, sent: 0, notSent: 0 };
  if (!rows.length) return run;
  const seen = await noteCatalogue(db, catalogue, now);
  const bySlug = new Map(catalogue.pairs.map((p) => [p.slug, p]));
  const match = wishMatcher(catalogue.pairs.map(searchFields));
  const canSend = mailConfigured(env);
  for (const { wish, sub } of rows) {
    const pairs = answersFor({ query: wish.query, country: wish.country ?? sub.country, createdAt: wish.createdAt }, match, bySlug, seen);
    if (!pairs.length) continue;
    run.matched++;
    if (!canSend || !sub.token) {
      run.notSent++;
      log.info("wish.answer_not_sent", { wish: wish.id, slug: pairs[0].slug, reason: "mail-not-configured" });
      continue;
    }
    if (run.sent >= limit) continue;
    const key = `wish-${wish.id}`;
    const [claim] = await db
      .insert(sends)
      .values({ subscriberId: sub.id, kind: "wish", key, status: "sending", items: pairs.map((p) => `p:${p.slug}`), createdAt: now })
      .onConflictDoNothing()
      .returning({ id: sends.id });
    if (claim) {
      const mail = wishMail({ to: sub.email, token: sub.token, query: wish.query, country: wish.country ?? sub.country, lang: readerLang(sub.lang), pairs }, opts);
      const result = await sendMail({ ...mail, idempotencyKey: key }, env);
      if (!result.ok) {
        await db.delete(sends).where(eq(sends.id, claim.id));
        log.warn("wish.send_failed", { wish: wish.id, reason: result.reason });
        continue;
      }
      await db.update(sends).set({ status: "sent", providerId: result.id }).where(eq(sends.id, claim.id));
      run.sent++;
    }
    // Sent now, or already sent by a run that stopped before this: either way the request is answered.
    await db.update(wishes).set({ status: "answered", stoppedAt: now, answeredSlug: pairs[0].slug }).where(eq(wishes.id, wish.id));
    if (claim && opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  }
  return run;
}
