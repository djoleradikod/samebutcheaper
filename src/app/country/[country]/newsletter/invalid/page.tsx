import type { Metadata } from "next";
import InvalidLinkPage from "@/app/newsletter/invalid/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.invalidTitle"), robots: { index: false, follow: false } };

export default async function CountryInvalidLink({ params }: PageProps<"/country/[country]/newsletter/invalid">) {
  await languagePageCountry(params);
  return <InvalidLinkPage />;
}
