import type { Metadata } from "next";
import ConfirmedPage from "@/app/newsletter/confirmed/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.confirmedTitle"), robots: { index: false, follow: false } };

export default async function CountryConfirmed({ params }: PageProps<"/country/[country]/newsletter/confirmed">) {
  await languagePageCountry(params);
  return <ConfirmedPage />;
}
