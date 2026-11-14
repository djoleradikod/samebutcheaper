import Link from "@/components/CountryLink";
import { Fragment, Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { ProsePage } from "@/components/ProsePage";
import { cookieParagraphs, policyFacts, type PolicyText } from "@/lib/privacy-facts";
import { SITE } from "@/lib/site";

/**
 * The privacy policy, for /privacy (English) and /datenschutz (German): the same sections from the same facts
 * (src/lib/privacy-facts.ts), in the page's language. The periods, the photo switch, the backup count and who is
 * responsible are read from the server's settings when the page is asked for.
 */
export function PrivacyPolicy({ text }: { text: PolicyText }) {
  return (
    <ProsePage eyebrow={text.page.eyebrow} title={text.page.title} intro={text.page.intro}>
      <Suspense fallback={<p>{text.page.loading}</p>}>
        <Policy text={text} />
      </Suspense>
    </ProsePage>
  );
}

/** `code` and the {mail} / {impressum} links, inside one paragraph's text. */
function rich(s: string, text: PolicyText): ReactNode {
  return s.split(/(`[^`]+`|\{mail\}|\{impressum\})/).map((part, i) => {
    if (part === "{mail}") return <a key={i} href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
    if (part === "{impressum}") return <Link key={i} href="/impressum">{text.impressumLink}</Link>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

async function Policy({ text }: { text: PolicyText }) {
  await connection();
  const facts = policyFacts(process.env);
  const paragraphs = (list: string[]) => list.map((p) => <p key={p}>{rich(p, text)}</p>);
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
            <strong>{item.lead}</strong> {rich(item.text, text)}
          </li>
        ))}
      </ul>
      <h2>{text.page.logsHeading}</h2>
      {paragraphs(text.logs(facts))}
      <h2>{text.page.cookiesHeading}</h2>
      {paragraphs(cookieParagraphs(text, facts))}
      <h2>{text.page.storageHeading}</h2>
      {paragraphs(text.storage)}
      <h2>{text.page.processorsHeading}</h2>
      {paragraphs(text.processors(facts))}
      <h2>{text.page.basesHeading}</h2>
      {paragraphs(text.bases(facts))}
      <h2>{text.page.rightsHeading}</h2>
      {paragraphs(text.rights)}
      <h2>{text.page.choicesHeading}</h2>
      <p>{rich(text.choices, text)}</p>
      <p>{rich(text.whoRuns, text)}</p>
    </>
  );
}
