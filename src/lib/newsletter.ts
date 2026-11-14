import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { impressumUrl } from "./legal";
import { esc, mailConfigured, sendMail } from "./mail";
import { LIMITS } from "./rate-limit";
import { getT } from "./i18n";
import { isLang, type Lang } from "./i18n/lang";

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

/**
 * Opening a confirm or unsubscribe page, per visitor. With Cache Components a page's dynamic part can be rendered
 * twice for one request (once to warm caches), so a view counts twice: this allows as many views as LIMITS.tokens
 * allows button presses.
 */
export const TOKEN_PAGE_LIMITS = LIMITS.tokens.map((r) => ({ ...r, limit: r.limit * 2 }));

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
export const isToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);
const newToken = () => randomBytes(32).toString("base64url");

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
const cleanLang = (l: string | null | undefined): Lang => (isLang(l) ? l : "en");

/** Who is asking: the address, where the form was, their country and the language of the page they asked on. */
type Asker = { email: string; source?: string | null; country?: string | null; lang?: string | null };

/**
 * The subscriber row for an address, made if new. Someone who unsubscribed from everything and asks again starts
 * over as pending, with nothing switched on. `letter` says whether this request is for the weekly letter.
 *
 * The language is set when the row is made, and again when someone who unsubscribed starts over: a form can't change
 * the language an existing subscriber reads in, so typing their address on another page has no effect on them.
 */
async function subscriberFor(db: DB, input: Asker, letter: boolean): Promise<Row | null> {
  const email = input.email.trim().toLowerCase();
  const country = cleanCountry(input.country);
  const lang = cleanLang(input.lang);
  await db
    .insert(subs)
    .values({ email, source: input.source?.slice(0, 64) ?? "site", country, lang, status: "pending", token: newToken(), newsletter: letter ? "pending" : "no" })
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
        letterStoppedAt: null,
        confirmHash: null,
        country: country ?? found.country,
        lang,
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
  input: Asker,
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
  input: { email: string; country?: string | null; lang?: string | null; slug: string; title: string; prices: WatchPrices },
  opts: Opts,
): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  const row = await subscriberFor(db, { email: input.email, country: input.country, lang: input.lang, source: "watch" }, false);
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
      .set({ status: "pending", ...values, confirmHash: null, confirmSentAt: null, confirmedAt: null, stoppedAt: null, lastNotifiedAt: null, createdAt: now })
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
export async function requestWish(db: DB, input: { email: string; country?: string | null; lang?: string | null; query: string }, opts: Opts): Promise<SubscribeOutcome> {
  const now = opts.now ?? new Date();
  const row = await subscriberFor(db, { email: input.email, country: input.country, lang: input.lang, source: "wish" }, false);
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
      .set({ status: "pending", confirmHash: null, confirmSentAt: null, confirmedAt: null, stoppedAt: null, answeredSlug: null, createdAt: now })
      .where(eq(wishes.id, wish.id))
      .returning();
  }
  if (wish.confirmSentAt && now.getTime() - wish.confirmSentAt.getTime() < RESEND_AFTER_MS) return "unchanged";
  return (await sendConfirmation(db, row, { kind: "wish", id: wish.id, query: input.query }, opts)) ? "sent" : "stored";
}

type Purpose = { kind: "letter" } | { kind: "watch"; id: number; title: string } | { kind: "wish"; id: number; query: string };
const scopeOf = (p: Purpose): Scope => (p.kind === "letter" ? "letter" : `${p.kind}-${p.id}`);

/** A confirm link works this long after its email went out. Unconfirmed requests are deleted then anyway. */
export const CONFIRM_DAYS = 30;

/** The secret in a confirmation link, and the hash we keep of it. Only the hash is stored, so the database can't rebuild a working link. */
export function newConfirmSecret() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSecret(token) };
}
export const hashSecret = (token: string) => createHash("sha256").update(token).digest("hex");

