import type { Metadata } from "next";
import WishConfirmedPage from "@/app/newsletter/confirmed/wish/page";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../../../country-page";

export const metadata: Metadata = { title: getT("de")("newsletterPages.wishTitle"), robots: { index: false, follow: false } };

export default async function CountryWishConfirmed({ params }: PageProps<"/country/[country]/newsletter/confirmed/wish">) {
  await languagePageCountry(params);
  return <WishConfirmedPage />;
}
