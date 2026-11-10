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
          retailer, your selected country, the page you came from and the site that first sent you to us. To count
          unique visitors without storing your IP address, we keep a one-way hash that changes every day. After
          180 days we delete the hash and the page you came from.
        </li>
        <li>
          <strong>Sales.</strong> When a retailer&apos;s affiliate network tells us a click led to a purchase, we
          record the order reference, the order total and our commission. We are not told who you are or what you
          bought, and we don&apos;t keep anything personal a network sends along.
        </li>
        <li>
          <strong>Email address,</strong> only if you join our list or add it to a suggestion. When you join the
          list we send one email asking you to confirm, and nothing else until you do. If you don&apos;t confirm, the
          address is deleted after 30 days. We record when you confirmed as proof that you asked to be on the list.
          We use your address only to send what you asked for, and we never sell or share it.
        </li>
        <li>
          <strong>Suggestions</strong> you send through the suggestion form.
        </li>
        <li>
          <strong>Product checks.</strong> When you search, scan or photograph a product on the product check
          page, we record what was looked up, your country and whether we had a swap on file, with the same
          daily-changing hash. This tells us which products to research next. We delete these records after a year.
        </li>
        <li>
          <strong>Photos.</strong> Barcodes are read on your own device. If a photo has no readable barcode, it
          is sent to our label reader (Anthropic&apos;s Claude) to read the text on the pack, and then discarded.
          We don&apos;t store your photos.
        </li>
      </ul>
      <h2>Cookies</h2>
      <p>
        We set two small cookies of our own. <code>sbc_country</code> holds a country code, so we can show stores
        that deliver to your country; you can change it at any time. <code>sbc_src</code> holds the name of the site
        or campaign that first brought you here (for example &quot;google&quot;), for 30 days, so we can tell which
        sources bring shoppers who find a swap useful. Neither identifies you, and we don&apos;t set advertising
        cookies. When you visit a retailer such as Amazon through our links, that retailer may set its own cookies
        under its own privacy policy, which is how affiliate purchases are credited.
      </p>
      <h2>Who handles your data for us</h2>
      <p>
        Our server and database are hosted by Hetzner. Emails are sent through Resend. Photos you
        choose to have read go to Anthropic, as described above.
      </p>
      <h2>Your choices</h2>
      <p>
        Every email we send has an unsubscribe link that works in one click. To have your email address or a
        suggestion deleted, or to ask what we hold about you, contact us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </ProsePage>
  );
}
