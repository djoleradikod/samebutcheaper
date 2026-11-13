import type { Metadata } from "next";
import { BiggestSavingsSchema } from "@/components/HubSchemas";
import { getAllPairs, getSiteStats } from "@/lib/catalog";
import { MEDICINE } from "@/lib/browse";
import { PairBrowser } from "@/components/PairBrowser";
import { BestTicket, bestSaving, browseProps, PriceFacts, ShelfHead, swapCount } from "@/components/ShelfParts";
import { forCountry, type Local } from "@/lib/localize";
import { CountryPart } from "@/components/ForCountry";
import { countryHead } from "@/lib/seo-catalog";
import { getT } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Biggest savings: every swap, ranked",
  description:
    "Every cheaper alternative to a brand-name product in our catalogue, ranked by how much you save per unit.",
  ...countryHead("/biggest-savings", null),
};

/** The list leaves medicine out until it's added, so the headline figures do too. */
function everydayPairs(local: Local) {
  return forCountry(getAllPairs(), local).filter((p) => p.category !== MEDICINE);
}

export default function BiggestSavingsPage() {
  const stats = getSiteStats();
  const lang = getLang();
  const t = getT(lang);
  return (
    <div className="bg-canvas pb-8 md:pb-10">
      <ShelfHead
        lang={lang}
        crumbs={[{ href: "/", label: t("lists.home") }, { label: t("lists.biggest.title") }]}
        title={
          <>
            {t("lists.biggest.title")}
            <CountryPart fallback={null}>{(local) => `: ${swapCount(forCountry(getAllPairs(), local).length, lang)}`}</CountryPart>
          </>
        }
        intro={t("lists.biggest.intro", stats.sources)}
        ticket={<CountryPart fallback={null}>{(local) => <BestTicket best={bestSaving(everydayPairs(local))} lang={lang} />}</CountryPart>}
        facts={<CountryPart fallback={null}>{(local) => <PriceFacts pairs={everydayPairs(local)} lang={lang} />}</CountryPart>}
      />
      <div className="container-page">
        <CountryPart>
          {(local) => <PairBrowser path="/biggest-savings" {...browseProps(forCountry(getAllPairs(), local), { hideMedicine: true, local })} showRank />}
        </CountryPart>
      </div>
      <BiggestSavingsSchema />
    </div>
  );
}
