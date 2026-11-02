import type { Metadata } from "next";
import { getAllPairs, getSiteStats, toSummary } from "@/lib/catalog";
import { PairBrowser } from "@/components/PairBrowser";

export const metadata: Metadata = {
  title: "Biggest savings: every verified swap, ranked",
  description:
    "Every verified cheaper alternative to a brand-name product, ranked by how much you save per unit and per pack.",
  alternates: { canonical: "/biggest-savings" },
};

export default function BiggestSavingsPage() {
  const pairs = getAllPairs().map(toSummary);
  const stats = getSiteStats();
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="container-page py-10 md:py-14">
          <p className="text-sm font-medium text-accent">Leaderboard</p>
          <h1 className="display mt-1 text-4xl font-medium sm:text-5xl">The biggest savings, ranked</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">
            Every swap we&apos;ve verified, ranked by how much cheaper it is per unit and how many dollars it
            saves on each pack. Swaps backed by the strongest evidence rank a little higher.
          </p>
          <p className="num mt-4 text-sm text-muted">
            {stats.pairs} swaps · {Math.round(stats.avgSavings)}% average saving · {stats.sources} sources cited
          </p>
        </div>
      </section>
      <section className="container-page py-10">
        <PairBrowser pairs={pairs} showRank />
      </section>
    </>
  );
}
