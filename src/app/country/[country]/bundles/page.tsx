import type { Metadata } from "next";
import BundlesPage, { metadata } from "@/app/bundles/page";
import { countryHead } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/bundles">): Promise<Metadata> {
  return { ...metadata, ...countryHead("/bundles", await metadataCountry(params)) };
}

/** /bundles in one country's view: the same page, with every CountryPart rendered for the URL's country. */
export default async function CountryBundles({ params }: PageProps<"/country/[country]/bundles">) {
  await pageCountry(params);
  return <BundlesPage />;
}
