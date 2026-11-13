import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { esc, mailConfigured, sendMail } from "./mail";

/**
 * The newsletter list with double opt-in. A sign-up is stored as "pending" and gets one email with a confirm
 * link; only after that link is followed is the address "confirmed" and allowed to receive anything else. German
 * law (UWG §7) in practice requires this proof, and it keeps typos and other people's addresses off the list.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;
const subs = schema.subscribers;

/** A second confirmation email to the same address waits this long, so the form can't be used to flood an inbox. */
const RESEND_AFTER_MS = 10 * 60_000;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);
const newToken = () => randomBytes(24).toString("base64url");

export type SubscribeOutcome =
  /** A confirmation email went out. */
  | "sent"
  /** Saved, but email isn't set up yet (or the send failed); upkeep sends the confirmation later. */
  | "stored"
  /** Already confirmed, or a confirmation went out minutes ago: nothing new happened. */
  | "unchanged";

export async function subscribeEmail(
  db: DB,
  input: { email: string; source?: string | null; country?: string | null },
  opts: { siteUrl: string; env?: Env; now?: Date },
): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const country = input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null;

  await db
    .insert(subs)
    .values({ email, source: input.source?.slice(0, 64) ?? "site", country, status: "pending", token: newToken() })
    .onConflictDoNothing();
  const [found] = await db.select().from(subs).where(eq(subs.email, email)).limit(1);
  if (!found) return "stored";
  let row = found;

  if (row.status === "confirmed") return "unchanged";
  if (row.status === "unsubscribed" || !row.token) {
    // Signing up again after leaving starts over: pending, with a fresh confirmation.
    [row] = await db
      .update(subs)
      .set({ status: "pending", token: row.token ?? newToken(), unsubscribedAt: null, confirmedAt: null, confirmSentAt: null, country: country ?? row.country })
      .where(eq(subs.id, row.id))
      .returning();
  }
  if (row.confirmSentAt && now.getTime() - row.confirmSentAt.getTime() < RESEND_AFTER_MS) return "unchanged";
  return (await sendConfirmation(db, row, opts)) ? "sent" : "stored";
}

type Row = typeof subs.$inferSelect;

async function sendConfirmation(db: DB, row: Row, opts: { siteUrl: string; env?: Env; now?: Date }): Promise<boolean> {
  if (!row.token || !mailConfigured(opts.env)) return false;
  const now = opts.now ?? new Date();
  const result = await sendMail(confirmationMail(row.email, row.token, opts.siteUrl), opts.env);
  if (!result.ok) return false;
  await db.update(subs).set({ confirmSentAt: now }).where(eq(subs.id, row.id));
  return true;
}

export function confirmUrl(siteUrl: string, token: string) {
  return `${siteUrl}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}
/** The page with the "unsubscribe" button, for people. */
export function unsubscribeUrl(siteUrl: string, token: string) {
  return `${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}
/** Where mail apps POST for one-click unsubscribe (RFC 8058). */
export function oneClickUrl(siteUrl: string, token: string) {
  return `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Headers every list email carries, so Gmail and others show their own unsubscribe button. */
export function listHeaders(siteUrl: string, token: string) {
  return { "List-Unsubscribe": `<${oneClickUrl(siteUrl, token)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** The confirmation email. It only asks for the confirmation: an advert in it would itself be unsolicited mail. */
export function confirmationMail(email: string, token: string, siteUrl: string) {
  const link = confirmUrl(siteUrl, token);
  const host = siteUrl.replace(/^https?:\/\//, "");
  const text = [
    "Please confirm your email address",
    "",
    `Someone, hopefully you, asked to get new swaps from SameButCheaper (${host}) at this address.`,
    "",
    "Confirm it here:",
    link,
    "",
    "If that wasn't you, ignore this email. You won't hear from us again, and the address is removed after 30 days.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f5f1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e1da;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#666">SameButCheaper</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">Please confirm your email address</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">Someone, hopefully you, asked to get new swaps from ${esc(host)} at this address.</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1f4fd8;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:8px">Yes, send me new swaps</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#666">Or paste this link into your browser:<br><a href="${esc(link)}" style="color:#1f4fd8;word-break:break-all">${esc(link)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#666">If that wasn't you, ignore this email. You won't hear from us again, and the address is removed after 30 days.</p>
</div></body></html>`;
  return {
    to: email,
    subject: "Confirm your email for SameButCheaper",
    text,
    html,
    headers: listHeaders(siteUrl, token),
    // One per address per ten minutes, matching the resend wait.
    idempotencyKey: `confirm-${token}-${Math.floor(Date.now() / RESEND_AFTER_MS)}`,
  };
}

export type TokenOutcome = "done" | "already" | "invalid";

/** Marks a pending sign-up confirmed. Following the link twice is fine. */
export async function confirmSubscription(db: DB, token: string, now = new Date()): Promise<TokenOutcome> {
  if (!isToken(token)) return "invalid";
  const done = await db
    .update(subs)
    .set({ status: "confirmed", confirmedAt: now, unsubscribedAt: null })
    .where(and(eq(subs.token, token), eq(subs.status, "pending")))
    .returning({ id: subs.id });
  if (done.length) return "done";
  const [row] = await db.select({ status: subs.status }).from(subs).where(eq(subs.token, token)).limit(1);
  return row?.status === "confirmed" ? "already" : "invalid";
}

/** Takes an address off the list. The row stays as "unsubscribed" so nothing is sent to it by mistake later. */
export async function unsubscribe(db: DB, token: string, now = new Date()): Promise<TokenOutcome> {
  if (!isToken(token)) return "invalid";
  const done = await db
    .update(subs)
    .set({ status: "unsubscribed", unsubscribedAt: now })
    .where(and(eq(subs.token, token), or(eq(subs.status, "pending"), eq(subs.status, "confirmed"))))
    .returning({ id: subs.id });
  if (done.length) return "done";
  const [row] = await db.select({ status: subs.status }).from(subs).where(eq(subs.token, token)).limit(1);
  return row ? "already" : "invalid";
}

/**
 * Sends the confirmation to sign-ups that never got one (stored before email was set up, or when a send failed).
 * Called by upkeep; a small batch at a time keeps well inside a new sender's daily allowance.
 */
export async function sendPendingConfirmations(db: DB, opts: { siteUrl: string; env?: Env; limit?: number }): Promise<number> {
  if (!mailConfigured(opts.env)) return 0;
  const rows = await db
    .select()
    .from(subs)
    .where(and(eq(subs.status, "pending"), isNull(subs.confirmSentAt)))
    .orderBy(asc(subs.createdAt))
    .limit(opts.limit ?? 50);
  let sent = 0;
  for (const row of rows) if (await sendConfirmation(db, row, opts)) sent++;
  return sent;
}

export async function subscriberCounts(db: DB) {
  const rows = await db.select({ status: subs.status, n: sql<number>`count(*)`.mapWith(Number) }).from(subs).groupBy(subs.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { confirmed: by.confirmed ?? 0, pending: by.pending ?? 0, unsubscribed: by.unsubscribed ?? 0 };
}
