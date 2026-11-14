import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { ProsePage } from "@/components/ProsePage";
import { linksEarn } from "@/lib/affiliate";
import { getAllPairs, getSiteStats } from "@/lib/catalog";
import { verifyDe as v } from "@/lib/i18n/de/trust-pages";
import { rich } from "@/lib/i18n/rich";
import { oneOfEachSwap } from "@/lib/localize";
import { countryHead, languageCard } from "@/lib/seo-catalog";
import type { MatchType } from "@/lib/types";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/how-we-verify">): Promise<Metadata> {
  const country = await metadataCountry(params);
  return { title: v.title, description: v.description, ...languageCard(country, v.title, v.description, "/how-we-verify"), ...countryHead("/how-we-verify", country) };
}

/** In the order a shopper meets them, with medicine's standard last, as on the English page. */
const ORDER: MatchType[] = ["equivalent_spec", "identical_formula", "same_manufacturer", "identical_active", "same_kind"];

const outside = (href: string, label: string, rel = "noopener") => (
  <a href={href} target="_blank" rel={rel}>
    {label}
  </a>
);

/** /de/how-we-verify: how we check, in German, with the same counts as the English /how-we-verify. */
export default async function GermanHowWeVerify({ params }: PageProps<"/country/[country]/how-we-verify">) {
  await languagePageCountry(params);
  const stats = getSiteStats();
  const pairs = oneOfEachSwap(getAllPairs());
  const count = (type: MatchType) => pairs.filter((p) => p.match_type === type).length;
  return (
    <ProsePage title={v.title} intro={v.intro(stats.pairs, stats.categories)}>
      <h2>{v.labelsHeading}</h2>
      {ORDER.map((type) => (
        <div key={type} className="card my-3 px-4 py-3">
          <p className="my-0 flex flex-wrap items-baseline justify-between gap-x-3">
            <MatchBadge type={type} long lang="de" />
            <span className="num text-[13px] text-muted">{v.count(count(type))}</span>
          </p>
          <p className="mt-1.5 mb-0 text-sm">{v.standards[type]}</p>
        </div>
      ))}

      <h2>{v.sureHeading}</h2>
      <ul>
        <li>
          <ConfidenceBadge confidence="high" lang="de" />
          {v.high}
        </li>
        <li>
          <ConfidenceBadge confidence="medium" lang="de" />
          {v.medium}
        </li>
      </ul>
      <p>{v.weaker}</p>

      <h2 id="prices" className="scroll-mt-24">
        {v.pricesHeading}
      </h2>
      <p>{v.pricesIntro}</p>
      <ul>
        <li>
          <strong>{v.openPricesLead}</strong>{" "}
          {rich(v.openPrices, {
            openPrices: outside("https://prices.openfoodfacts.org", "Open Prices"),
            odbl: outside("https://opendatacommons.org/licenses/odbl/", "Open Database Licence (ODbL)", "noopener license"),
          })}
        </li>
        <li>
          <strong>{v.storesLead}</strong> {v.stores}
        </li>
        <li>
          <strong>{v.testsLead}</strong> {v.tests}
        </li>
      </ul>
      <p>{v.checkPrice}</p>

      <h2>{v.savingHeading}</h2>
      <p>{rich(v.unitPrice, { unitPrice: <strong>{v.unitPriceWord}</strong> })}</p>
      <p>{rich(v.basket, { basket: <Link href="/bundles">{v.basketWord}</Link> })}</p>
      <p>{rich(v.bulk, { keeps: <Link href="/why#keeps" hrefLang="en">{v.keeps}</Link> })}</p>

      <h2>{v.brandHeading}</h2>
      <p>{rich(v.brand, { lost: <Link href="/why#lost" hrefLang="en">{v.lost}</Link> })}</p>

      <h2>{v.leaveHeading}</h2>
      <ul>
        {v.leave.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <h2>{v.rankHeading}</h2>
      <p>
        {v.rank}
        {linksEarn()
          ? rich(v.rankEarns, { affiliate: <Link href="/disclosure">{v.affiliate}</Link> })
          : rich(v.rankNone, { disclosure: <Link href="/disclosure">{v.disclosure}</Link> })}
      </p>
      <p>{rich(v.photos, { credits: <Link href="/credits" hrefLang="en">{v.credits}</Link> })}</p>

      <h2>{v.mistakeHeading}</h2>
      <p>{rich(v.mistake, { suggest: <Link href="/suggest" hrefLang="en">{v.suggest}</Link> })}</p>
    </ProsePage>
  );
}
