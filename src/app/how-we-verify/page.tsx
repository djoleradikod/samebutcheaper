import type { Metadata } from "next";
import Link from "next/link";
import { linksEarn } from "@/lib/affiliate";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { ProsePage } from "@/components/ProsePage";
import { getAllPairs, getSiteStats } from "@/lib/catalog";
import { oneOfEachSwap } from "@/lib/localize";
import type { MatchType } from "@/lib/types";

export const metadata: Metadata = {
  title: "How we check every swap",
  description:
    "The standards behind each swap we list, where our prices come from, how savings are worked out, and what we leave out.",
  alternates: { canonical: "/how-we-verify" },
};

/** In the order a shopper meets them, with medicine's standard last. */
const STANDARDS: { type: MatchType; detail: string }[] = [
  {
    type: "equivalent_spec",
    detail:
      "For things that do a job, such as batteries, chargers, cables, foil, detergent and many foods. We compare published specs, grades, certifications and ingredient lists, and look for independent tests.",
  },
  {
    type: "identical_formula",
    detail:
      "For food, cosmetics and personal care. We compare the full ingredient list on both labels. Lists run from most to least, so the same list in the same order points to the same recipe. A swapped or missing ingredient rules the pair out.",
  },
  {
    type: "same_manufacturer",
    detail:
      "We only accept public evidence you can check: recall notices that name both brands, regulatory filings, plant or registration numbers, or a statement from the retailer or maker. Forum rumours and “everyone knows” don't count.",
  },
  {
    type: "identical_active",
    detail:
      "For skincare, hair care, pet treatments, supplements and over-the-counter medicines. We read the facts panel or label on both products, from the maker or a public label database. The active ingredient, the amount per dose and the form all have to match.",
  },
  {
    type: "same_kind",
    detail:
      "The weakest label, and we say so. Both are the same kind of product with prices from real sources, but what we have doesn't show that they match on what's inside or how well they work, so it's a cheaper option to try and not a proven match. Any swap with nothing compared on both sides gets this label automatically.",
  },
];

export default function HowWeVerifyPage() {
  const stats = getSiteStats();
  const pairs = oneOfEachSwap(getAllPairs());
  const count = (type: MatchType) => pairs.filter((p) => p.match_type === type).length;
  return (
    <ProsePage
      title="How we check every swap"
      intro={`Each swap carries a label saying how far its evidence goes, lists what differs and links to at least two sources. There are ${stats.pairs} swaps in ${stats.categories} aisles today.`}
    >
      <h2>What each label means</h2>
      {STANDARDS.map(({ type, detail }) => (
        <div key={type} className="card my-3 px-4 py-3">
          <p className="my-0 flex flex-wrap items-baseline justify-between gap-x-3">
            <MatchBadge type={type} long />
            <span className="num text-[13px] text-muted">
              {count(type)} swap{count(type) === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-1.5 mb-0 text-sm">{detail}</p>
        </div>
      ))}

      <h2>How sure we are</h2>
      <ul>
        <li>
          <ConfidenceBadge confidence="high" />: we confirmed both products from primary sources, such as the label, the maker or a public
          database.
        </li>
        <li>
          <ConfidenceBadge confidence="medium" />: the match is well supported, but at least one detail came from a reliable secondary
          source, such as a major independent test. The swap says which.
        </li>
      </ul>
      <p>Anything weaker than that doesn&apos;t get listed.</p>

      <h2 id="prices" className="scroll-mt-24">
        Where prices come from
      </h2>
      <p>Every price has a date on it, shown on the swap. They come from three places:</p>
      <ul>
        <li>
          <strong>Shelf prices from Open Prices.</strong> People record what they saw in a shop, with the date and the store.{" "}
          <a href="https://prices.openfoodfacts.org" target="_blank" rel="noopener">
            Open Prices
          </a>{" "}
          is a project of Open Food Facts, and its data is available under the{" "}
          <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener license">
            Open Database Licence (ODbL)
          </a>
          . Credit to its contributors.
        </li>
        <li>
          <strong>Retailer pages.</strong> The price and pack size on the store&apos;s own product page, on the date we looked.
        </li>
        <li>
          <strong>Published tests.</strong> The price a tester reports paying, with the date of the test.
        </li>
      </ul>
      <p>Prices change often, so check the price at the store before you buy.</p>

      <h2>How we work out savings</h2>
      <p>
        We compare the <strong>price per unit</strong>, such as per 100 g, per wash, per sheet or per tablet, so a big pack and a small pack
        can be judged fairly. &ldquo;Saved per pack&rdquo; is what you&apos;d save buying the same amount as one brand-name pack.
      </p>
      <p>
        A <Link href="/bundles">basket</Link> adds up its swaps the same way. Both totals buy the same amount, using each swap&apos;s dated
        unit prices. The cheaper pack may be a different size, so what you pay at the till can differ.
      </p>
      <p>
        For buying in bulk, we show how much of the cheaper pack you need to use before it pays off, and{" "}
        <Link href="/why#keeps">how long the product keeps</Link>, with sources.
      </p>

      <h2>Where the brand wins</h2>
      <p>
        The same active ingredient or spec doesn&apos;t make two products the same in every way. Inactive ingredients, taste, coatings, pack
        sizes and warranties can differ, and sometimes the brand is better. Every swap spells this out, and{" "}
        <Link href="/why#lost">where the cheap option lost</Link> collects the tests that went the other way.
      </p>

      <h2>What we leave out</h2>
      <ul>
        <li>Scent-alike or look-alike &ldquo;dupes&rdquo;, such as perfume knock-offs</li>
        <li>Counterfeits, and sellers with a record of fake listings</li>
        <li>Prescription-only drugs, apart from pet parasite treatments, which we label clearly</li>
        <li>Anything supported only by anecdotes or reviews</li>
      </ul>

      <h2>Rankings and photos</h2>
      <p>
        Swaps are ranked by how much you save and how strong the evidence is. No brand or store pays to be listed or ranked.{" "}
        {linksEarn() ? (
          <>
            Some links are <Link href="/disclosure">affiliate links</Link>.
          </>
        ) : (
          <>
            No link earns us anything today, as our <Link href="/disclosure">disclosure</Link> says.
          </>
        )}
      </p>
      <p>
        Product photos come from open databases such as Open Food Facts, and each is listed with its licence on the{" "}
        <Link href="/credits">credits page</Link>. Where we have no photo we can use, we print the name on a plain tile and say so. Many photos have the background removed or the pack straightened, and the credit says which.
      </p>

      <h2>Found a mistake?</h2>
      <p>
        Use the <Link href="/suggest">suggestion form</Link> and include a link to your evidence. We&apos;ll check it and fix the swap.
      </p>
    </ProsePage>
  );
}
