import type { Metadata } from "next";
import MyListPage, { metadata } from "@/app/my-list/page";
import { getT, langForCountry } from "@/lib/i18n";
import { withCountry } from "@/lib/country-url";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/my-list">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("myListPage.metaTitle"), description: t("myListPage.metaDescription"), alternates: { canonical: withCountry("/my-list", country) } };
}

/** /de/my-list: My list in German. Noindex, like the English one. Only translated prefixes have one (see country-page.ts). */
export default async function CountryMyList({ params }: PageProps<"/country/[country]/my-list">) {
  await languagePageCountry(params);
  return <MyListPage />;
}
