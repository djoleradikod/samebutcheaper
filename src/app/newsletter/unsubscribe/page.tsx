import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFormDb } from "@/db";
import { log } from "@/lib/log";
import { isScope, isToken, TOKEN_PAGE_LIMITS, unsubscribeTarget, type UnsubscribeTarget } from "@/lib/newsletter";
import { ProsePage } from "@/components/ProsePage";
import { rateLimit } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { visitorFrom } from "@/lib/visitor";
import { getLang, pageT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false }, referrer: "no-referrer" };

type SearchParams = PageProps<"/newsletter/unsubscribe">["searchParams"];

/**
 * The page behind every "unsubscribe" link in our emails, in the subscriber's language (/de/newsletter/unsubscribe in
 * German). Opening it changes nothing; it says what the buttons stop, and each button is a plain form post, so it
 * works without JavaScript. Mail apps' own unsubscribe button posts straight to /api/newsletter/unsubscribe
 * (RFC 8058) and never sees this page.
 */
export default function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.unsubscribeTitle")} intro={t("newsletterPages.unsubscribeIntro")}>
      <Suspense fallback={<p>{t("newsletterPages.loading")}</p>}>
        <Buttons searchParams={searchParams} />
      </Suspense>
    </ProsePage>
  );
}

const STOP_THIS = { letter: "newsletterPages.stopLetter", watch: "newsletterPages.stopWatch", wish: "newsletterPages.stopWish" } as const;

async function Buttons({ searchParams }: { searchParams: SearchParams }) {
  const t = pageT();
  const lang = getLang();
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const only = typeof params.only === "string" && isScope(params.only) ? params.only : undefined;
  if (!isToken(token)) return <p>{t("newsletterPages.incomplete")}</p>;
  if (!rateLimit("token-pages", visitorFrom(new Headers(await headers())).key, TOKEN_PAGE_LIMITS).ok) {
    return <p>{t("newsletterPages.tooMany")}</p>;
  }
  const db = getFormDb();
  let target: UnsubscribeTarget | null = null;
  try {
    target = db ? await unsubscribeTarget(db, token, only) : null;
  } catch (err) {
    log.error("newsletter.unsubscribe_page_failed", { err });
  }
  const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
  if (!target) return <p>{rich(t("newsletterPages.unknownLink"), { mail })}</p>;
  // A link from an email sent before the links followed the subscriber's language.
  if (target.lang === "de" && lang === "en") redirect(`/de/newsletter/unsubscribe?token=${encodeURIComponent(token)}${only ? `&only=${only}` : ""}`);
  const email = <strong>{target.email}</strong>;
  if (!target.anythingOn) {
    return (
      <p>
        {rich(t("newsletterPages.alreadyOff"), { email })} <Link href="/">{t("newsletterPages.backHome")}</Link>
      </p>
    );
  }
  const s = target.scoped;
  const scopedOn = s && s.on;
  const scopeLine =
    s?.kind === "watch"
      ? t(s.on ? "newsletterPages.watchOn" : "newsletterPages.watchOff", s.title)
      : s?.kind === "wish"
        ? t(s.on ? "newsletterPages.wishOn" : "newsletterPages.wishOff", s.query)
        : s?.kind === "letter"
          ? t(s.on ? "newsletterPages.letterOn" : "newsletterPages.letterOff")
          : null;
  const langField = lang !== "en" && <input type="hidden" name="lang" value={lang} />;
  return (
    <>
      <p>
        {rich(t("newsletterPages.thisIsFor"), { email })} {scopeLine && <>{scopeLine} </>}
        {t("newsletterPages.everything")}
      </p>
      <div className="not-prose mt-5 flex flex-col gap-3 sm:flex-row">
        {scopedOn && s && (
          <form method="post" action="/api/newsletter/unsubscribe">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="only" value={only} />
            {langField}
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              {t(STOP_THIS[s.kind])}
            </button>
          </form>
        )}
        <form method="post" action="/api/newsletter/unsubscribe">
          <input type="hidden" name="token" value={token} />
          {langField}
          <button type="submit" className={`btn ${scopedOn ? "btn-ghost" : "btn-primary"} w-full sm:w-auto`}>
            {t(s ? "newsletterPages.stopEverything" : "newsletterPages.stopMe")}
          </button>
        </form>
      </div>
    </>
  );
}
