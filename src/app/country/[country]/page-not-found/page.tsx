import type { Metadata } from "next";
import NotFound from "@/app/not-found";
import { getT } from "@/lib/i18n";
import { languagePageCountry } from "../country-page";

export const metadata: Metadata = { title: getT("de")("notFound.title"), robots: { index: false, follow: false } };

/**
 * The 404 for a /de/... address that is no page, in German: src/proxy.ts rewrites it here with status 404, so the
 * layout reads the route as German and draws the German header, footer and text. Never a public URL of its own.
 */
export default async function CountryNotFound({ params }: PageProps<"/country/[country]/page-not-found">) {
  await languagePageCountry(params);
  return <NotFound />;
}
