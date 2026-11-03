import type { Metadata } from "next";
import Link from "next/link";
import { getAllBundles } from "@/lib/catalog";
import { BundleCard } from "@/components/BundleCard";
import { moneyTotals } from "@/lib/format";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import { ProofStrip } from "@/components/ProofStrip";
import type { Bundle, CategorySlug } from "@/lib/types";

export const metadata: Metadata = {
  title: "Bundles: build the same kit for less",
  description:
    "Brand kits, regimens, stacks and gift sets rebuilt from cheaper products with the same ingredients, item by item.",
  alternates: { canonical: "/bundles" },
};

export default function BundlesPage() {
  const bundles = getAllBundles();
  const best = bundles
    .filter((b) => b.savingsPct >= 50 && b.confidence === "high" && b.match_type !== "equivalent_spec")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const byCat = new Map<CategorySlug, Bundle[]>();
  for (const b of bundles) byCat.set(b.category, [...(byCat.get(b.category) ?? []), b]);
  const groups = CATEGORIES.filter((c) => byCat.has(c.slug)).map((c) => [c.slug, byCat.get(c.slug)!] as const);
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
      {bundles.length ? (
        <>
          {best.length > 0 && (
            <section className="container-page pt-10">
              <h2 className="display text-2xl font-medium sm:text-3xl">Highest confirmed savings</h2>
              <p className="mt-1 text-sm text-muted">
                Half price or better, and every item is the same active ingredient, the same formula or the same maker.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {best.map((b) => (
                  <BundleCard key={b.slug} bundle={b} />
                ))}
              </div>
            </section>
          )}
          <nav aria-label="Bundle categories" className="container-page mt-10 flex flex-wrap gap-2">
            {groups.map(([slug, list]) => (
              <a key={slug} href={`#${slug}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                {CATEGORY_MAP[slug].name} <span className="num text-muted">{list.length}</span>
              </a>
            ))}
          </nav>
          {groups.map(([slug, list]) => (
            <section key={slug} id={slug} className="container-page scroll-mt-24 pt-10">
              <h2 className="display text-2xl font-medium">{CATEGORY_MAP[slug].name}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => (
                  <BundleCard key={b.slug} bundle={b} />
                ))}
              </div>
            </section>
          ))}
          <ProofStrip title="Why the cheaper kit is a safe bet" />
        </>
      ) : (
        <section className="container-page py-10">
          <div className="card p-10 text-center">
            <p className="text-lg font-medium">We&apos;re taking the first bundles apart right now.</p>
            <p className="mt-2 text-muted">
              Paying too much for a kit or subscription box?{" "}
              <Link href="/suggest" className="text-accent underline underline-offset-2">Tell us which one</Link>.
            </p>
          </div>
        </section>
      )}
    </>
  );
}
