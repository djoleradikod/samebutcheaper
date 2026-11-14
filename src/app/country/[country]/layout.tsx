import { CountryProvider } from "@/components/CountryProvider";
import { FixedBand } from "@/components/CountryBand";
import { countryForPrefix, PREFIXES } from "@/lib/country-url";

/**
 * Country URLs (/us, /uk, /de, /ca, /ie). Each prefix is prerendered; the pages below choose which of their slugs to
 * prerender under it (only the indexable views). See src/lib/country-url.ts for the design.
 */
export function generateStaticParams() {
  return PREFIXES.map((country) => ({ country }));
}

/**
 * The URL's country for every client component on the page, the cookie notwithstanding: prices, the switcher's links
 * and every CountryLink. The server components get it from the page (see country-page.ts).
 */
export default async function CountryLayout({ children, params }: LayoutProps<"/country/[country]">) {
  const prefix = (await params).country;
  const country = countryForPrefix(prefix);
  return (
    <>
      <FixedBand prefix={prefix} />
      <CountryProvider country={country} others={false} fixed>
        {children}
      </CountryProvider>
    </>
  );
}
