import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { catalogueData, type CatalogueView } from "./catalog-data";
import type { Currency } from "./format";
import { localFor } from "./localize";
import { log } from "./log";
import { esc, mailConfigured, sendMail } from "./mail";
import { button, COLORS, fullName, shell, tagged, textFooter, yearlyNote, type Footer } from "./mail-layout";
import { listHeaders, priceColumns, unsubscribeUrl, type WatchPrices } from "./newsletter";
import type { Pair } from "./types";
import { unitDisplay } from "./unit-format";

/**
 * Price watches. A watch holds a swap's prices from when it began (or from the last email about it). Prices only
 * change when a new catalogue build is deployed, so the daily upkeep compares each active watch with the catalogue
 * and writes once when:
 *  - the cheaper product's price per unit has moved 5% or more, either way;
 *  - the saving has dropped under 5%;
 *  - the swap has been withdrawn (then the watch ends).
 * Each email is claimed in `sends` before it goes, keyed by the watch and the new prices, so a second run, or two
 * at once, can't send it twice; after it goes the watch takes the new prices as its baseline.
 */
type DB = PostgresJsDatabase<typeof schema>;
type Env = Record<string, string | undefined>;
const { watches, subscribers, sends } = schema;

export const PRICE_MOVE = 0.05;
export const SAVING_FLOOR = 5;

export function pricesOf(pair: Pair): WatchPrices {
  return {
    currency: pair.currency,
    unit: pair.brand.unit,
    altPrice: pair.alternative.price,
    altPpu: pair.alternative.ppu,
    brandPpu: pair.brand.ppu,
    savingsPct: Math.round(pair.savingsPct * 100) / 100,
    priceChecked: pair.price_checked,
  };
}

export type WatchChange =
  | { withdrawn: true }
  | {
      withdrawn: false;
      /** Fractional move in the cheaper product's price per unit, null when the record changed unit or currency. */
      move: number | null;
      savingsDropped: boolean;
      prices: WatchPrices;
    };

/** What has changed enough to write about, or null. */
export function watchChange(stored: WatchPrices, current: WatchPrices | null): WatchChange | null {
  if (!current) return { withdrawn: true };
  const comparable = stored.currency === current.currency && stored.unit === current.unit && stored.altPpu > 0;
  const move = comparable ? (current.altPpu - stored.altPpu) / stored.altPpu : null;
  // A tiny tolerance, so a stored 0.05 isn't missed to rounding.
  const moved = move === null || Math.abs(move) >= PRICE_MOVE - 1e-9;
  const savingsDropped = stored.savingsPct >= SAVING_FLOOR && current.savingsPct < SAVING_FLOOR;
  return moved || savingsDropped ? { withdrawn: false, move, savingsDropped, prices: current } : null;
}

/** The same new state gives the same key, so it is only ever written about once. */
export function changeKey(watchId: number, change: WatchChange) {
  if (change.withdrawn) return `watch-${watchId}:withdrawn`;
  const p = change.prices;
  return `watch-${watchId}:${p.currency}:${p.unit}:${Number(p.altPpu.toPrecision(6))}:${p.savingsPct.toFixed(1)}`.slice(0, 160);
}

export function storedPrices(w: typeof watches.$inferSelect): WatchPrices {
  return {
    currency: w.currency,
    unit: w.unit,
    altPrice: Number(w.altPrice),
    altPpu: Number(w.altPpu),
    brandPpu: Number(w.brandPpu),
    savingsPct: Number(w.savingsPct),
    priceChecked: w.priceChecked,
  };
}

type MailOpts = { siteUrl: string; contactEmail: string; postalAddress?: string | null };

