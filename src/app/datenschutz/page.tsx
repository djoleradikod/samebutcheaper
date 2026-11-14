import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { Fragment, Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { ProsePage } from "@/components/ProsePage";
import { legalNotice } from "@/lib/legal";
import { retention } from "@/lib/maintenance";
import { SITE } from "@/lib/site";
import * as text from "@/lib/i18n/de/datenschutz";

/**
 * The privacy policy in German, for the German pages' footer, from src/lib/i18n/de/datenschutz.ts. The periods, the
 * photo switch, the backup count and who is responsible are read from the server's settings when the page is asked for.
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

/** The nightly copies kept (deploy/backup.sh reads the same setting). */
function backupDays(env: Record<string, string | undefined>) {
  const n = Number.parseInt(env.BACKUP_KEEP_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

async function Policy() {
  await connection();
  const facts: text.Facts = {
    keep: retention(process.env),
    photos: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    backupDays: backupDays(process.env),
    notice: legalNotice(),
  };
  const paragraphs = (list: string[]) => list.map((p) => <p key={p}>{rich(p)}</p>);
  return (
    <>
      <h2>{text.page.controllerHeading}</h2>
      <p>
        {text.controller(facts.notice).map((line, i) => (
          <Fragment key={line}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </p>
      <h2>{text.page.collectHeading}</h2>
      <ul>
        {text.collected(facts).map((item) => (
          <li key={item.lead}>
            <strong>{item.lead}</strong> {rich(item.text)}
          </li>
        ))}
      </ul>
      <h2>{text.page.logsHeading}</h2>
      {paragraphs(text.logs(facts))}
      <h2>{text.page.cookiesHeading}</h2>
      {paragraphs(text.cookies)}
      <h2>{text.page.storageHeading}</h2>
      <p>{rich(text.storage)}</p>
      <h2>{text.page.processorsHeading}</h2>
      {paragraphs(text.processors(facts))}
      <h2>{text.page.basesHeading}</h2>
      {paragraphs(text.bases)}
      <h2>{text.page.rightsHeading}</h2>
      {paragraphs(text.rights)}
      <h2>{text.page.choicesHeading}</h2>
      <p>{rich(text.choices)}</p>
      <p>{rich(text.whoRuns)}</p>
    </>
  );
}