async function sendConfirmation(db: DB, row: Row, purpose: Purpose, opts: Opts): Promise<boolean> {
  if (!row.token || !mailConfigured(opts.env)) return false;
  const now = opts.now ?? new Date();
  const [{ n }] = await db
    .select({ n: count() })
    .from(sends)
    .where(and(eq(sends.subscriberId, row.id), eq(sends.kind, "confirm"), gte(sends.createdAt, new Date(now.getTime() - 24 * 3600_000))));
  if (n >= CONFIRMS_PER_DAY) return false;
  // Each email gets a fresh secret. Its hash is saved only once the email has gone, so a failed send leaves the
  // link in the last email working; a newer email replaces it.
  const secret = newConfirmSecret();
  const mail = confirmationMail(row.email, secret.token, opts.siteUrl, purpose, now, { unsubscribeToken: row.token, subscriberId: row.id, hash: secret.hash }, cleanLang(row.lang));
  const result = await sendMail(mail, opts.env);
  if (!result.ok) return false;
  await db
    .insert(sends)
    .values({ subscriberId: row.id, kind: "confirm", key: `${scopeOf(purpose)}:${now.toISOString()}`, status: "sent", providerId: result.id, createdAt: now })
    .onConflictDoNothing();
  const set = { confirmSentAt: now, confirmHash: secret.hash };
  if (purpose.kind === "letter") await db.update(subs).set(set).where(eq(subs.id, row.id));
  else if (purpose.kind === "watch") await db.update(watches).set(set).where(eq(watches.id, purpose.id));
  else await db.update(wishes).set(set).where(eq(wishes.id, purpose.id));
  return true;
}

const scopeOnly = (scope?: Scope) => (scope ? `&only=${scope}` : "");

/**
 * The link in a confirmation email. It opens a page that says what is being confirmed, with a button that posts:
 * opening the link alone (as mail scanners such as Safe Links do) changes nothing.
 */
