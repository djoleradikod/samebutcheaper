import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { CountryProvider, FollowCountry } from "@/components/CountryProvider";
import { FallbackBand } from "@/components/Money";
import { getAllPairs } from "@/lib/catalog";
import { hasBand, localFor } from "@/lib/localize";
import { MARKET_CODES } from "@/lib/markets";
import { getCountry, getLocal, getUrlCountry } from "@/lib/server-country";
import { PATH_COUNTRY_SCRIPT } from "@/lib/country-url";
import { shopperAttributesScript } from "@/lib/reserve";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SourceCarrier } from "@/components/SourceCarrier";
import { ConsentSlot } from "@/components/ConsentSlot";
import { jsonLdText, SITE } from "@/lib/site";
import { ByLang, Html } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n";

/** One family. The width axis does the work a second typeface would do. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const TITLE = `${SITE.name}: same job, lower price`;
const DESCRIPTION =
  "Cheaper products that do the same job as the brand names, from groceries and cleaning to baby, pet and tech. Compared per unit, with the sources and an honest list of what differs.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: TITLE,
    template: `%s | ${SITE.name}`,
  },
  description: DESCRIPTION,
  applicationName: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/", types: { "application/atom+xml": [{ url: "/feed.xml", title: `${SITE.name}: newest price checks` }] } },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

/**
 * Says whose prices the page shows and asks the server again when the country changes. This is the one per-request part
 * every page has. The parts of a page that depend on the country are each in their own CountryPart, and the rest is static.
 */
async function CountryBand() {
  const country = await getCountry();
  const { others } = await getLocal();
  // A prefixed URL (/de/...) is that country's view and can't show other countries' swaps, so it offers none.
  const fixed = (await getUrlCountry()) !== null;
  const strict = localFor(country);
  const wide = localFor(country, true);
  const hidden = fixed ? 0 : getAllPairs().filter((p) => wide.shows(p) && !strict.shows(p)).length;
  return (
    <CountryProvider country={country} others={others} fixed={fixed}>
      <FollowCountry country={country} others={others} fixed={fixed} />
      <FallbackBand hidden={hidden} />
    </CountryProvider>
  );
}

/**
 * The band streams in after the first paint, so without this it pushes a fallback country's whole page down. Static HTML can't
 * know the country, but the browser can read the cookie before it paints, and globals.css holds the band's height from there.
 * The same script names the shopper's country and currency on <html> for the record pages' reservations (src/lib/reserve.ts).
 */
const OWN_PRICES = MARKET_CODES.filter((m) => !hasBand(m)).join("|");
// Countries with their own prices that can ask for others (Canada): their band says more, so it needs more room on phones.
const LONG_BAND = MARKET_CODES.filter((m) => hasBand(m) && !localFor(m).fallback).join("|") || "-";
const RESERVE_BAND = `(function(){${PATH_COUNTRY_SCRIPT}var m=document.cookie.match(/(?:^|; )sbc_country=([A-Z]{2})/);var c=pathCountry||(m&&m[1]);if(c&&!/^(${OWN_PRICES})$/.test(c))document.documentElement.setAttribute("data-band",/^(${LONG_BAND})$/.test(c)?"long":"");${shopperAttributesScript()}})()`;

/** The site's JSON-LD; the German one searches and describes in German. */
function siteJsonLd(lang: "en" | "de") {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE.url,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE.url}${lang === "de" ? "/de" : ""}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/apple-icon.png`,
      description: lang === "de" ? getT("de")("layout.siteDescription") : SITE.description,
      email: SITE.contactEmail,
    },
  ];
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <Html className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: RESERVE_BAND }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-tile focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2"
        >
          <ByLang en={getT("en")("layout.skip")} de={getT("de")("layout.skip")} />
        </a>
        <ByLang en={<SiteHeader />} de={<SiteHeader lang="de" />} />
        <main id="main" className="min-h-svh flex-1">
          <Suspense fallback={<div className="band-slot" aria-hidden="true" />}>
            <CountryBand />
          </Suspense>
          {children}
        </main>
        <ByLang en={<SiteFooter />} de={<SiteFooter lang="de" />} />
        <SourceCarrier />
        <ByLang en={<ConsentSlot />} de={<ConsentSlot lang="de" />} />
        <script src="/sw-register.js" async />
        <ByLang
          en={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(siteJsonLd("en")) }} />}
          de={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(siteJsonLd("de")) }} />}
        />
      </body>
    </Html>
  );
}
