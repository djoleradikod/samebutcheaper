import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";
import { MatchBadge } from "@/components/Badges";
import { MATCH_TYPE_META } from "@/lib/categories";
import type { MatchType } from "@/lib/types";

export const metadata: Metadata = {
  title: "How we verify every swap",
  description:
    "The four standards a cheaper product has to meet before we call it the same as a brand name, and what we reject.",
  alternates: { canonical: "/how-we-verify" },
};

const DETAIL: Record<MatchType, string> = {
  identical_active:
    "We check the Drug Facts or Supplement Facts panel on both products, using DailyMed, the NIH Dietary Supplement Label Database or the manufacturer's own label. The active ingredient, the amount per dose and the dosage form all have to match. US law requires store-brand OTC medicines to contain the same active ingredient at the same strength as the brand they're compared to.",
  identical_formula:
    "For cosmetics and personal care we compare the full ingredient list (INCI), in order. Ingredients are listed from most to least, so the same list in the same order means the same formula. A single swapped or missing ingredient disqualifies the pair.",
  same_manufacturer:
    "We only accept public, checkable evidence: recall notices that name both brands, regulatory filings, USDA establishment numbers, EPA registration numbers, or a statement from the retailer or manufacturer. Forum rumors and “everyone knows” don't count.",
  equivalent_spec:
    "For things that do a job rather than go in or on your body, like chargers, batteries and detergents, we need matching published specs and certifications (MFi, USB-IF, Qi2, UL, NSF), backed by independent tests from sources such as Consumer Reports, Project Farm or RTINGS.",
};

export default function HowWeVerifyPage() {
  return (
    <ProsePage
      eyebrow="Methodology"
      title="How we verify every swap"
      intro="Trust is the whole point of this site. A swap only goes live when the evidence meets one of four standards, and every swap shows which standard it meets and links to the sources."
    >
      <h2>The four standards</h2>
      {(Object.keys(MATCH_TYPE_META) as MatchType[]).map((t) => (
        <div key={t} className="not-prose my-5 rounded-2xl border border-line bg-surface p-5">
          <MatchBadge type={t} long />
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{DETAIL[t]}</p>
        </div>
      ))}

      <h2>Two confidence levels</h2>
      <ul>
        <li>
          <strong>Label-verified</strong>: we confirmed both products from primary sources, such as the label,
          the manufacturer or a government database.
        </li>
        <li>
          <strong>Strong evidence</strong>: the match is well supported, but at least one detail came from a
          reliable secondary source, such as a major independent test or a reputable report. We say which.
        </li>
      </ul>
      <p>Anything weaker than that doesn&apos;t get published.</p>

      <h2>What we reject</h2>
      <ul>
        <li>Scent-alike or look-alike “dupes” (perfume knock-offs, “inspired by” products)</li>
        <li>Counterfeits and sellers with a record of fake listings</li>
        <li>Prescription-only drugs (with one exception: pet parasite medicines, which we label clearly)</li>
        <li>Anything whose only support is anecdotes or reviews</li>
      </ul>

      <h2>How we calculate savings</h2>
      <p>
        We compare <strong>price per unit</strong> (per tablet, per fluid ounce, per load, per gram of protein) so
        different pack sizes are compared fairly. &ldquo;Saved per pack&rdquo; is what you&apos;d save buying the
        same quantity as one brand-name pack. Prices are typical shelf prices on the date shown on each swap.
        They change often, so always check the retailer.
      </p>
      <p>
        Rankings are based only on the savings and the strength of the evidence. Nobody can pay to be listed or
        to rank higher.
      </p>

      <h2>Honest differences</h2>
      <p>
        &ldquo;Same active ingredient&rdquo; doesn&apos;t always mean identical in every way. Inactive ingredients,
        coatings, flavours, pack sizes and warranties can differ. Every swap has a section where we spell those
        differences out.
      </p>

      <h2>Found a mistake?</h2>
      <p>
        Tell us and we&apos;ll fix it fast. Use the <Link href="/suggest">suggestion form</Link> and include a link
        to your evidence.
      </p>
    </ProsePage>
  );
}
