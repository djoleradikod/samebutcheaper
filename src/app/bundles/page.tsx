import type { Metadata } from "next";
import Link from "next/link";
import { getAllBundles } from "@/lib/catalog";
import { BundleCard } from "@/components/BundleCard";
import { moneyTotals } from "@/lib/format";

export const metadata: Metadata = {
  title: "Bundles: build the same kit for less",
  description:
    "Brand kits, regimens, stacks and gift sets rebuilt from cheaper products with the same ingredients, item by item.",
  alternates: { canonical: "/bundles" },
};

export default function BundlesPage() {
  const bundles = getAllBundles();
  const total = moneyTotals(bundles.map((b) => ({ amount: b.savings, currency: b.currency })));
  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="container-page py-10 md:py-14">
          <p className="text-sm font-medium text-accent">Bundles</p>
          <h1 className="display mt-1 text-4xl font-medium sm:text-5xl">Same kit. Built for less.</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
            Brands love selling regimens, stacks, kits and gift sets at a premium. We take them apart item by
            item and rebuild each one from cheaper products with the same active ingredients at the same
            strength.
          </p>
          {bundles.length > 0 && (
            <p className="num mt-4 text-sm text-muted">
              {bundles.length} bundles · {total} saved if you rebuilt one of each
            </p>
          )}
        </div>
      </section>
      <section className="container-page py-10">
        {bundles.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((b) => (
              <BundleCard key={b.slug} bundle={b} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <p className="text-lg font-medium">We&apos;re taking the first bundles apart right now.</p>
            <p className="mt-2 text-muted">
              Paying too much for a kit or subscription box?{" "}
              <Link href="/suggest" className="text-accent underline underline-offset-2">Tell us which one</Link>.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
