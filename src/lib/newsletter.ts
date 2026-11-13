import { randomBytes } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { esc, mailConfigured, sendMail } from "./mail";

/**
 * Everything we email, with double opt-in. An address is stored as "pending" and gets one email with a confirm
 * link; only after that link is followed is it "confirmed". Each thing an address can get is consented to on its
 * own, with its own link:
 *  - "letter": the weekly letter (subscribers.newsletter);
 *  - "watch-<id>": one swap's price watch (watches);
 *  - "wish-<id>": "tell me when you add it" for one search (wishes).
 * A request for any of them starts "pending" and only its own link turns it on, so typing someone else's address
 * into a form, even one already confirmed for something else, can never start mail they didn't ask for. German law
 * (UWG §7) in practice requires this proof, and it keeps typos and other people's addresses off the list.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;
const subs = schema.subscribers;
const { watches, wishes, sends } = schema;

/** A second confirmation email for the same thing waits this long, so the form can't be used to flood an inbox. */
const RESEND_AFTER_MS = 10 * 60_000;
/** And one address gets at most this many confirmation emails a day, whatever they are for. */
const CONFIRMS_PER_DAY = 5;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);
const newToken = () => randomBytes(24).toString("base64url");

/** What a link acts on: the weekly letter, one watch or one wish. No scope means the letter (confirm) or everything (unsubscribe). */
export type Scope = "letter" | `watch-${number}` | `wish-${number}`;
const SCOPE = /^(letter|watch-\d{1,9}|wish-\d{1,9})$/;
export const isScope = (v: unknown): v is Scope => typeof v === "string" && SCOPE.test(v);
function parseScope(scope: Scope): { kind: "letter" } | { kind: "watch" | "wish"; id: number } {
  if (scope === "letter") return { kind: "letter" };
  const [kind, id] = scope.split("-");
  return { kind: kind as "watch" | "wish", id: Number(id) };
}

export type SubscribeOutcome =
  /** A confirmation email went out. */
  | "sent"
  /** Saved, but email isn't set up yet (or the send failed); upkeep sends the confirmation later. */
  | "stored"
  /** Already on, or a confirmation went out minutes ago: nothing new happened. */
  | "unchanged";

type Row = typeof subs.$inferSelect;
type Opts = { siteUrl: string; env?: Env; now?: Date };

const cleanCountry = (c: string | null | undefined) => (c && /^[A-Z]{2}$/.test(c) ? c : null);

/**
 * The subscriber row for an address, made if new. Someone who unsubscribed from everything and asks again starts
 * over as pending, with nothing switched on. `letter` says whether this request is for the weekly letter.
 */
async function subscriberFor(db: DB, input: { email: string; source?: string | null; country?: string | null }, letter: boolean): Promise<Row | null> {
  const email = input.email.trim().toLowerCase();
  const country = cleanCountry(input.country);
  await db
    .insert(subs)
    .values({ email, source: input.source?.slice(0, 64) ?? "site", country, status: "pending", token: newToken(), newsletter: letter ? "pending" : "no" })
    .onConflictDoNothing();
  const [found] = await db.select().from(subs).where(eq(subs.email, email)).limit(1);
  if (!found) return null;
  if (found.status === "unsubscribed" || !found.token) {
    const [row] = await db
      .update(subs)
      .set({
        status: "pending",
        token: found.token ?? newToken(),
        newsletter: "no",
        unsubscribedAt: null,
        confirmedAt: null,
        confirmSentAt: null,
        letterConfirmedAt: null,
        country: country ?? found.country,
      })
      .where(eq(subs.id, found.id))
      .returning();
    return row;
  }
  if (!found.country && country) await db.update(subs).set({ country }).where(eq(subs.id, found.id));
  return { ...found, country: found.country ?? country };
}

