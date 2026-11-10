import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = { title: "You're on the list", robots: { index: false, follow: false } };

export default function ConfirmedPage() {
  return (
    <ProsePage title="You're on the list" intro="Your email address is confirmed.">
      <p>
        We&apos;ll email you when we&apos;ve checked new swaps. Every email has an unsubscribe link, and one click
        takes you off the list.
      </p>
      <p>
        <Link href="/biggest-savings">See the biggest savings</Link> or <Link href="/check">check a product you buy</Link>.
      </p>
    </ProsePage>
  );
}
