import type { Metadata } from "next";
import CheckPage, { metadata } from "@/app/check/page";
import { countryHead } from "@/lib/seo-catalog";
import { getT, langForCountry } from "@/lib/i18n";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/check">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const t = getT(langForCountry(country));
  return { ...metadata, title: t("checkPage.metaTitle"), description: t("checkPage.metaDescription"), ...countryHead("/check", country) };
}

/** /de/check: the product check in German, for Germany. Only translated prefixes have one (see country-page.ts). */
export default async function CountryCheck({ params, searchParams }: PageProps<"/country/[country]/check">) {
  await languagePageCountry(params);
  return <CheckPage searchParams={searchParams} />;
}