/** Asks for the weekly letter. */
export async function subscribeEmail(
  db: DB,
  input: { email: string; source?: string | null; country?: string | null },
  opts: Opts,
): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  let row = await subscriberFor(db, input, true);
  if (!row) return "stored";
  if (row.newsletter === "yes" && row.status === "confirmed") return "unchanged";
  if (row.newsletter !== "pending") {
    [row] = await db.update(subs).set({ newsletter: "pending", confirmSentAt: null }).where(eq(subs.id, row.id)).returning();
  }
  if (row.confirmSentAt && now.getTime() - row.confirmSentAt.getTime() < RESEND_AFTER_MS) return "unchanged";
  return (await sendConfirmation(db, row, { kind: "letter" }, opts)) ? "sent" : "stored";
}

/** A swap's prices, as a watch stores them. From the catalogue record, see src/lib/watches.ts. */
export type WatchPrices = {
  currency: string;
  unit: string;
  altPrice: number;
  altPpu: number;
  brandPpu: number;
  savingsPct: number;
  priceChecked: string | null;
};

/** Most watches one address can hold, so the form can't be used to fill the table. */
const MAX_WATCHES = 50;
const MAX_WISHES = 30;

/** Asks for a price watch on one swap. Nothing is sent about it until its own confirm link is followed. */
export async function requestWatch(
  db: DB,
  input: { email: string; country?: string | null; slug: string; title: string; prices: WatchPrices },
  opts: Opts,
): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  const row = await subscriberFor(db, { email: input.email, country: input.country, source: "watch" }, false);
  if (!row) return "stored";
  const values = { ...priceColumns(input.prices), title: input.title.slice(0, 200) };
  const [existing] = await db.select().from(watches).where(and(eq(watches.subscriberId, row.id), eq(watches.slug, input.slug))).limit(1);
  let watch = existing;
  if (!watch) {
    const [{ n }] = await db.select({ n: count() }).from(watches).where(eq(watches.subscriberId, row.id));
    if (n >= MAX_WATCHES) return "unchanged";
    [watch] = await db
      .insert(watches)
      .values({ subscriberId: row.id, slug: input.slug, status: "pending", ...values })
      .onConflictDoNothing()
      .returning();
    if (!watch) return "unchanged";
  } else if (watch.status === "active") {
    return "unchanged";
  } else if (watch.status !== "pending") {
    // Stopped or ended before: watching again starts from today's prices, and needs its link again.
    [watch] = await db
      .update(watches)
      .set({ status: "pending", ...values, confirmSentAt: null, confirmedAt: null, stoppedAt: null, lastNotifiedAt: null, createdAt: now })
      .where(eq(watches.id, watch.id))
      .returning();
  }
  if (watch.confirmSentAt && now.getTime() - watch.confirmSentAt.getTime() < RESEND_AFTER_MS) return "unchanged";
  return (await sendConfirmation(db, row, { kind: "watch", id: watch.id, title: input.title }, opts)) ? "sent" : "stored";
}

export function priceColumns(p: WatchPrices) {
  return {
    currency: p.currency.slice(0, 3),
    unit: p.unit.slice(0, 24),
    altPrice: String(p.altPrice),
    altPpu: String(p.altPpu),
    brandPpu: String(p.brandPpu),
    savingsPct: p.savingsPct.toFixed(2),
    priceChecked: p.priceChecked?.slice(0, 16) ?? null,
  };
}

/** Asks to be told when we add a swap for a search that found nothing. `query` is already normalised (src/lib/wanted.ts). */
export async function requestWish(db: DB, input: { email: string; country?: string | null; query: string }, opts: Opts): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  const row = await subscriberFor(db, { email: input.email, country: input.country, source: "wish" }, false);
  if (!row) return "stored";
  const [existing] = await db.select().from(wishes).where(and(eq(wishes.subscriberId, row.id), eq(wishes.query, input.query))).limit(1);
  let wish = existing;
  if (!wish) {
    const [{ n }] = await db.select({ n: count() }).from(wishes).where(eq(wishes.subscriberId, row.id));
    if (n >= MAX_WISHES) return "unchanged";
    [wish] = await db
      .insert(wishes)
      .values({ subscriberId: row.id, query: input.query, country: cleanCountry(input.country), status: "pending" })
      .onConflictDoNothing()
      .returning();
    if (!wish) return "unchanged";
  } else if (wish.status === "active") {
    return "unchanged";
  } else if (wish.status !== "pending") {
    [wish] = await db
      .update(wishes)
      .set({ status: "pending", confirmSentAt: null, confirmedAt: null, stoppedAt: null, createdAt: now })
      .where(eq(wishes.id, wish.id))
      .returning();
  }
  if (wish.confirmSentAt && now.getTime() - wish.confirmSentAt.getTime() < RESEND_AFTER_MS) return "unchanged";
  return (await sendConfirmation(db, row, { kind: "wish", id: wish.id, query: input.query }, opts)) ? "sent" : "stored";
}

