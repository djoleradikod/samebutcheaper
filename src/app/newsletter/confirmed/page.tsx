import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { pageT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "You're on the list", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/confirmed is the German one. */
export default function ConfirmedPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.confirmedTitle")} intro={t("newsletterPages.confirmedIntro")}>
      <p>{t("newsletterPages.confirmedBody")}</p>
      <p>
        {rich(t("newsletterPages.confirmedNext"), {
          biggest: <Link href="/biggest-savings">{t("newsletterPages.seeBiggest")}</Link>,
          check: <Link href="/check">{t("newsletterPages.checkProduct")}</Link>,
        })}
      </p>
    </ProsePage>
  );
}
