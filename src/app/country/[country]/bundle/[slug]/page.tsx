import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { kitMetadata, KitView } from "@/app/bundle/[slug]/KitView";
import { getBundle } from "@/lib/catalog";
import { countryForPrefix } from "@/lib/country-url";
import { prefixedSlugs } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "../../country-page";
import { setPageLang } from "@/lib/i18n/server";

/** Only the kits this country lists: they are the indexable views. The rest render on the first visit and are noindex. */
export function generateStaticParams({ params }: { params: { country: string } }) {
  const country = countryForPrefix(params.country);
  const slugs = country ? prefixedSlugs("bundle", country) : [];
  // Cache Components requires at least one param; the placeholder 404s.
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/country/[country]/bundle/[slug]">): Promise<Metadata> {
  const country = await metadataCountry(params);
  return kitMetadata((await params).slug, country);
}

export default async function CountryBundlePage({ params }: PageProps<"/country/[country]/bundle/[slug]">) {
  const country = await pageCountry(params);
  setPageLang("en");
  const record = getBundle((await params).slug);
  if (!record) notFound();
  return <KitView record={record} country={country} />;
}
