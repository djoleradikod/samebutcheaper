import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { Fragment, Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { ProsePage } from "@/components/ProsePage";
import { retention } from "@/lib/maintenance";
import { SITE } from "@/lib/site";
import * as text from "@/lib/i18n/de/datenschutz";

/**
 * The privacy policy in German, for the German pages' footer. A translation of /privacy, from
 * src/lib/i18n/de/datenschutz.ts, with the same retention periods read from the server's settings.
 */
export const metadata: Metadata = {
  title: text.meta.title,
  description: text.meta.description,
  alternates: { canonical: "/datenschutz" },
};

/** `code` and the {mail} / {impressum} links, inside one paragraph's text. */
function rich(s: string): ReactNode {
  return s.split(/(`[^`]+`|\{mail\}|\{impressum\})/).map((part, i) => {
    if (part === "{mail}") return <a key={i} href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
    if (part === "{impressum}") return <Link key={i} href="/impressum">{text.impressumLink}</Link>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export default function DatenschutzPage() {
  return (
    <ProsePage title={text.page.title} intro={text.page.intro}>
      <Suspense fallback={<p>{text.page.loading}</p>}>
        <Policy />
      </Suspense>
    </ProsePage>
  );
}

async function Policy() {
  await connection();
  const keep = retention(process.env);
  return (
    <>
      <h2>{text.page.collectHeading}</h2>
      <ul>
        {text.collected(keep).map((item) => (
          <li key={item.lead}>
            <strong>{item.lead}</strong> {rich(item.text)}
          </li>
        ))}
      </ul>
      <h2>{text.page.cookiesHeading}</h2>
      <p>{rich(text.cookies)}</p>
      <h2>{text.page.processorsHeading}</h2>
      <p>{text.processors}</p>
      <h2>{text.page.choicesHeading}</h2>
      <p>{rich(text.choices)}</p>
      <p>{rich(text.whoRuns)}</p>
    </>
  );
}
