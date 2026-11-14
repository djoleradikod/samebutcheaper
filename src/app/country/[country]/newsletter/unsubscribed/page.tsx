import type { Metadata } from "next";
import UnsubscribedPage from "@/app/newsletter/unsubscribed/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.unsubscribedTitle"), robots: { index: false, follow: false } };

export default async function CountryUnsubscribed({ params }: PageProps<"/country/[country]/newsletter/unsubscribed">) {
  await languagePageCountry(params);
  return <UnsubscribedPage />;
}
