import type { Metadata } from "next";
import WatchConfirmedPage from "@/app/newsletter/confirmed/watch/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.watchTitle"), robots: { index: false, follow: false } };

export default async function CountryWatchConfirmed({ params }: PageProps<"/country/[country]/newsletter/confirmed/watch">) {
  await languagePageCountry(params);
  return <WatchConfirmedPage />;
}
