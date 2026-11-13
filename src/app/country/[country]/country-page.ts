import "server-only";
import { notFound } from "next/navigation";
import { countryForPrefix, type PrefixedCountry } from "@/lib/country-url";
import { setPathCountry } from "@/lib/path-country";

/**
 * Every page under src/app/country/[country] starts with this. The folder is never a public URL: src/proxy.ts rewrites
 * /de/compare/x here and answers 404 for /country/... itself (see src/lib/country-url.ts and docs/country-urls.md).
 * It reads the URL's country and sets it for every CountryPart on the page, so the page renders that country's view
 * into its static HTML. Pages reused from the unprefixed routes need no change for that.
 */
export async function pageCountry(params: Promise<{ country: string }>): Promise<PrefixedCountry> {
  const country = countryForPrefix((await params).country);
  if (!country) notFound();
  setPathCountry(country);
  return country;
}

/** The country in metadata, where nothing renders: the same check, without setting it. */
export async function metadataCountry(params: Promise<{ country: string }>): Promise<PrefixedCountry> {
  const country = countryForPrefix((await params).country);
  if (!country) notFound();
  return country;
}
