import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/ProsePage";

export const metadata: Metadata = {
  title: "About",
  description: "Why SameButCheaper exists, and how it's funded.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <ProsePage
      eyebrow="About"
      title="Pay for the product, not the commercial"
      intro="Many of the most expensive things in your cart have the same active ingredients or formula as cheaper products on the same shelf. Most of the price difference is marketing. We built SameButCheaper to make that easy to see."
    >
      <p>
        Brand-name ibuprofen and store-brand ibuprofen contain the same drug at the same dose. A famous
        moisturiser and a store-brand copy often share an ingredient list word for word. Some store brands are
        made in the same factory as the brand they sit beside. Most people never find out, because the cheaper
        product doesn&apos;t have a TV budget.
      </p>
      <p>
        We read the labels, check the regulatory records and cite independent tests, then put the evidence on
        one page. If enough people switch, brands have to compete on price and quality instead of advertising.
        That shift is what we&apos;re here for.
      </p>
      <h2>How we&apos;re funded</h2>
      <p>
        Some links on the site are affiliate links. If you buy through them, the retailer pays us a small
        commission at no cost to you. We earn the same whether you pick the cheaper option or the brand. See
        our <Link href="/disclosure">affiliate disclosure</Link> for details.
      </p>
      <h2>Our promise</h2>
      <ul>
        <li>Every swap meets a published <Link href="/how-we-verify">verification standard</Link>.</li>
        <li>We list the honest differences, not just the similarities.</li>
        <li>Rankings can&apos;t be bought.</li>
        <li>When we get something wrong, we fix it and say so.</li>
      </ul>
    </ProsePage>
  );
}
