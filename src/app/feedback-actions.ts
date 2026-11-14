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
import { watchTerms } from "@/lib/watch-terms";
import { getT } from "@/lib/i18n";

/** The forms send the page's language, so the answer, and any email it leads to, reads in it. */
const formLang = (formData: FormData) => (formData.get("lang") === "de" ? "de" : "en");
const sayFor = (formData: FormData) => getT(formLang(formData));

/**
 * The forms on swap, kit and search pages: "Something wrong?", "Email me if this changes" and "Tell me when you
 * add it". Every one is rate-limited per visitor, stores no IP address, and anything that leads to an email goes
 * through double opt-in (src/lib/newsletter.ts).
 */
export type FeedbackState = { ok: boolean; message: string } | null;

const tooMany = (say: ReturnType<typeof sayFor>): FeedbackState => ({ ok: false, message: say("actions.tooMany") });
const emailSchema = z.string().trim().toLowerCase().email().max(320);

async function country() {
  const c = (await cookies()).get("sbc_country")?.value;
  return isKnownCountry(c) ? c : null;
}

export async function reportProblem(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const say = sayFor(formData);
  const thanks: FeedbackState = { ok: true, message: say("actions.thanksReport") };
  if (formData.get("company")) return thanks; // honeypot
  const recordKind = formData.get("record") === "bundle" ? "bundle" : "pair";
  const slug = String(formData.get("slug") ?? "");
  const kind = formData.get("kind");
  if (!isReportKind(kind)) return { ok: false, message: say("actions.pickKind") };
  if (!(recordKind === "bundle" ? getBundle(slug) : getPair(slug))) return { ok: false, message: say("actions.noRecord") };
  const visitor = visitorFrom(new Headers(await headers()));
  if (visitor.isBot) return thanks;
  if (!rateLimit("reports", visitor.key, LIMITS.reports).ok) return tooMany(say);
  // The same visitor reporting the same thing about the same page again today: thank them, count it once.
  if (!rateLimit("report-once", `${visitor.key}:${recordKind}:${slug}:${kind}`, LIMITS.oncePerDay).ok) return thanks;
  const db = getDb();
  if (!db) return { ok: false, message: say("actions.reportsClosed") };
  try {
    await recordReport(db, { recordKind, slug, kind, note: formData.get("note") as string | null, country: await country(), visitorHash: visitor.hash });
    return thanks;
  } catch (err) {
    log.error("report.failed", { err });
    return { ok: false, message: say("actions.wrong") };
  }
}

/** The same wording whatever the address's state, so the form can't be used to find out who is on the list. */
function confirmMessage(outcome: "sent" | "stored" | "unchanged", what: string, say: ReturnType<typeof sayFor>): FeedbackState {
  return {
    ok: true,
    message: mailConfigured() && outcome !== "stored" ? say("actions.almostThere", what) : say("actions.saved"),
  };
}

export async function watchSwap(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const say = sayFor(formData);
  if (formData.get("company")) return { ok: true, message: say("actions.thanks") }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: say("actions.validEmail") };
  const pair = getPair(String(formData.get("slug") ?? ""));
  if (!pair) return { ok: false, message: say("actions.noSwap") };
  if (watchTerms(pair).alternative) return { ok: false, message: say("actions.watchBarred") };
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("forms", visitor.key, LIMITS.forms).ok) return tooMany(say);
  const db = getDb();
  if (!db) return { ok: false, message: say("actions.watchesClosed") };
  try {
    const outcome = await requestWatch(
      db,
      { email: email.data, country: await country(), lang: formLang(formData), slug: pair.slug, title: pair.title, prices: pricesOf(pair) },
      { siteUrl: SITE.url },
    );
    return confirmMessage(outcome, say("actions.startWatching"), say);
  } catch (err) {
    log.error("watch.request_failed", { err });
    return { ok: false, message: say("actions.wrong") };
  }
}

export async function wishFor(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const say = sayFor(formData);
  if (formData.get("company")) return { ok: true, message: say("actions.thanks") }; // honeypot
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: say("actions.validEmail") };
  const query = normaliseQuery(formData.get("query"));
  if (!query) return { ok: false, message: say("actions.searchFirst") };
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("forms", visitor.key, LIMITS.forms).ok) return tooMany(say);
  const db = getDb();
  if (!db) return { ok: false, message: say("actions.notOpen") };
  try {
    const outcome = await requestWish(db, { email: email.data, country: await country(), lang: formLang(formData), query }, { siteUrl: SITE.url });
    return confirmMessage(outcome, say("actions.confirm"), say);
  } catch (err) {
    log.error("wish.request_failed", { err });
    return { ok: false, message: say("actions.wrong") };
  }
}
