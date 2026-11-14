import type { Metadata } from "next";
import UnsubscribePage from "@/app/newsletter/unsubscribe/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.unsubscribeTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };

/** /de/newsletter/unsubscribe: the unsubscribe page for a German subscriber's emails. */
export default async function CountryUnsubscribe({ params, searchParams }: PageProps<"/country/[country]/newsletter/unsubscribe">) {
  await languagePageCountry(params);
  return <UnsubscribePage searchParams={searchParams} />;
}