type Purpose = { kind: "letter" } | { kind: "watch"; id: number; title: string } | { kind: "wish"; id: number; query: string };
const scopeOf = (p: Purpose): Scope => (p.kind === "letter" ? "letter" : `${p.kind}-${p.id}`);

async function sendConfirmation(db: DB, row: Row, purpose: Purpose, opts: Opts): Promise<boolean> {
  if (!row.token || !mailConfigured(opts.env)) return false;
  const now = opts.now ?? new Date();
  const [{ n }] = await db
    .select({ n: count() })
    .from(sends)
    .where(and(eq(sends.subscriberId, row.id), eq(sends.kind, "confirm"), gte(sends.createdAt, new Date(now.getTime() - 24 * 3600_000))));
  if (n >= CONFIRMS_PER_DAY) return false;
  const result = await sendMail(confirmationMail(row.email, row.token, opts.siteUrl, purpose, now), opts.env);
  if (!result.ok) return false;
  await db
    .insert(sends)
    .values({ subscriberId: row.id, kind: "confirm", key: `${scopeOf(purpose)}:${now.toISOString()}`, status: "sent", providerId: result.id, createdAt: now })
    .onConflictDoNothing();
  if (purpose.kind === "letter") await db.update(subs).set({ confirmSentAt: now }).where(eq(subs.id, row.id));
  else if (purpose.kind === "watch") await db.update(watches).set({ confirmSentAt: now }).where(eq(watches.id, purpose.id));
  else await db.update(wishes).set({ confirmSentAt: now }).where(eq(wishes.id, purpose.id));
  return true;
}

const scopeParam = (scope?: Scope) => (scope && scope !== "letter" ? `&for=${scope}` : "");
const scopeOnly = (scope?: Scope) => (scope ? `&only=${scope}` : "");

/** The link in a confirmation email. The letter's has no scope, as before scopes existed. */
export function confirmUrl(siteUrl: string, token: string, scope?: Scope) {
  return `${siteUrl}/api/newsletter/confirm?token=${encodeURIComponent(token)}${scopeParam(scope)}`;
}
/** The page with the "unsubscribe" button, for people. With a scope it offers to stop just that, or everything. */
export function unsubscribeUrl(siteUrl: string, token: string, scope?: Scope) {
  return `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}${scopeOnly(scope)}`;
}
/** Where mail apps POST for one-click unsubscribe (RFC 8058). With a scope it stops just that; without, everything. */
export function oneClickUrl(siteUrl: string, token: string, scope?: Scope) {
  return `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}${scopeOnly(scope)}`;
}

/**
 * Headers every list email carries, so Gmail and others show their own unsubscribe button. A letter or a watch
 * notice passes its scope, so that button stops the list the email came from (RFC 8058); the email's own footer
 * links to stopping everything as well.
 */
