import type { Metadata } from "next";
import StoppedPage from "@/app/newsletter/stopped/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.stoppedTitle"), robots: { index: false, follow: false } };

export default async function CountryStopped({ params }: PageProps<"/country/[country]/newsletter/stopped">) {
  await languagePageCountry(params);
  return <StoppedPage />;
}
