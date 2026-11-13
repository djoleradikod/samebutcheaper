import type { Metadata } from "next";
import SearchPage, { metadata } from "@/app/search/page";
import { getT, langForCountry } from "@/lib/i18n";
import { withCountry } from "@/lib/country-url";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/search">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("searchPage.metaTitle"), description: t("searchPage.metaDescription"), alternates: { canonical: withCountry("/search", country) } };
}

/** /de/search: search in German. Noindex, like the English one. Only translated prefixes have one (see country-page.ts). */
export default async function CountrySearch({ params }: PageProps<"/country/[country]/search">) {
  await languagePageCountry(params);
  return <SearchPage />;
}
