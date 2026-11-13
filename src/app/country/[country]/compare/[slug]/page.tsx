import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { swapMetadata, SwapView } from "@/app/compare/[slug]/SwapView";
import { getPair } from "@/lib/catalog";
import { countryForPrefix } from "@/lib/country-url";
import { prefixedSlugs } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "../../country-page";

/** Only the views this country lists: they are the indexable ones. The rest render on the first visit and are noindex. */
export function generateStaticParams({ params }: { params: { country: string } }) {
  const country = countryForPrefix(params.country);
  const slugs = country ? prefixedSlugs("compare", country) : [];
  // Cache Components needs at least one param to check the route. This one renders the 404.
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__no-swaps__" }];
}

export async function generateMetadata({ params }: PageProps<"/country/[country]/compare/[slug]">): Promise<Metadata> {
  const country = await metadataCountry(params);
  return swapMetadata((await params).slug, country);
}

export default async function CountryComparePage({ params }: PageProps<"/country/[country]/compare/[slug]">) {
  const country = await pageCountry(params);
  const record = getPair((await params).slug);
  if (!record) notFound();
  return <SwapView record={record} country={country} />;
}
