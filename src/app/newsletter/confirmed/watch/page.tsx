import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = { title: "You're watching this swap", robots: { index: false, follow: false } };

export default function WatchConfirmedPage() {
  return (
    <ProsePage title="You're watching this swap" intro="Your email address is confirmed for this price watch.">
      <p>
        We&apos;ll email you once if the cheaper product&apos;s price moves 5% or more, the saving drops under 5%, or we
        withdraw the swap. Prices change on our site when we re-check them, so it can be weeks between emails, or
        none at all.
      </p>
      <p>This doesn&apos;t sign you up for anything else. Every email has a link that stops the watch in one click.</p>
      <p>
        <Link href="/biggest-savings">See the biggest savings</Link>
      </p>
    </ProsePage>
  );
}
