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
      </ul>
      <h2>Cookies</h2>
      <p>
        We don&apos;t set advertising or tracking cookies. When you visit a retailer such as Amazon through our
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
