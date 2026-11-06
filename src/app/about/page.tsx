import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";
import { getCategoryStats, getClaims, getMarketCounts, getSiteStats } from "@/lib/catalog";
import { inSentence } from "@/lib/format";
import { MARKETS, type MarketCode } from "@/lib/markets";

export const metadata: Metadata = {
  title: "About",
  description: "What SameButCheaper compares, where its prices come from and how it's funded.",
  alternates: { canonical: "/about" },
};

function inWords(items: string[]) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join("");
}

/** The publishers we cite most, so the page names real testers without a fixed list. */
function topPublishers(limit = 2) {
  const counts = new Map<string, number>();
  for (const c of getClaims()) {
    for (const s of c.sources) counts.set(s.publisher, (counts.get(s.publisher) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name);
}

export default function AboutPage() {
  const stats = getSiteStats();
  const aisles = getCategoryStats().filter((c) => c.count > 0);
  const markets = Object.keys(getMarketCounts()).map((m) => MARKETS[m as MarketCode].short);
  const publishers = topPublishers();
  return (
    <ProsePage
      title="What this site does"
      intro="We compare everyday products with cheaper ones that do the same job, so you can see which to buy and why."
    >
      <p>
        A price comparison site shows who sells one product for the least. We ask a different question: is there a cheaper product that does
        the same job? Then we show the price per unit on both sides, the evidence and what differs.
      </p>
      <p>
        There are {stats.pairs} swaps so far, covering {inWords(aisles.map((a) => inSentence(a.name)))}, with prices from {inWords(markets)}.{" "}
        <Link href="/bundles">Baskets</Link> add swaps up into a whole shop, and brand kits are rebuilt from cheaper items, one piece at a time.
      </p>

      <h2>Why switching can be worth it</h2>
      <p>
        {publishers.length > 0 ? `Testers and researchers such as ${inWords(publishers)} have` : "Independent testers have"} found cheaper
        products matching or beating big names in some tests, and losing in others. We keep both kinds of result on{" "}
        <Link href="/why">the findings page</Link>, with the sources, along with how long things keep if you want to buy in bulk.
      </p>

      <h2>How a swap gets listed</h2>
      <p>
        We read labels, ingredient lists and spec sheets, look for independent tests, and link to at least two sources. Each swap says which
        of our <Link href="/how-we-verify">four standards</Link> it meets. Where the brand is better, the swap says that too.
      </p>
      <p>
        Medicines and supplements are in the catalogue as well, with a health note on those pages. Nothing here is medical advice, so read
        the label and ask a pharmacist or doctor.
      </p>

      <h2>Where prices come from</h2>
      <p>
        Prices are dated. They come from shelf prices people recorded in{" "}
        <a href="https://prices.openfoodfacts.org" target="_blank" rel="noopener">
          Open Prices
        </a>
        , a project of Open Food Facts whose data is available under the{" "}
        <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener license">
          Open Database Licence (ODbL)
        </a>
        , from retailers&apos; own product pages, and from published tests. Prices change, so check at the store before you buy.{" "}
        <Link href="/how-we-verify#prices">More on prices</Link>.
      </p>
      <p>
        Product photos come from open databases such as Open Food Facts, and each is credited on the <Link href="/credits">credits page</Link>.
      </p>

      <h2>How we&apos;re funded</h2>
      <p>
        Some links are affiliate links. If you buy through one, the retailer may pay us a small commission at no extra cost to you. No brand
        or store pays to be listed or ranked. Swaps are ranked by how much you save and how strong the evidence is. See the{" "}
        <Link href="/disclosure">affiliate disclosure</Link>.
      </p>

      <h2>If we get something wrong</h2>
      <p>
        Tell us through the <Link href="/suggest">suggestion form</Link> with a link to your evidence. We&apos;ll check it and fix the swap.
      </p>
    </ProsePage>
  );
}
