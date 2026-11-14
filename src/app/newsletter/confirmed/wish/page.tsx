import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { pageT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Request confirmed", robots: { index: false, follow: false } };

/** In the page's language: /de/newsletter/confirmed/wish is the German one. */
export default function WishConfirmedPage() {
  const t = pageT();
  return (
    <ProsePage title={t("newsletterPages.wishTitle")} intro={t("newsletterPages.wishIntro")}>
      <p>{t("newsletterPages.wishBody")}</p>
      <p>{t("newsletterPages.wishOnly")}</p>
      <p>
        <Link href="/suggest">{t("newsletterPages.suggest")}</Link>
      </p>
    </ProsePage>
  );
}
