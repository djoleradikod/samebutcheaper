import type { Metadata } from "next";
import CheckListPage, { metadata } from "@/app/check/list/page";
import { countryHead } from "@/lib/seo-catalog";
import { getT, langForCountry } from "@/lib/i18n";
import { languagePageCountry, metadataCountry } from "../../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/check/list">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("checkList.metaTitle"), description: t("checkList.metaDescription"), ...countryHead("/check/list", country) };
}

/** /de/check/list: the shopping-list check in German, for Germany. Only translated prefixes have one (see country-page.ts). */
export default async function CountryCheckList({ params, searchParams }: PageProps<"/country/[country]/check/list">) {
  await languagePageCountry(params);
  return <CheckListPage searchParams={searchParams} />;
}
