import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { pageT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Stopped", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/stopped is the German one. */
export default function StoppedPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.stoppedTitle")} intro={t("newsletterPages.stoppedIntro")}>
      <p>{t("newsletterPages.stoppedBody")}</p>
      <p>
        <Link href="/">{t("newsletterPages.backHome")}</Link>
      </p>
    </ProsePage>
  );
}
