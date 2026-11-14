import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { pageT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/unsubscribed is the German one. */
export default function UnsubscribedPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.unsubscribedTitle")} intro={t("newsletterPages.unsubscribedIntro")}>
      <p>{rich(t("newsletterPages.unsubscribedBody"), { home: <Link href="/">{t("newsletterPages.homePage")}</Link> })}</p>
    </ProsePage>
  );
}
