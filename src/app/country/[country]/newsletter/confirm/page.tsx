import type { Metadata } from "next";
import ConfirmPage from "@/app/newsletter/confirm/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.confirmTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };

/** /de/newsletter/confirm: where a German subscriber's confirmation link lands. */
export default async function CountryConfirm({ params, searchParams }: PageProps<"/country/[country]/newsletter/confirm">) {
  await languagePageCountry(params);
  return <ConfirmPage searchParams={searchParams} />;
}
