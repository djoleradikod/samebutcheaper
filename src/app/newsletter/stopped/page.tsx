import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = { title: "Stopped", robots: { index: false, follow: false } };

export default function StoppedPage() {
  return (
    <ProsePage title="Stopped" intro="We won't email you about that again.">
      <p>
        Anything else you asked us for carries on. To stop everything, use the &ldquo;Unsubscribe from
        everything&rdquo; link at the foot of any of our emails.
      </p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </ProsePage>
  );
}
