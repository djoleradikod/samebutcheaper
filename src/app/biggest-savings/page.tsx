import type { Metadata } from "next";
import { getAllPairs, getSiteStats } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { bestSaving, browseProps, PriceFacts, ShelfHead, swapCount } from "@/components/ShelfParts";
import { forCountry } from "@/lib/localize";
import { getCountry } from "@/lib/server-country";

export const metadata: Metadata = {
  title: "Biggest savings: every swap, ranked",
  description:
    "Every cheaper alternative to a brand-name product in our catalogue, ranked by how much you save per unit.",
  alternates: { canonical: "/biggest-savings" },
};

export default async function BiggestSavingsPage() {
  const country = await getCountry();
  const pairs = forCountry(getAllPairs(), country);
  const stats = getSiteStats();
  // The list leaves medicine out until it's added, so the headline figures do too.
  const everyday = pairs.filter((p) => p.category !== MEDICINE);
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Biggest savings" }]}
        title={`Biggest savings: ${swapCount(pairs.length)}`}
        intro={`Every swap we've checked, with the biggest saving per unit first. ${stats.sources} sources back them up.`}
        best={bestSaving(everyday)}
        facts={<PriceFacts pairs={everyday} />}
      />
      <div className="container-page">
        <PairBrowser path="/biggest-savings" {...browseProps(pairs, { hideMedicine: true, country })} showRank />
      </div>
    </div>
  );
}
