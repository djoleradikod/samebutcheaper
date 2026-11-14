import type { Metadata } from "next";
import { ProsePage } from "@/components/ProsePage";
import { amazonEarns, linksEarn } from "@/lib/affiliate";
import { disclosureDe as d } from "@/lib/i18n/de/trust-pages";
import { countryHead, languageCard } from "@/lib/seo-catalog";
import { languagePageCountry, metadataCountry } from "../country-page";

export async function generateMetadata({ params }: PageProps<"/country/[country]/disclosure">): Promise<Metadata> {
  const country = await metadataCountry(params);
  const earns = linksEarn();
  const title = earns ? d.titleEarns : d.titleNone;
  const description = earns ? d.descriptionEarns : d.descriptionNone;
  return { title, description, ...languageCard(country, title, description, "/disclosure"), ...countryHead("/disclosure", country) };
}

/** /de/disclosure: the disclosure in German, from the same settings as the English /disclosure. */
export default async function GermanDisclosure({ params }: PageProps<"/country/[country]/disclosure">) {
  await languagePageCountry(params);
  if (!linksEarn()) {
    return (
      <ProsePage title={d.titleNone}>
        <p>
          <strong>{d.noneLead}</strong> {d.noneBody}
        </p>
        <p>{d.noneChange}</p>
        <h2>{d.decidesHeading}</h2>
        <ul>
          {d.decides.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <Prices />
      </ProsePage>
    );
  }
  return (
    <ProsePage title={d.titleEarns}>
      {amazonEarns() && (
        <p>
          {d.amazon} <strong>{d.amazonLead}</strong>
        </p>
      )}
      <p>{d.others}</p>
      <h2>{d.affectsHeading}</h2>
      <ul>
        {d.affects.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Prices />
    </ProsePage>
  );
}

function Prices() {
  return (
    <>
      <h2>{d.pricesHeading}</h2>
      <p>{d.prices}</p>
    </>
  );
}
