import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ProsePage } from "@/components/ProsePage";
import { retention } from "@/lib/maintenance";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What SameButCheaper collects and why.",
  alternates: { canonical: "/privacy" },
};

/** "180 days", "a year", "2 years". */
function period(days: number) {
  if (days % 365 === 0) return days === 365 ? "a year" : `${days / 365} years`;
  return `${days} days`;
}

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Privacy" title="Privacy policy" intro="We collect as little as we can.">
      {/* The periods are the ones this server runs with (src/lib/maintenance.ts), read when the page is asked for. */}
      <Suspense fallback={<p>Loading…</p>}>
        <Policy />
      </Suspense>
    </ProsePage>
  );
}

async function Policy() {
  await connection();
  const keep = retention(process.env);
  return (
    <>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Outbound clicks.</strong> When you click a retailer link, we record which swap it was, which
          retailer, your selected country, the page you came from and the site that first sent you to us. To count
          unique visitors without storing your IP address, we keep a one-way hash that changes every day. After
          {" "}{period(keep.clickDetail)} we delete the hash and the page you came from.
        </li>
        <li>
          <strong>Sales.</strong> When a retailer&apos;s affiliate network tells us a click led to a purchase, we
          record the order reference, the order total and our commission. We are not told who you are or what you
          bought, and we don&apos;t keep anything personal a network sends along.
        </li>
        <li>
          <strong>Email address,</strong> only if you give it to us: to get our weekly letter, to watch a swap&apos;s
          price, to be told when we add a swap for something you searched for, or with a suggestion. Each of these is
          confirmed on its own: we send one email asking you to confirm that one thing, and send nothing about it
          until you do. Confirming one never signs you up for another. Opening the link only shows what you&apos;re
          confirming: nothing changes until you press the button on that page, so a mail scanner that opens links
          can&apos;t sign you up. If you don&apos;t confirm, the request is deleted after {keep.unconfirmed} days, and an
          address with nothing confirmed goes with it. Once nothing is switched on for your address any more (no
          letter, no watch, no request waiting), we delete it {keep.unconfirmed} days later. We record when you confirmed as
          proof that you asked. We store the country you had selected, so we can show prices in your currency. We use
          your address only to send what you asked for, and we never sell or share it.
        </li>
        <li>
          <strong>Price watches.</strong> When you watch a swap, we store which swap and its prices at that moment,
          so we can tell you when they change. A watch you stop, or one that ends because we withdrew the swap, is
          deleted after {keep.unconfirmed} days.
        </li>
        <li>
          <strong>&ldquo;Tell me when you add it&rdquo;.</strong> We store the search and your country with your
          address. When we add a swap whose brand or product name matches it, we email you once and the request
          ends. We delete it {keep.unconfirmed} days after it ends or you stop it, or after {period(keep.wishes)} if it is
          still waiting.
        </li>
        <li>
          <strong>The emails we send.</strong> We keep a log of each email we send you (what it was and when, and
          for the weekly letter which swaps it carried), so nobody gets the same one twice. The log is deleted after
          {" "}{period(keep.sends)}. Our emails have no tracking pixels and we don&apos;t record whether you open them. Links to our
          own pages carry <code>utm_source=newsletter</code>, which tells us a visit came from an email, not who you
          are.
        </li>
        <li>
          <strong>Suggestions</strong> you send through the suggestion form.
        </li>
        <li>
          <strong>&ldquo;Something wrong?&rdquo; reports.</strong> When you tell us a price, stock level or product
          on a page is wrong, we store what you picked, your note (we take out anything that looks like an email
          address or phone number), your selected country and the same daily-changing hash as for clicks, so one
          person can&apos;t count as several. We drop the hash after {keep.reportHash} days and delete the report
          after {period(keep.reports)}. When three or more people report a changed price or stock on the same page
          within two weeks, the page says shoppers have reported it until we&apos;ve checked.
        </li>
        <li>
          <strong>What people looked for and we didn&apos;t have.</strong> When a search on our site finds nothing,
          or the product check reads a product we have no swap for, we count the words searched for (in lower case,
          shortened, and never anything that looks like an email address, web address or phone number) with the
          country and the day. Nothing about who searched is kept with the count. We delete these counts after
          {" "}{period(keep.wanted)}.
        </li>
        <li>
          <strong>Product checks.</strong> When you search, scan or photograph a product on the product check
          page, we record what was looked up, your country and whether we had a swap on file, with the same
          daily-changing hash. This tells us which products to research next. We delete these records after
          {" "}{period(keep.lookups)}.
        </li>
        <li>
          <strong>Photos.</strong> Barcodes are read on your own device. If a photo has no readable barcode, it
          is sent to our label reader (Anthropic&apos;s Claude) to read the text on the pack, and then discarded.
          We don&apos;t store your photos.
        </li>
        <li>
          <strong>Shopping lists and receipts.</strong> When you paste a shopping list or upload a receipt on the
          product check page, we read it to find matches and then discard it. We keep only the cleaned names of
          products we couldn&apos;t match, with no prices and nothing that identifies you.
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
        Every email we send has unsubscribe links that work in one click: one stops just that letter or watch, the
        other stops everything we send to your address. To have your email address or a
        suggestion deleted, or to ask what we hold about you, contact us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
      <p>
        Who runs this site: see the <Link href="/impressum">Impressum (legal notice)</Link>.
      </p>
    </>
  );
}
