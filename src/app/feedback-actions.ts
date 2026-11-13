"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { getBundle, getPair } from "@/lib/catalog";
import { log } from "@/lib/log";
import { mailConfigured } from "@/lib/mail";
import { isKnownCountry } from "@/lib/markets";
import { requestWatch, requestWish } from "@/lib/newsletter";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { isReportKind, recordReport } from "@/lib/reports";
import { SITE } from "@/lib/site";
import { visitorFrom } from "@/lib/visitor";
import { normaliseQuery } from "@/lib/wanted";
import { pricesOf } from "@/lib/watches";

/**
 * The forms on swap, kit and search pages: "Something wrong?", "Email me if this changes" and "Tell me when you
 * add it". Every one is rate-limited per visitor, stores no IP address, and anything that leads to an email goes
 * through double opt-in (src/lib/newsletter.ts).
 */
export type FeedbackState = { ok: boolean; message: string } | null;

const TOO_MANY: FeedbackState = { ok: false, message: "That's a lot of tries in a short time. Please wait a few minutes." };
const emailSchema = z.string().trim().toLowerCase().email().max(320);

async function country() {
  const c = (await cookies()).get("sbc_country")?.value;
  return isKnownCountry(c) ? c : null;
}

export async function reportProblem(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const thanks: FeedbackState = { ok: true, message: "Thank you. We'll check it against the store and fix the page if it's wrong." };
  if (formData.get("company")) return thanks; // honeypot
  const recordKind = formData.get("record") === "bundle" ? "bundle" : "pair";
  const slug = String(formData.get("slug") ?? "");
  const kind = formData.get("kind");
  if (!isReportKind(kind)) return { ok: false, message: "Pick what's wrong first." };
  if (!(recordKind === "bundle" ? getBundle(slug) : getPair(slug))) return { ok: false, message: "We couldn't find this page's record." };
  const visitor = visitorFrom(new Headers(await headers()));
  if (visitor.isBot) return thanks;
  if (!rateLimit("reports", visitor.key, LIMITS.reports).ok) return TOO_MANY;
  // The same visitor reporting the same thing about the same page again today: thank them, count it once.
  if (!rateLimit("report-once", `${visitor.key}:${recordKind}:${slug}:${kind}`, LIMITS.oncePerDay).ok) return thanks;
  const db = getDb();
  if (!db) return { ok: false, message: "Reports aren't open yet. Please try again later." };
  try {
    await recordReport(db, { recordKind, slug, kind, note: formData.get("note") as string | null, country: await country(), visitorHash: visitor.hash });
    return thanks;
  } catch (err) {
    log.error("report.failed", { err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** The same wording whatever the address's state, so the form can't be used to find out who is on the list. */
function confirmMessage(outcome: "sent" | "stored" | "unchanged", what: string): FeedbackState {
  return {
    ok: true,
    message:
      mailConfigured() && outcome !== "stored"
        ? `Almost there. We've sent you an email: click the link in it to ${what}. Nothing else is sent until you do.`
        : `Saved. We'll email you once to confirm before we send anything.`,
  };
}

export async function watchSwap(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  if (formData.get("company")) return { ok: true, message: "Thanks." }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Please enter a valid email address." };
  const pair = getPair(String(formData.get("slug") ?? ""));
  if (!pair) return { ok: false, message: "We couldn't find this swap." };
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("forms", visitor.key, LIMITS.forms).ok) return TOO_MANY;
  const db = getDb();
  if (!db) return { ok: false, message: "Price watches aren't open yet. Please check back soon." };
  try {
    const outcome = await requestWatch(
      db,
      { email: email.data, country: await country(), slug: pair.slug, title: pair.title, prices: pricesOf(pair) },
      { siteUrl: SITE.url },
    );
    return confirmMessage(outcome, "start watching this swap");
  } catch (err) {
    log.error("watch.request_failed", { err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function wishFor(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  if (formData.get("company")) return { ok: true, message: "Thanks." }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "Please enter a valid email address." };
  const query = normaliseQuery(formData.get("query"));
  if (!query) return { ok: false, message: "Search for a product name first." };
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("forms", visitor.key, LIMITS.forms).ok) return TOO_MANY;
  const db = getDb();
  if (!db) return { ok: false, message: "This isn't open yet. Please check back soon." };
  try {
    const outcome = await requestWish(db, { email: email.data, country: await country(), query }, { siteUrl: SITE.url });
    return confirmMessage(outcome, "confirm");
  } catch (err) {
    log.error("wish.request_failed", { err });
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
