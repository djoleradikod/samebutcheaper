import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "That link didn't work", robots: { index: false, follow: false } };

export default function InvalidLinkPage() {
  return (
    <ProsePage title="That link didn't work" intro="It may have expired, or part of it was cut off.">
      <p>
        Confirmation links stop working after 30 days. You can sign up again from the <Link href="/">home page</Link>,
        and we&apos;ll send a new one.
      </p>
      <p>
        Trying to unsubscribe? Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> from the address
        you signed up with and we&apos;ll remove it.
      </p>
    </ProsePage>
  );
}
