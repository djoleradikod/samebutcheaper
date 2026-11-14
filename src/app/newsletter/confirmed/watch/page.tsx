import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { pageT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "You're watching this swap", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/confirmed/watch is the German one. */
export default function WatchConfirmedPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.watchTitle")} intro={t("newsletterPages.watchIntro")}>
      <p>{t("newsletterPages.watchBody")}</p>
      <p>{t("newsletterPages.watchOnly")}</p>
      <p>
        <Link href="/biggest-savings">{t("newsletterPages.seeBiggest")}</Link>
      </p>
    </ProsePage>
  );
}
