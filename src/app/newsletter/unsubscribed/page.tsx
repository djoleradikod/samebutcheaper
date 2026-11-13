import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false, follow: false } };

export default function UnsubscribedPage() {
  return (
    <ProsePage title="You're unsubscribed" intro="We won't email this address again.">
      <p>
        Changed your mind? You can join again from the <Link href="/">home page</Link> at any time.
      </p>
    </ProsePage>
  );
}
