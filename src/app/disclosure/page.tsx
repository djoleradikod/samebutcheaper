import type { Metadata } from "next";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "Affiliate disclosure",
  description: "How SameButCheaper earns money through affiliate links.",
  alternates: { canonical: "/disclosure" },
};

export default function DisclosurePage() {
  return (
    <ProsePage eyebrow="Transparency" title="Affiliate disclosure">
      <p>
        SameButCheaper is a participant in the Amazon Services LLC Associates Program, an affiliate advertising
        program designed to provide a means for sites to earn advertising fees by advertising and linking to
        Amazon.com. <strong>As an Amazon Associate we earn from qualifying purchases.</strong>
      </p>
      <p>
        We also take part in affiliate programs run by other stores (such as Walmart, Target, Boots and Shop
        Apotheke) through networks like Impact, Awin, CJ and Rakuten, and through services such as Skimlinks or
        Sovrn that cover many other stores. When you click a &ldquo;Check price&rdquo; or &ldquo;Get it&rdquo;
        button and then buy something, we may get a commission. The price you pay is the same.
      </p>
      <p>
        Links that may earn us money are marked &ldquo;Ad&rdquo; (Anzeige / Werbung). Each outbound click gets a
        random ID so the store&apos;s network can tell us which swap led to a sale. It doesn&apos;t identify you,
        and we never replace another site&apos;s affiliate link or cookie.
      </p>
      <h2>What this does and doesn&apos;t affect</h2>
      <ul>
        <li>It doesn&apos;t affect which swaps we list. Every swap has to meet our verification standard.</li>
        <li>It doesn&apos;t affect rankings, which are based only on savings and the strength of the evidence.</li>
        <li>
          We link the brand-name product too. Commission rates differ between stores, but they never decide which
          product we call the same, or which swap we rank first.
        </li>
        <li>No brand or retailer can pay to be listed, reviewed or ranked.</li>
      </ul>
      <h2>Prices</h2>
      <p>
        Prices on this site are typical prices from the month shown on each swap. They are not live, and the
        retailer&apos;s price at checkout is the one that applies.
      </p>
    </ProsePage>
  );
}
