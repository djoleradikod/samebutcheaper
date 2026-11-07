import type { Metadata } from "next";
import { ProsePage } from "@/components/ProsePage";
import { amazonEarns, linksEarn } from "@/lib/affiliate";

const earns = linksEarn();

export const metadata: Metadata = {
  title: earns ? "Affiliate disclosure" : "Disclosure",
  description: earns
    ? "How SameButCheaper earns money through affiliate links."
    : "SameButCheaper earns nothing from its links today, and no brand or store pays to be listed.",
  alternates: { canonical: "/disclosure" },
};

export default function DisclosurePage() {
  if (!earns) {
    return (
      <ProsePage eyebrow="Transparency" title="Disclosure">
        <p>
          <strong>No link on this site earns us anything today.</strong> None of them carries an affiliate tag, so when
          you click through to a store and buy something, we get nothing from it.
        </p>
        <p>If that changes, this page and the line beside the links on each swap will say so.</p>
        <h2>What decides what we list</h2>
        <ul>
          <li>Every swap has to meet our verification standard.</li>
          <li>Rankings are based only on savings and the strength of the evidence.</li>
          <li>No brand or retailer can pay to be listed, reviewed or ranked.</li>
        </ul>
        <Prices />
      </ProsePage>
    );
  }
  return (
    <ProsePage eyebrow="Transparency" title="Affiliate disclosure">
      {amazonEarns() && (
        <p>
          SameButCheaper is a participant in the Amazon Services LLC Associates Program, an affiliate advertising
          program designed to provide a means for sites to earn advertising fees by advertising and linking to
          Amazon.com. <strong>As an Amazon Associate we earn from qualifying purchases.</strong>
        </p>
      )}
      <p>
        We may also take part in affiliate programs run by other retailers, such as Walmart and Target. When you
        click a &ldquo;Check price&rdquo; or &ldquo;Get it on&rdquo; button and then buy something, we may get a
        commission. The price you pay is the same.
      </p>
      <h2>What this does and doesn&apos;t affect</h2>
      <ul>
        <li>It doesn&apos;t affect which swaps we list. Every swap has to meet our verification standard.</li>
        <li>It doesn&apos;t affect rankings, which are based only on savings and the strength of the evidence.</li>
        <li>
          We link the brand-name product too, and earn the same either way, so we have no reason to push one
          over the other.
        </li>
        <li>No brand or retailer can pay to be listed, reviewed or ranked.</li>
      </ul>
      <Prices />
    </ProsePage>
  );
}

function Prices() {
  return (
    <>
      <h2>Prices</h2>
      <p>
        Prices on this site are typical prices from the month shown on each swap. They are not live, and the
        retailer&apos;s price at checkout is the one that applies.
      </p>
    </>
  );
}
