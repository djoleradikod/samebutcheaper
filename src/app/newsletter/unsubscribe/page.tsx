import type { Metadata } from "next";
import { Suspense } from "react";
import { ProsePage } from "@/components/ProsePage";
import { UnsubscribeForm } from "@/components/UnsubscribeForm";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function UnsubscribePage() {
  return (
    <ProsePage title="Unsubscribe" intro="Stop emails from SameButCheaper to this address.">
      <Suspense fallback={<p>Loading…</p>}>
        <UnsubscribeForm />
      </Suspense>
    </ProsePage>
  );
}