export function confirmUrl(siteUrl: string, secret: string) {
  return `${siteUrl}/newsletter/confirm?t=${encodeURIComponent(secret)}`;
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
export function confirmationMail(
  email: string,
  secret: string,
  siteUrl: string,
  purpose: Purpose = { kind: "letter" },
  now = new Date(),
  ids: { unsubscribeToken: string; subscriberId: number; hash?: string } = { unsubscribeToken: secret, subscriberId: 0 },
  lang: Lang = "en",
) {
  const t = getT(lang);
  const scope = scopeOf(purpose);
  const link = confirmUrl(siteUrl, secret);
  const host = siteUrl.replace(/^https?:\/\//, "");
  const asked =
    purpose.kind === "letter"
      ? t("mailConfirm.askedLetter")
      : purpose.kind === "watch"
        ? t("mailConfirm.askedWatch", purpose.title)
        : t("mailConfirm.askedWish", purpose.query);
  const subject =
    purpose.kind === "letter" ? t("mailConfirm.subjectLetter") : purpose.kind === "watch" ? t("mailConfirm.subjectWatch") : t("mailConfirm.subjectWish");
  const legal = impressumUrl(siteUrl);
  // Our own words go into the HTML as they are; what a visitor typed (a title, a search) is escaped.
  const someone = t("mailConfirm.someone", asked, host);
  const text = [
    t("mailConfirm.heading"),
    "",
    someone,
    "",
    t("mailConfirm.openLink"),
    link,
    "",
    t("mailConfirm.notYou"),
    "",
    `${t("mailCommon.impressum")}: ${legal}`,
  ].join("\n");
  const html = `<!doctype html><html${lang === "en" ? "" : ` lang="${lang}"`}><body style="margin:0;padding:24px;background:#f6f5f1;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e3e1da;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#666">SameButCheaper</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${t("mailConfirm.heading")}</h1>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${t("mailConfirm.someone", esc(asked), esc(host))} ${t("mailConfirm.openPage")}</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1f4fd8;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:8px">${t("mailConfirm.button")}</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#666">${t("mailConfirm.orPaste")}<br><a href="${esc(link)}" style="color:#1f4fd8;word-break:break-all">${esc(link)}</a></p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#666">${t("mailConfirm.notYou")}</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#666"><a href="${esc(legal)}" style="color:#666">${t("mailCommon.impressum")}</a></p>
</div></body></html>`;
  return {
    to: email,
    subject,
    text,
    html,
    headers: listHeaders(siteUrl, ids.unsubscribeToken),
    // Per address, purpose and email. No secret goes to the mail provider in this key.
    idempotencyKey: `confirm-${ids.subscriberId}-${scope}-${Math.floor(now.getTime() / RESEND_AFTER_MS)}-${(ids.hash ?? "").slice(0, 12)}`,
  };
}

export type TokenOutcome = "done" | "already" | "invalid";

/** What a confirm link is for, as its page shows it before the button is pressed. */
export type ConfirmTarget =
  | { kind: "letter"; email: string }
  | { kind: "watch"; email: string; title: string; slug: string }
  | { kind: "wish"; email: string; query: string };

/** "a•••@example.com": enough for the owner to recognise, not enough to read off someone else's screen. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}

type Found =
  | { kind: "letter"; sub: Row }
  | { kind: "watch"; sub: Row; item: typeof watches.$inferSelect }
  | { kind: "wish"; sub: Row; item: typeof wishes.$inferSelect };

/** The pending thing a confirm secret belongs to, or null if it is unknown, used, replaced or too old. */
async function findConfirm(db: DB, secret: string, now: Date, lock = false): Promise<Found | null> {
  if (!isToken(secret)) return null;
  const hash = hashSecret(secret);
  const since = new Date(now.getTime() - CONFIRM_DAYS * 86400_000);
  const fresh = (sent: Date | null) => Boolean(sent && sent >= since);
  const subQ = db.select().from(subs).where(eq(subs.confirmHash, hash)).limit(1);
  const [sub] = lock ? await subQ.for("update") : await subQ;
  if (sub) return sub.status !== "unsubscribed" && sub.newsletter === "pending" && fresh(sub.confirmSentAt) ? { kind: "letter", sub } : null;
  const [w] = await (lock
    ? db.select({ item: watches, sub: subs }).from(watches).innerJoin(subs, eq(subs.id, watches.subscriberId)).where(eq(watches.confirmHash, hash)).limit(1).for("update")
    : db.select({ item: watches, sub: subs }).from(watches).innerJoin(subs, eq(subs.id, watches.subscriberId)).where(eq(watches.confirmHash, hash)).limit(1));
  if (w) return w.item.status === "pending" && w.sub.status !== "unsubscribed" && fresh(w.item.confirmSentAt) ? { kind: "watch", sub: w.sub, item: w.item } : null;
  const [x] = await (lock
    ? db.select({ item: wishes, sub: subs }).from(wishes).innerJoin(subs, eq(subs.id, wishes.subscriberId)).where(eq(wishes.confirmHash, hash)).limit(1).for("update")
    : db.select({ item: wishes, sub: subs }).from(wishes).innerJoin(subs, eq(subs.id, wishes.subscriberId)).where(eq(wishes.confirmHash, hash)).limit(1));
  if (x) return x.item.status === "pending" && x.sub.status !== "unsubscribed" && fresh(x.item.confirmSentAt) ? { kind: "wish", sub: x.sub, item: x.item } : null;
  return null;
}

/** What the confirm page shows. Reads only: opening the link never changes anything. */
export async function confirmTarget(db: DB, secret: string, now = new Date()): Promise<ConfirmTarget | null> {
  const found = await findConfirm(db, secret, now);
  if (!found) return null;
  const email = maskEmail(found.sub.email);
  if (found.kind === "letter") return { kind: "letter", email };
  if (found.kind === "watch") return { kind: "watch", email, title: found.item.title, slug: found.item.slug };
  return { kind: "wish", email, query: found.item.query };
}

export type ConfirmOutcome = { outcome: "done"; kind: Found["kind"] } | { outcome: "invalid" };

/**
 * The confirm button: switches on what the link was for, and confirms the address if it was pending. The secret
 * is cleared as it is used, so a link works once: pressing again, replaying the request, or a link from an older
 * email does nothing.
 */
export async function confirmByToken(db: DB, secret: string, now = new Date()): Promise<ConfirmOutcome> {
  if (!isToken(secret)) return { outcome: "invalid" };
  return db.transaction(async (tx) => {
    const found = await findConfirm(tx as unknown as DB, secret, now, true);
    if (!found) return { outcome: "invalid" as const };
    if (found.kind === "letter") {
      await tx.update(subs).set({ newsletter: "yes", letterConfirmedAt: now, letterStoppedAt: null, confirmHash: null }).where(eq(subs.id, found.sub.id));
    } else if (found.kind === "watch") {
      await tx.update(watches).set({ status: "active", confirmedAt: now, confirmHash: null }).where(eq(watches.id, found.item.id));
    } else {
      await tx.update(wishes).set({ status: "active", confirmedAt: now, confirmHash: null }).where(eq(wishes.id, found.item.id));
    }
    if (found.sub.status === "pending") {
      await tx.update(subs).set({ status: "confirmed", confirmedAt: now, unsubscribedAt: null }).where(eq(subs.id, found.sub.id));
    }
    return { outcome: "done" as const, kind: found.kind };
  });
}

export type UnsubscribeTarget = {
  email: string;
  /** False when the address already gets nothing from us. */
  anythingOn: boolean;
  scoped: null | { kind: "letter"; on: boolean } | { kind: "watch"; title: string; on: boolean } | { kind: "wish"; query: string; on: boolean };
};

/** What an unsubscribe link would stop, for its page. Null when the link is unknown. Reads only. */
export async function unsubscribeTarget(db: DB, token: string, scope?: Scope): Promise<UnsubscribeTarget | null> {
  if (!isToken(token) || (scope !== undefined && !isScope(scope))) return null;
  const [row] = await db.select().from(subs).where(eq(subs.token, token)).limit(1);
  if (!row) return null;
  const base = { email: maskEmail(row.email), anythingOn: row.status !== "unsubscribed" };
  if (!scope) return { ...base, scoped: null };
  const target = parseScope(scope);
  if (target.kind === "letter") return { ...base, scoped: { kind: "letter", on: row.newsletter !== "no" } };
  const live = (status: string) => status === "pending" || status === "active";
  if (target.kind === "watch") {
    const [w] = await db.select().from(watches).where(and(eq(watches.id, target.id), eq(watches.subscriberId, row.id))).limit(1);
    return w ? { ...base, scoped: { kind: "watch", title: w.title, on: live(w.status) } } : null;
  }
  const [w] = await db.select().from(wishes).where(and(eq(wishes.id, target.id), eq(wishes.subscriberId, row.id))).limit(1);
  return w ? { ...base, scoped: { kind: "wish", query: w.query, on: live(w.status) } } : null;
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
        .set({ status: "unsubscribed", unsubscribedAt: now, newsletter: "no", confirmHash: null })
        .where(and(eq(subs.id, row.id), or(eq(subs.status, "pending"), eq(subs.status, "confirmed"))))
        .returning({ id: subs.id });
      for (const table of [watches, wishes]) {
        await tx
          .update(table)
          .set({ status: "stopped", stoppedAt: now, confirmHash: null })
          .where(and(eq(table.subscriberId, row.id), inArray(table.status, ["pending", "active"])));
      }
      return done.length ? "done" : "already";
    });
  }
  const target = parseScope(scope);
  if (target.kind === "letter") {
    const done = await db
      .update(subs)
      .set({ newsletter: "no", letterStoppedAt: now, confirmHash: null })
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
  await db.update(table).set({ status: "stopped", stoppedAt: now, confirmHash: null }).where(eq(table.id, target.id));
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
