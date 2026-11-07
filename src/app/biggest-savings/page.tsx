import type { Metadata } from "next";
import { getAllPairs, getSiteStats } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { BestTicket, bestSaving, browseProps, PriceFacts, ShelfHead, swapCount } from "@/components/ShelfParts";
import { forCountry, type Local } from "@/lib/localize";
import { CountryPart } from "@/components/ForCountry";

export const metadata: Metadata = {
  title: "Biggest savings: every swap, ranked",
  description:
    "Every cheaper alternative to a brand-name product in our catalogue, ranked by how much you save per unit.",
  alternates: { canonical: "/biggest-savings" },
};

/** The list leaves medicine out until it's added, so the headline figures do too. */
function everydayPairs(local: Local) {
  return forCountry(getAllPairs(), local).filter((p) => p.category !== MEDICINE);
}

export default function BiggestSavingsPage() {
  const stats = getSiteStats();
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        crumbs={[{ href: "/", label: "Home" }, { label: "Biggest savings" }]}
        title={
          <>
            Biggest savings<CountryPart fallback={null}>{(local) => `: ${swapCount(forCountry(getAllPairs(), local).length)}`}</CountryPart>
          </>
        }
        intro={`Every swap we've checked, with the biggest saving per unit first. ${stats.sources} sources back them up.`}
        ticket={<CountryPart fallback={null}>{(local) => <BestTicket best={bestSaving(everydayPairs(local))} />}</CountryPart>}
        facts={<CountryPart fallback={null}>{(local) => <PriceFacts pairs={everydayPairs(local)} />}</CountryPart>}
      />
      <div className="container-page">
        <CountryPart>
          {(local) => <PairBrowser path="/biggest-savings" {...browseProps(forCountry(getAllPairs(), local), { hideMedicine: true, local })} showRank />}
        </CountryPart>
      </div>
    </div>
  );
}
