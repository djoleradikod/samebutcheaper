import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";
import { linksEarn } from "@/lib/affiliate";
import { getCategoryStats, getClaims, getMarketCounts, getSiteStats } from "@/lib/catalog";
import { getT } from "@/lib/i18n";
import { aboutDe as a } from "@/lib/i18n/de/trust-pages";
import { rich } from "@/lib/i18n/rich";
import { countryHead, languageCard } from "@/lib/seo-catalog";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/about">): Promise<Metadata> {
  const country = await metadataCountry(params);
  return { title: a.title, description: a.description, ...languageCard(country, a.title, a.description, "/about"), ...countryHead("/about", country) };
}

function inWords(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}` : items.join("");
}

/** The publishers we cite most, as the English page names them. */
function topPublishers(limit = 2) {
  const counts = new Map<string, number>();
  for (const c of getClaims()) for (const s of c.sources) counts.set(s.publisher, (counts.get(s.publisher) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([name]) => name);
}

const outside = (href: string, label: string, rel = "noopener") => (
  <a href={href} target="_blank" rel={rel}>
    {label}
  </a>
);

/** /de/about: what the site does, in German, from the same catalogue figures as the English /about. */
export default async function GermanAbout({ params }: PageProps<"/country/[country]/about">) {
  await languagePageCountry(params);
  const t = getT("de");
  const stats = getSiteStats();
  const aisles = getCategoryStats().filter((c) => c.count > 0).map((c) => t(`categories.${c.slug}.name`));
  const markets = Object.keys(getMarketCounts()).map((m) => t(`markets.name.${m as "US"}`));
  const publishers = topPublishers();
  const earns = linksEarn();
  return (
    <ProsePage title={a.title} intro={a.intro}>
      <p>{a.question}</p>
      <p>{rich(a.count(stats.pairs, inWords(aisles), inWords(markets)), { baskets: <Link href="/bundles">{a.baskets}</Link> })}</p>

      <h2>{a.whyHeading}</h2>
      <p>
        {publishers.length > 0 ? a.testers(inWords(publishers)) : a.testersNone}
        {rich(a.why, { findings: <Link href="/why" hrefLang="en">{a.findings}</Link> })}
      </p>

      <h2>{a.listedHeading}</h2>
      <p>{rich(a.listed, { standards: <Link href="/how-we-verify">{a.standards}</Link> })}</p>
      <p>{a.health}</p>

      <h2>{a.pricesHeading}</h2>
      <p>
        {rich(a.prices, {
          openPrices: outside("https://prices.openfoodfacts.org", "Open Prices"),
          odbl: outside("https://opendatacommons.org/licenses/odbl/", a.odbl, "noopener license"),
          more: <Link href="/how-we-verify#prices">{a.more}</Link>,
        })}
      </p>
      <p>{rich(a.photos, { credits: <Link href="/credits" hrefLang="en">{a.credits}</Link> })}</p>

      <h2>{a.fundedHeading}</h2>
      <p>
        {earns ? a.fundedEarns : a.fundedNone}
        {rich(a.funded, { disclosure: <Link href="/disclosure">{earns ? a.disclosureEarns : a.disclosureNone}</Link> })}
      </p>

      <h2>{a.wrongHeading}</h2>
      <p>{rich(a.wrong, { suggest: <Link href="/suggest" hrefLang="en">{a.suggest}</Link> })}</p>
    </ProsePage>
  );
}
