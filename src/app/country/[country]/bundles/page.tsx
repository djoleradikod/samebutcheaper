import type { Metadata } from "next";
import BundlesPage, { metadata } from "@/app/bundles/page";
import { countryHead } from "@/lib/seo-catalog";
import { getT, langForCountry } from "@/lib/i18n";
import { metadataCountry, pageCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/bundles">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("bundlesPage.metaTitle"), description: t("bundlesPage.metaDescription"), ...countryHead("/bundles", country) };
}

/** /bundles in one country's view: the same page, with every CountryPart rendered for the URL's country. */
export default async function CountryBundles({ params }: PageProps<"/country/[country]/bundles">) {
  await pageCountry(params);
  return <BundlesPage />;
}
