import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { log } from "@/lib/log";
import { isScope, isToken, TOKEN_PAGE_LIMITS, unsubscribeTarget, type UnsubscribeTarget } from "@/lib/newsletter";
import { ProsePage } from "@/components/ProsePage";
import { rateLimit } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { visitorFrom } from "@/lib/visitor";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * The page behind every "unsubscribe" link in our emails. Opening it changes nothing; it says what the buttons
 * stop, and each button is a plain form post, so it works without JavaScript. Mail apps' own unsubscribe button
 * posts straight to /api/newsletter/unsubscribe (RFC 8058) and never sees this page.
 */
export default function UnsubscribePage({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <ProsePage title="Unsubscribe" intro="Stop emails from SameButCheaper to this address.">
      <Suspense fallback={<p>Loading…</p>}>
        <Buttons searchParams={searchParams} />
      </Suspense>
    </ProsePage>
  );
}

const STOP_THIS = { letter: "Stop the weekly letter", watch: "Stop watching this swap", wish: "Stop this request" } as const;

async function Buttons({ searchParams }: { searchParams: PageProps<"/newsletter/unsubscribe">["searchParams"] }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const only = typeof params.only === "string" && isScope(params.only) ? params.only : undefined;
  if (!isToken(token)) return <p>This unsubscribe link is incomplete. Open the link from one of our emails again.</p>;
  if (!rateLimit("token-pages", visitorFrom(new Headers(await headers())).key, TOKEN_PAGE_LIMITS).ok) {
    return <p>That&apos;s a lot of tries in a short time. Please wait a few minutes, then open the link again.</p>;
  }
  const db = getDb();
  let target: UnsubscribeTarget | null = null;
  try {
    target = db ? await unsubscribeTarget(db, token, only) : null;
  } catch (err) {
    log.error("newsletter.unsubscribe_page_failed", { err });
  }
  if (!target) {
    return (
      <p>
        We don&apos;t recognise this link. To be removed anyway, email{" "}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> from the address we write to.
      </p>
    );
  }
  if (!target.anythingOn) {
    return (
      <p>
        <strong>{target.email}</strong> is already unsubscribed. We don&apos;t send it anything. <Link href="/">Back to the home page</Link>
      </p>
    );
  }
  const s = target.scoped;
  const scopedOn = s && s.on;
  return (
    <>
      <p>
        This is for <strong>{target.email}</strong>.{" "}
        {s?.kind === "watch" && (s.on ? <>The first button stops the price watch on &ldquo;{s.title}&rdquo;.</> : <>The price watch on &ldquo;{s.title}&rdquo; has already stopped.</>)}
        {s?.kind === "wish" && (s.on ? <>The first button stops your request about &ldquo;{s.query}&rdquo;.</> : <>Your request about &ldquo;{s.query}&rdquo; has already ended.</>)}
        {s?.kind === "letter" && (s.on ? <>The first button stops the weekly letter; price watches you set up carry on.</> : <>The weekly letter is already off.</>)}{" "}
        &ldquo;Unsubscribe from everything&rdquo; stops every email we send to this address.
      </p>
      <div className="not-prose mt-5 flex flex-col gap-3 sm:flex-row">
        {scopedOn && s && (
          <form method="post" action="/api/newsletter/unsubscribe">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="only" value={only} />
            <button type="submit" className="btn btn-primary w-full sm:w-auto">
              {STOP_THIS[s.kind]}
            </button>
          </form>
        )}
        <form method="post" action="/api/newsletter/unsubscribe">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={`btn ${scopedOn ? "btn-ghost" : "btn-primary"} w-full sm:w-auto`}>
            {s ? "Unsubscribe from everything" : "Unsubscribe me"}
          </button>
        </form>
      </div>
    </>
  );
}
