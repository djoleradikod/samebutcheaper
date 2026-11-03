import type { Metadata } from "next";
import { Suspense } from "react";
import { SuggestForm } from "@/components/SuggestForm";

export const metadata: Metadata = {
  title: "Suggest a swap",
  description: "Know a cheaper product that's the same as a famous brand? Tell us and we'll verify it.",
  alternates: { canonical: "/suggest" },
};

export default function SuggestPage() {
  return (
    <section className="container-page grid gap-10 py-10 md:py-14 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="display text-4xl font-medium sm:text-5xl">Suggest a swap</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Spotted a cheap product that&apos;s the same as a famous brand? Tell us. We check every suggestion
          against our verification standard before it goes live.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-ink-2">
          <li>✓ Same active ingredients at the same strength</li>
          <li>✓ Or the same ingredient list, in the same order</li>
          <li>✓ Or public proof that the same factory makes both</li>
          <li>✓ Or matching certified specs and independent test results</li>
        </ul>
        <p className="mt-6 text-sm text-muted">
          We don&apos;t list scent-alike &ldquo;dupes&rdquo;, knock-offs or prescription drugs.
        </p>
      </div>
      <Suspense fallback={<div className="card h-96" />}>
        <SuggestForm />
      </Suspense>
    </section>
  );
}