/** The email about one change, in the subscriber's currency when we know their country. */
export function watchMail(
  input: { to: string; token: string; watchId: number; title: string; slug: string; country: string | null; before: WatchPrices; change: WatchChange; pair: Pair | null },
  opts: MailOpts,
) {
  const { change, before } = input;
  const scope = `watch-${input.watchId}` as const;
  const footer: Footer = {
    why: "You get this because you asked us to email you if this swap changes. This watch only writes when a price moves 5% or more, the saving drops under 5%, or the swap is withdrawn.",
    stopThis: { label: "Stop watching this swap", url: unsubscribeUrl(opts.siteUrl, input.token, scope) },
    stopAll: unsubscribeUrl(opts.siteUrl, input.token),
    siteUrl: opts.siteUrl,
    contactEmail: opts.contactEmail,
    postalAddress: opts.postalAddress,
  };
  const campaign = "price-watch";
  let subject: string;
  let lines: string[];
  let html: string;
  if (change.withdrawn || !input.pair) {
    subject = `We've withdrawn a swap you watch`;
    lines = [
      `We've taken “${input.title}” off SameButCheaper, so your watch on it has ended.`,
      "We won't email you about it again.",
    ];
    const link = tagged(`${opts.siteUrl}/search`, campaign);
    html =
      lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${esc(l)}</p>`).join("") +
      `<p style="margin:8px 0 0">${button("Find another swap", link)}</p>`;
    lines.push("", `Find another swap: ${link}`);
  } else {
    const pair = input.pair;
    const now = change.prices;
    const local = localFor(input.country);
    const per = unitDisplay(now.unit).label;
    const cur = (n: number, c: string) => `${local.unit(n, now.unit, c as Currency)} ${per}`;
    const alt = fullName(pair.alternative.brand, pair.alternative.product);
    const parts: string[] = [];
    if (change.move !== null && Math.abs(change.move) >= PRICE_MOVE - 1e-9) {
      const dir = change.move > 0 ? "up" : "down";
      parts.push(`${alt} has gone ${dir} ${Math.round(Math.abs(change.move) * 100)}%, to ${cur(now.altPpu, now.currency)} from ${cur(before.altPpu, before.currency)}.`);
    } else if (change.move === null) {
      parts.push(`We've re-priced ${alt}: it is now ${cur(now.altPpu, now.currency)}.`);
    }
    parts.push(
      change.savingsDropped
        ? `The saving against ${pair.brand.brand} is now ${Math.round(now.savingsPct)}%, under 5%, down from ${Math.round(before.savingsPct)}%.`
        : `It is ${Math.round(now.savingsPct)}% cheaper than ${pair.brand.brand} (was ${Math.round(before.savingsPct)}%).`,
    );
    const yearly = change.savingsDropped ? null : yearlyNote(pair, local);
    if (yearly) parts.push(yearly);
    parts.push(`Prices as we checked them in ${monthName(now.priceChecked)}. Store prices can change between our checks.`);
    subject = change.savingsDropped ? `The saving on a swap you watch is now under 5%` : `Price change on a swap you watch: ${pair.alternative.brand}`;
    const link = tagged(`${opts.siteUrl}/compare/${pair.slug}`, campaign);
    lines = [pair.title, "", ...parts];
    html =
      `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3">${esc(pair.title)}</h1>` +
      parts.map((l, i) => `<p style="margin:0 0 12px;font-size:${i === parts.length - 1 ? 13 : 16}px;line-height:1.5;color:${i === parts.length - 1 ? COLORS.muted : COLORS.ink}">${esc(l)}</p>`).join("") +
      `<p style="margin:8px 0 0">${button("See the swap", link)}</p>`;
    lines.push("", `See the swap: ${link}`);
  }
  return {
    to: input.to,
    subject,
    text: [...lines, "", textFooter(footer)].join("\n"),
    html: shell({ title: subject, preheader: lines[0] === input.title ? lines[2] ?? "" : lines[0], body: html, footer }),
    headers: listHeaders(opts.siteUrl, input.token, scope),
  };
}

function monthName(checked: string | null) {
  if (!checked) return "our last check";
  const [y, m] = checked.split("-").map(Number);
  if (!y || !m) return checked;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type WatchRun = { checked: number; changed: number; sent: number; notSent: number };

/**
 * Writes to every active watch whose swap has changed enough. Without email set up it only logs what it would
 * send. At most `limit` emails a run; the rest go on the next run.
 */
export async function runWatches(
  db: DB,
  opts: MailOpts & { env?: Env; now?: Date; catalogue?: CatalogueView; limit?: number; pauseMs?: number },
): Promise<WatchRun> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();
  const catalogue = opts.catalogue ?? catalogueData();
  const bySlug = new Map(catalogue.pairs.map((p) => [p.slug, p]));
  const limit = opts.limit ?? 200;
  const canSend = mailConfigured(env);
  const rows = await db
    .select({ watch: watches, sub: subscribers })
    .from(watches)
    .innerJoin(subscribers, eq(subscribers.id, watches.subscriberId))
    .where(and(eq(watches.status, "active"), eq(subscribers.status, "confirmed")))
    .orderBy(asc(watches.id));
  const run: WatchRun = { checked: rows.length, changed: 0, sent: 0, notSent: 0 };
  for (const { watch, sub } of rows) {
    const pair = bySlug.get(watch.slug) ?? null;
    const before = storedPrices(watch);
    const change = watchChange(before, pair ? pricesOf(pair) : null);
    if (!change) continue;
    run.changed++;
    if (!canSend || !sub.token) {
      run.notSent++;
      log.info("watch.change_not_sent", { watch: watch.id, slug: watch.slug, withdrawn: change.withdrawn, reason: "mail-not-configured" });
      continue;
    }
    if (run.sent >= limit) continue;
    const key = changeKey(watch.id, change);
    const [claim] = await db
      .insert(sends)
      .values({ subscriberId: sub.id, kind: "watch", key, status: "sending", createdAt: now })
      .onConflictDoNothing()
      .returning({ id: sends.id });
    if (!claim) {
      // Already written about (a run stopped between sending and saving): just move the baseline on.
      await settle(db, watch.id, change, now);
      continue;
    }
    const mail = watchMail(
      { to: sub.email, token: sub.token, watchId: watch.id, title: watch.title, slug: watch.slug, country: sub.country, before, change, pair },
      opts,
    );
    const result = await sendMail({ ...mail, idempotencyKey: key }, env);
    if (!result.ok) {
      await db.delete(sends).where(eq(sends.id, claim.id));
      log.warn("watch.send_failed", { watch: watch.id, reason: result.reason });
      continue;
    }
    await db.update(sends).set({ status: "sent", providerId: result.id }).where(eq(sends.id, claim.id));
    await settle(db, watch.id, change, now);
    run.sent++;
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  }
  return run;
}

async function settle(db: DB, id: number, change: WatchChange, now: Date) {
  if (change.withdrawn) {
    await db.update(watches).set({ status: "ended", stoppedAt: now, lastNotifiedAt: now }).where(eq(watches.id, id));
  } else {
    await db.update(watches).set({ ...priceColumns(change.prices), lastNotifiedAt: now }).where(eq(watches.id, id));
  }
}
