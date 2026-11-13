import type { Metadata } from "next";
import BiggestSavingsPage, { metadata } from "@/app/biggest-savings/page";
import { countryHead } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/biggest-savings">): Promise<Metadata> {
  return { ...metadata, ...countryHead("/biggest-savings", await metadataCountry(params)) };
}

/** /biggest-savings in one country's view: the same page, with every CountryPart rendered for the URL's country. */
export default async function CountryBiggestSavings({ params }: PageProps<"/country/[country]/biggest-savings">) {
  await pageCountry(params);
  return <BiggestSavingsPage />;
}