export function listHeaders(siteUrl: string, token: string, scope?: Scope) {
  return { "List-Unsubscribe": `<${oneClickUrl(siteUrl, token, scope)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** The confirmation email. It only asks for the confirmation: an advert in it would itself be unsolicited mail. */
export function confirmationMail(email: string, token: string, siteUrl: string, purpose: Purpose = { kind: "letter" }, now = new Date()) {
  const scope = scopeOf(purpose);
  const link = confirmUrl(siteUrl, token, purpose.kind === "letter" ? undefined : scope);
  const host = siteUrl.replace(/^https?:\/\//, "");
  const asked =
    purpose.kind === "letter"
      ? "to get new swaps from SameButCheaper"
      : purpose.kind === "watch"
        ? `to get an email from SameButCheaper if the swap “${purpose.title}” changes price or is withdrawn`
        : `to get an email from SameButCheaper when we add a swap for “${purpose.query}”`;
  const button = purpose.kind === "letter" ? "Yes, send me new swaps" : purpose.kind === "watch" ? "Yes, watch this swap" : "Yes, tell me";
  const subject =
    purpose.kind === "letter" ? "Confirm your email for SameButCheaper" : purpose.kind === "watch" ? "Confirm your price watch on SameButCheaper" : "Confirm your request on SameButCheaper";
  const text = [
    "Please confirm your email address",
    "",
    `Someone, hopefully you, asked ${asked} (${host}) at this address.`,
    "",
    "Confirm it here:",
    link,
    "",
    "If that wasn't you, ignore this email. You won't hear from us about it again, and the request is removed after 30 days.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e1da;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#666">SameButCheaper</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">Please confirm your email address</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">Someone, hopefully you, asked ${esc(asked)} (${esc(host)}) at this address.</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1f4fd8;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:8px">${esc(button)}</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#666">Or paste this link into your browser:<br><a href="${esc(link)}" style="color:#1f4fd8;word-break:break-all">${esc(link)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#666">If that wasn't you, ignore this email. You won't hear from us about it again, and the request is removed after 30 days.</p>
</div></body></html>`;
  return {
    to: email,
    subject,
    text,
    html,
    headers: listHeaders(siteUrl, token),
    // One per address and purpose per ten minutes, matching the resend wait.
    idempotencyKey: `confirm-${token}-${scope}-${Math.floor(now.getTime() / RESEND_AFTER_MS)}`,
  };
}

export type TokenOutcome = "done" | "already" | "invalid";

/**
 * Follows a confirm link: switches on what it was for (the letter when no scope is given), and confirms the
 * address if it was pending. Following it twice is fine. A link for something that was stopped since, or from an
 * address that unsubscribed from everything, does nothing.
 */
export async function confirmSubscription(db: DB, token: string, now = new Date(), scope?: Scope): Promise<TokenOutcome> {
  if (!isToken(token)) return "invalid";
  if (scope !== undefined && !isScope(scope)) return "invalid";
  const target = parseScope(scope ?? "letter");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(subs).where(eq(subs.token, token)).limit(1).for("update");
    if (!row || row.status === "unsubscribed") return "invalid";
    let state: "pending" | "on" | "off";
    if (target.kind === "letter") {
      state = row.newsletter === "pending" ? "pending" : row.newsletter === "yes" ? "on" : "off";
      if (state === "pending") await tx.update(subs).set({ newsletter: "yes", letterConfirmedAt: now }).where(eq(subs.id, row.id));
    } else {
      const table = target.kind === "watch" ? watches : wishes;
      const [item] = await tx
        .select({ status: table.status })
        .from(table)
        .where(and(eq(table.id, target.id), eq(table.subscriberId, row.id)))
        .limit(1);
      state = item?.status === "pending" ? "pending" : item?.status === "active" ? "on" : "off";
      if (state === "pending") await tx.update(table).set({ status: "active", confirmedAt: now }).where(eq(table.id, target.id));
    }
    if (state === "off") return "invalid";
    if (state === "pending" && row.status === "pending") {
      await tx.update(subs).set({ status: "confirmed", confirmedAt: now, unsubscribedAt: null }).where(eq(subs.id, row.id));
    }
    return state === "pending" ? "done" : "already";
  });
}

/**
 * Stops mail. Without a scope, everything for the address: the row stays as "unsubscribed" so nothing is sent to
 * it by mistake later, and its watches and wishes stop. With one, just the letter, that watch or that wish.
 */
