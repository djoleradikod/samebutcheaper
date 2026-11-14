import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { log } from "@/lib/log";
import { confirmTarget, isToken, TOKEN_PAGE_LIMITS, type ConfirmTarget } from "@/lib/newsletter";
import { ProsePage } from "@/components/ProsePage";
import { rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";
import { getLang, pageT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

// The secret is in this page's address: don't pass it on to the next page in a Referer header.
export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "no-referrer" };

type SearchParams = PageProps<"/newsletter/confirm">["searchParams"];

/**
 * Where a confirmation email's link lands, in the subscriber's language (/de/newsletter/confirm in German, through
 * src/app/country/[country]/newsletter). Opening it changes nothing (mail scanners open every link); it says what is
 * being confirmed and offers one button, a plain form post, so it works without JavaScript.
 */
export default function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.confirmTitle")} intro={t("newsletterPages.confirmIntro")}>
      <Suspense fallback={<p>{t("newsletterPages.loading")}</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </ProsePage>
  );
}

async function Confirm({ searchParams }: { searchParams: SearchParams }) {
  const t = pageT();
  const lang = getLang();
  const raw = (await searchParams).t;
  const secret = typeof raw === "string" ? raw : "";
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("token-pages", visitor.key, TOKEN_PAGE_LIMITS).ok) {
    return <p>{t("newsletterPages.tooMany")}</p>;
  }
  const db = getDb();
  let target: ConfirmTarget | null = null;
  if (db && isToken(secret)) {
    try {
      target = await confirmTarget(db, secret);
    } catch (err) {
      log.error("newsletter.confirm_page_failed", { err });
      return <p>{t("newsletterPages.ourSide")}</p>;
    }
  }
  if (!target) return <Unusable />;
  // A link from an email sent before the links followed the subscriber's language.
  if (target.lang === "de" && lang === "en") redirect(`/de/newsletter/confirm?t=${encodeURIComponent(secret)}`);
  const email = <strong>{target.email}</strong>;
  const what =
    target.kind === "letter"
      ? rich(t("newsletterPages.confirmLetter"), { email })
      : target.kind === "watch"
        ? rich(t("newsletterPages.confirmWatch"), {
            email,
            swap: (
              <Link href={`/compare/${target.slug}`} rel="noreferrer">
                {target.title}
              </Link>
            ),
          })
        : rich(t("newsletterPages.confirmWish", target.query), { email });
  return (
    <>
      <p>{what}</p>
      <form method="post" action="/api/newsletter/confirm" className="not-prose mt-5">
        <input type="hidden" name="t" value={secret} />
        {lang !== "en" && <input type="hidden" name="lang" value={lang} />}
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {t(target.kind === "letter" ? "newsletterPages.yesLetter" : target.kind === "watch" ? "newsletterPages.yesWatch" : "newsletterPages.yesWish")}
        </button>
      </form>
      <p className="text-sm text-muted">{t("newsletterPages.notAsked")}</p>
    </>
  );
}

function Unusable() {
  const t = pageT();
  return (
    <>
      <p>{t("newsletterPages.usedLink")}</p>
      <p>{rich(t("newsletterPages.askAgain"), { home: <Link href="/">{t("newsletterPages.homePage")}</Link> })}</p>
    </>
  );
}
