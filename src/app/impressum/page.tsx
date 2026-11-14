import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ProsePage } from "@/components/ProsePage";
import { legalNotice } from "@/lib/legal";

/**
 * The legal notice (Impressum), from the LEGAL_* settings read when the page is requested, so a change needs a
 * restart, not a rebuild. Nothing here is made up: until the owner's details are set the page says it isn't
 * published yet, and asks search engines not to index it.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const published = legalNotice() !== null;
  return {
    title: "Impressum (legal notice)",
    description: "Who runs SameButCheaper and how to reach them.",
    alternates: { canonical: "/impressum" },
    robots: published ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default function ImpressumPage() {
  return (
    <ProsePage title="Impressum" intro="Legal notice: who runs this site and how to reach them.">
      <Suspense fallback={<p>Loading…</p>}>
        <Notice />
      </Suspense>
    </ProsePage>
  );
}

async function Notice() {
  await connection();
  const n = legalNotice();
  if (!n) {
    return (
      <>
        <p lang="de">
          Das Impressum dieser Website ist noch nicht veröffentlicht. Bis dahin schicken wir unseren wöchentlichen
          Newsletter nicht an Leserinnen und Leser in Deutschland und Österreich.
        </p>
        <p>
          The legal notice for this site isn&apos;t published yet. Until it is, we don&apos;t send our weekly letter to
          readers in Germany or Austria.
        </p>
      </>
    );
  }
  return (
    <>
      <h2>Angaben gemäß § 5 DDG (information under § 5 of the German Digital Services Act)</h2>
      <p>
        {n.name}
        {n.address.map((line) => (
          <span key={line}>
            <br />
            {line}
          </span>
        ))}
      </p>
      <h2>Kontakt (contact)</h2>
      <p>
        E-Mail: <a href={`mailto:${n.email}`}>{n.email}</a>
        {n.phone && (
          <>
            <br />
            Telefon (phone): <a href={`tel:${n.phone.replace(/[^\d+]/g, "")}`}>{n.phone}</a>
          </>
        )}
      </p>
      {n.vatId && (
        <>
          <h2>Umsatzsteuer-ID (VAT number)</h2>
          <p>{n.vatId}</p>
        </>
      )}
      {n.responsible && (
        <>
          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV (responsible for content)</h2>
          <p>{n.responsible}</p>
        </>
      )}
    </>
  );
}
