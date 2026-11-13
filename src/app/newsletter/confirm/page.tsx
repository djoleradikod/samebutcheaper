import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { Suspense } from "react";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { log } from "@/lib/log";
import { confirmTarget, isToken, TOKEN_PAGE_LIMITS, type ConfirmTarget } from "@/lib/newsletter";
import { ProsePage } from "@/components/ProsePage";
import { rateLimit } from "@/lib/rate-limit";
import { visitorFrom } from "@/lib/visitor";

// The secret is in this page's address: don't pass it on to the next page in a Referer header.
export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Where a confirmation email's link lands. Opening it changes nothing (mail scanners open every link); it says what
 * is being confirmed and offers one button, a plain form post, so it works without JavaScript.
 */
export default function ConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  return (
    <ProsePage title="Confirm your email" intro="One more step: press the button to confirm.">
      <Suspense fallback={<p>Loading…</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </ProsePage>
  );
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/newsletter/confirm">["searchParams"] }) {
  const raw = (await searchParams).t;
  const secret = typeof raw === "string" ? raw : "";
  const visitor = visitorFrom(new Headers(await headers()));
  if (!rateLimit("token-pages", visitor.key, TOKEN_PAGE_LIMITS).ok) {
    return <p>That&apos;s a lot of tries in a short time. Please wait a few minutes, then open the link again.</p>;
  }
  const db = getDb();
  let target: ConfirmTarget | null = null;
  if (db && isToken(secret)) {
    try {
      target = await confirmTarget(db, secret);
    } catch (err) {
      log.error("newsletter.confirm_page_failed", { err });
      return <p>Something went wrong on our side. Please try the link again in a few minutes.</p>;
    }
  }
  if (!target) return <Unusable />;
  return (
    <>
      <p>
        You&apos;re confirming that <strong>{target.email}</strong> {what(target)}
      </p>
      <form method="post" action="/api/newsletter/confirm" className="not-prose mt-5">
        <input type="hidden" name="t" value={secret} />
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {target.kind === "letter" ? "Yes, send me new swaps" : target.kind === "watch" ? "Yes, watch this swap" : "Yes, tell me"}
        </button>
      </form>
      <p className="text-sm text-muted">
        Didn&apos;t ask for this? Close this page and nothing happens. The request is removed after 30 days.
      </p>
    </>
  );
}

function what(target: ConfirmTarget) {
  if (target.kind === "letter") {
    return <>should get our weekly letter: new swaps we&apos;ve checked, at most one email a week.</>;
  }
  if (target.kind === "watch") {
    return (
      <>
        should get one email when the price of the swap{" "}
        <Link href={`/compare/${target.slug}`} rel="noreferrer">
          {target.title}
        </Link>{" "}
        moves 5% or more, its saving drops under 5%, or we withdraw it.
      </>
    );
  }
  return <>should get one email when we add a swap for &ldquo;{target.query}&rdquo;.</>;
}

function Unusable() {
  return (
    <>
      <p>
        This link has already been used, has expired, or a newer email replaced it. If you asked more than once, use
        the link in the newest email.
      </p>
      <p>
        Already confirmed? Then there&apos;s nothing more to do. Otherwise you can ask again from the{" "}
        <Link href="/">home page</Link> or the swap&apos;s page, and we&apos;ll send a new link.
      </p>
    </>
  );
}
