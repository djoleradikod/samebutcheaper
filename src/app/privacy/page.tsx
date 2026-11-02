import type { Metadata } from "next";
import { ProsePage } from "@/components/ProsePage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What SameButCheaper collects and why.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Privacy" title="Privacy policy" intro="We collect as little as we can.">
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Outbound clicks.</strong> When you click a retailer link, we record which swap it was, which
          retailer, and the page you came from. To count unique visitors without storing your IP address, we keep
          a one-way hash that changes every day.
        </li>
        <li>
          <strong>Email address,</strong> only if you join our list or add it to a suggestion. We use it only to
          send what you asked for, and we never sell or share it.
        </li>
        <li>
          <strong>Suggestions</strong> you send through the suggestion form.
        </li>
        <li>
          <strong>Product checks.</strong> When you search, scan or photograph a product on the product check
          page, we record what was looked up, your country and whether we had a verified swap, with the same
          daily-changing hash. This tells us which products to research next.
        </li>
        <li>
          <strong>Photos.</strong> Barcodes are read on your own device. If a photo has no readable barcode, it
          is sent to our label reader (Anthropic&apos;s Claude) to read the text on the pack, and then discarded.
          We don&apos;t store your photos.
        </li>
      </ul>
      <h2>Cookies</h2>
      <p>
        We set one functional cookie, <code>sbc_country</code>, so we can show stores that deliver to your
        country. It holds only a country code, which you can change at any time. We don&apos;t set advertising
        or tracking cookies. When you visit a retailer such as Amazon through our
        links, that retailer may set its own cookies under its own privacy policy, which is how affiliate
        purchases are credited.
      </p>
      <h2>Your choices</h2>
      <p>
        To unsubscribe or have your email deleted, contact us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </ProsePage>
  );
}
