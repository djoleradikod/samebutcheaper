import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = { title: "Request confirmed", robots: { index: false, follow: false } };

export default function WishConfirmedPage() {
  return (
    <ProsePage title="Request confirmed" intro="Your email address is confirmed for this request.">
      <p>
        We count every request like yours, and the products most people ask for are the ones we research first. We
        only add a swap once at least two sources back it up, so we can&apos;t promise when, or that we will.
      </p>
      <p>This doesn&apos;t sign you up for anything else.</p>
      <p>
        <Link href="/suggest">Know a cheaper product that does the same job? Tell us</Link>
      </p>
    </ProsePage>
  );
}
