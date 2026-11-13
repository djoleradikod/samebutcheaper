import type { Metadata } from "next";
import Home from "@/app/page";
import { homeHead } from "@/lib/seo-catalog";
import { metadataCountry, pageCountry } from "./country-page";

// The layout's Open Graph card (og:url "/") stays: it is the page a shared link should open for anyone.
export async function generateMetadata({ params }: PageProps<"/country/[country]">): Promise<Metadata> {
  return homeHead(await metadataCountry(params));
}

/** The home page in one country's view: the same page as /, with every CountryPart rendered for the URL's country. */
export default async function CountryHome({ params }: PageProps<"/country/[country]">) {
  await pageCountry(params);
  return <Home />;
}
