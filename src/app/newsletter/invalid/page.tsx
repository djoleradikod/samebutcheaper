import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "That link didn't work", robots: { index: false, follow: false } };

export default function InvalidLinkPage() {
  return (
    <ProsePage title="That link didn't work" intro="It may have been used already, expired, or part of it was cut off.">
      <p>
        A confirmation link works once, for 30 days, and a newer email replaces it. If you&apos;ve already confirmed,
        there&apos;s nothing more to do. Otherwise you can ask again from the <Link href="/">home page</Link> or the
        swap&apos;s page, and we&apos;ll send a new link.
      </p>
      <p>
        Trying to unsubscribe? Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> from the address
        you signed up with and we&apos;ll remove it.
      </p>
    </ProsePage>
  );
}
