import type { Metadata } from "next";
import BiggestSavingsPage, { metadata } from "@/app/biggest-savings/page";
import { countryHead } from "@/lib/seo-catalog";
import { getT, langForCountry } from "@/lib/i18n";
import { metadataCountry, pageCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/biggest-savings">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("lists.biggest.metaTitle"), description: t("lists.biggest.metaDescription"), ...countryHead("/biggest-savings", country) };
}

/** /biggest-savings in one country's view: the same page, with every CountryPart rendered for the URL's country. */
export default async function CountryBiggestSavings({ params }: PageProps<"/country/[country]/biggest-savings">) {
  await pageCountry(params);
  return <BiggestSavingsPage />;
}