export async function unsubscribe(db: DB, token: string, now = new Date(), scope?: Scope): Promise<TokenOutcome> {
  if (!isToken(token)) return "invalid";
  if (scope !== undefined && !isScope(scope)) return "invalid";
  const [row] = await db.select().from(subs).where(eq(subs.token, token)).limit(1);
  if (!row) return "invalid";
  if (!scope) {
    return db.transaction(async (tx) => {
      const done = await tx
        .update(subs)
        .set({ status: "unsubscribed", unsubscribedAt: now, newsletter: "no" })
        .where(and(eq(subs.id, row.id), or(eq(subs.status, "pending"), eq(subs.status, "confirmed"))))
        .returning({ id: subs.id });
      for (const table of [watches, wishes]) {
        await tx
          .update(table)
          .set({ status: "stopped", stoppedAt: now })
          .where(and(eq(table.subscriberId, row.id), inArray(table.status, ["pending", "active"])));
      }
      return done.length ? "done" : "already";
    });
  }
  const target = parseScope(scope);
  if (target.kind === "letter") {
    const done = await db
      .update(subs)
      .set({ newsletter: "no" })
      .where(and(eq(subs.id, row.id), ne(subs.newsletter, "no")))
      .returning({ id: subs.id });
    return done.length ? "done" : "already";
  }
  const table = target.kind === "watch" ? watches : wishes;
  const [item] = await db
    .select({ status: table.status })
    .from(table)
    .where(and(eq(table.id, target.id), eq(table.subscriberId, row.id)))
    .limit(1);
  if (!item) return "invalid";
  if (item.status !== "pending" && item.status !== "active") return "already";
  await db.update(table).set({ status: "stopped", stoppedAt: now }).where(eq(table.id, target.id));
  return "done";
}

/**
 * Sends the confirmation for requests that never got one (stored before email was set up, or when a send failed).
 * Called by upkeep; a small batch at a time keeps well inside a new sender's daily allowance.
 */
export async function sendPendingConfirmations(db: DB, opts: { siteUrl: string; env?: Env; limit?: number; now?: Date; titleFor?: (slug: string) => string }): Promise<number> {
  if (!mailConfigured(opts.env)) return 0;
  const limit = opts.limit ?? 50;
  let sent = 0;
  const letters = await db
    .select()
    .from(subs)
    .where(and(ne(subs.status, "unsubscribed"), eq(subs.newsletter, "pending"), isNull(subs.confirmSentAt)))
    .orderBy(asc(subs.createdAt))
    .limit(limit);
  for (const row of letters) if (await sendConfirmation(db, row, { kind: "letter" }, opts)) sent++;

  const watchRows = await db
    .select({ watch: watches, sub: subs })
    .from(watches)
    .innerJoin(subs, eq(subs.id, watches.subscriberId))
    .where(and(eq(watches.status, "pending"), isNull(watches.confirmSentAt), ne(subs.status, "unsubscribed")))
    .orderBy(asc(watches.createdAt))
    .limit(Math.max(0, limit - sent));
  for (const { watch, sub } of watchRows) {
    const title = opts.titleFor?.(watch.slug) ?? watch.slug;
    if (await sendConfirmation(db, sub, { kind: "watch", id: watch.id, title }, opts)) sent++;
  }

  const wishRows = await db
    .select({ wish: wishes, sub: subs })
    .from(wishes)
    .innerJoin(subs, eq(subs.id, wishes.subscriberId))
    .where(and(eq(wishes.status, "pending"), isNull(wishes.confirmSentAt), ne(subs.status, "unsubscribed")))
    .orderBy(asc(wishes.createdAt))
    .limit(Math.max(0, limit - sent));
  for (const { wish, sub } of wishRows) if (await sendConfirmation(db, sub, { kind: "wish", id: wish.id, query: wish.query }, opts)) sent++;
  return sent;
}

export async function subscriberCounts(db: DB) {
  const rows = await db.select({ status: subs.status, n: sql<number>`count(*)`.mapWith(Number) }).from(subs).groupBy(subs.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const [letter] = await db
    .select({ n: count() })
    .from(subs)
    .where(and(eq(subs.status, "confirmed"), eq(subs.newsletter, "yes")));
  return { confirmed: by.confirmed ?? 0, pending: by.pending ?? 0, unsubscribed: by.unsubscribed ?? 0, letter: letter?.n ?? 0 };
}
