import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { CountryPart } from "@/components/ForCountry";
import { ShoppingCheck, type SharedStart } from "@/components/ShoppingCheck";
import { getPair } from "@/lib/catalog";
import type { Local } from "@/lib/localize";
import { parseShare } from "@/lib/receipt/total";
import { listedFor, swapViews } from "@/lib/receipt/view";

export const metadata: Metadata = {
  title: "Check your shopping: what switching would keep a year",
  description:
    "Paste a shopping list or a receipt. See which of the brands you buy have a cheaper product that does the same job, and what switching keeps in a year.",
  alternates: { canonical: "/check/list" },
};

export default function CheckListPage({ searchParams }: PageProps<"/check/list">) {
  return (
    <>
      <section className="hero-wash border-b border-line print:border-0">
        <div className="container-page py-8 md:py-12">
          <p className="text-sm font-medium text-accent print:hidden">
            <Link href="/check" className="underline-offset-2 hover:underline">
              Product check
            </Link>{" "}
            / Your shopping
          </p>
          <h1 className="display mt-1 max-w-3xl text-[2rem] font-medium sm:text-5xl">Paste your shopping list. See what you&apos;d keep a year.</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2 md:text-lg print:hidden">
            Paste a list or the text of a receipt. We match each brand to a cheaper product that does the same job, from stores that
            sell where you live, and add up what switching keeps. When we can&apos;t tell which product a line means, we ask.
          </p>
        </div>
      </section>
      <div className="container-page py-6 md:py-10">
        <CountryPart fallback={<div className="card h-72 max-w-3xl" />}>{(local) => <Checker local={local} searchParams={searchParams} />}</CountryPart>
      </div>
    </>
  );
}

async function Checker({ local, searchParams }: { local: Local; searchParams: PageProps<"/check/list">["searchParams"] }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.s) ? sp.s[0] : sp.s;
  // A shared result: catalogue slugs and how often, nothing from anyone's receipt. Only what this shopper's country lists shows.
  const items = parseShare(raw, (slug) => Boolean(getPair(slug)));
  const listed = items.filter((i) => listedFor(i.slug, local));
  const shared: SharedStart | null = items.length
    ? { swaps: swapViews(listed.map((i) => i.slug)), items: listed, hidden: items.length - listed.length }
    : null;
  return <ShoppingCheck photo={Boolean(process.env.ANTHROPIC_API_KEY)} shared={shared} />;
}
