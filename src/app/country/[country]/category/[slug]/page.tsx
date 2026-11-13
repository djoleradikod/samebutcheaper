import type { Metadata } from "next";
import CategoryPage from "@/app/category/[slug]/page";
import { aisleMetadata } from "@/app/category/[slug]/aisle-meta";
import { langForCountry } from "@/lib/i18n";
import { countryForPrefix } from "@/lib/country-url";
import { countryHead, prefixedSlugs } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "../../country-page";

/** Only aisles this country lists something in. An empty one renders on the first visit and is noindex. */
export function generateStaticParams({ params }: { params: { country: string } }) {
  const country = countryForPrefix(params.country);
  const slugs = country ? prefixedSlugs("category", country) : [];
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "__none__" }];
}

export async function generateMetadata(props: PageProps<"/country/[country]/category/[slug]">): Promise<Metadata> {
  const country = await metadataCountry(props.params);
  const { slug } = await props.params;
  const base = await aisleMetadata(slug, langForCountry(country));
  // An aisle no country lists anything in keeps its own noindex. One this country lists nothing in is noindex here.
  return { ...base, ...(countryHead(`/category/${slug}`, country) ?? {}) };
}

/** An aisle in one country's view: the same page, with every CountryPart rendered for the URL's country. */
export default async function CountryCategoryPage(props: PageProps<"/country/[country]/category/[slug]">) {
  await pageCountry(props.params);
  const { slug } = await props.params;
  return <CategoryPage params={Promise.resolve({ slug })} searchParams={props.searchParams} />;
}
