import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { SITE } from "@/lib/site";
import { pageT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "That link didn't work", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/invalid is the German one. */
export default function InvalidLinkPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.invalidTitle")} intro={t("newsletterPages.invalidIntro")}>
      <p>{rich(t("newsletterPages.invalidBody"), { home: <Link href="/">{t("newsletterPages.homePage")}</Link> })}</p>
      <p>{rich(t("newsletterPages.invalidUnsubscribe"), { mail: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> })}</p>
    </ProsePage>
  );
}
