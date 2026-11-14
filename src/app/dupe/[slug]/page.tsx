import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { notFound } from "next/navigation";
import {
  brandSlugFor,
  getDupe,
  getDupes,
  getRelatedDupes,
  ingredientSlugFor,
  toSummary,
  type DupeEntry,
} from "@/lib/catalog";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { comparison, matchParts } from "@/lib/compare";
import { monthYear } from "@/lib/format";
import { jsonLdText, SITE } from "@/lib/site";
import { dupeDescription, dupeTitle } from "@/lib/seo";
import { unitDisplay, unitPrice } from "@/lib/unit-format";
import type { Pair } from "@/lib/types";
import { ConfidenceBadge } from "@/components/Badges";
import { HEALTH_CATEGORIES, HealthNotice } from "@/components/Evidence";
import { PairCard } from "@/components/PairCard";
import { atLeastOneParam, ListLinks, ShelfHead, SwapGrid, TagLinks, NotListedHere } from "@/components/ShelfParts";
import { forCountry, localText, oneOfEachSwap, type Local } from "@/lib/localize";
import { CountryPart } from "@/components/ForCountry";

export function generateStaticParams() {
  return atLeastOneParam(getDupes().map((d) => d.slug));
}

/** "Generic" is only true of medicines. Everything else is a cheaper alternative. */
function heading(d: DupeEntry) {
  const what = d.actives ? d.actives.join(", ") : d.subcategory.toLowerCase();
  const isMedicine = d.pairs[0].category === "otc-medicine" && d.actives;
  return {
    what,
    title: isMedicine ? `Generic for ${d.brand}` : d.actives ? `Cheaper alternative to ${d.brand}` : `Cheaper alternatives to ${d.brand}`,
    noun: isMedicine ? "generic" : "cheaper alternative",
  };
}

/** "37¢ against £1.20 for Nurofen, per tablet" in pieces, at the unit the shelf ticket reads in. */
function unitPrices(p: Pair, local?: Local) {
  return {
    cheaper: local ? local.unit(p.alternative.ppu, p.brand.unit, p.currency) : unitPrice(p.alternative.ppu, p.brand.unit, p.currency),
    dearer: local ? local.unit(p.brand.ppu, p.brand.unit, p.currency) : unitPrice(p.brand.ppu, p.brand.unit, p.currency),
    per: unitDisplay(p.brand.unit).label,
  };
}

export async function generateMetadata({ params }: PageProps<"/dupe/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = getDupe(slug);
  if (!d) return { title: "Page not found", robots: { index: false } };
  const subject = { ...d, category: d.pairs[0].category };
  return {
    title: dupeTitle(subject, d.pairs[0].savingsPct),
    description: dupeDescription(subject, d.pairs),
    alternates: { canonical: `/dupe/${d.slug}` },
  };
}

const isChecked = (p: Pair) => p.match_type !== "same_kind";

/** Only a swap whose label says more than "same kind" counts as a checked match. */
function matchCountAnswer(pairs: Pair[]) {
  const checked = pairs.filter(isChecked).length;
  const kinds = pairs.length - checked;
  const kindsText = `${kinds} cheaper product${kinds === 1 ? "" : "s"} of the same kind, with nothing on file to show ${kinds === 1 ? "it matches" : "they match"} beyond that`;
  if (checked === 0) return `We have ${kindsText}.`;
  const checkedText = `Yes. We've checked ${checked} cheaper match${checked === 1 ? "" : "es"}`;
  return kinds === 0 ? `${checkedText}.` : `${checkedText}, and we have ${kindsText}.`;
}

function listHeading(pairs: Pair[]) {
  const n = pairs.length;
  if (!pairs.some(isChecked)) return n === 1 ? "The cheaper product we priced" : `The ${n} cheaper products we priced`;
  return n === 1 ? "The match we checked" : `The ${n} swaps we checked`;
}

/** What the comparison found, in the semantic colours of the same-or-different table. */
function MatchCounts({ pair }: { pair: Pair }) {
  const m = matchParts(comparison(pair));
  const spec = pair.match_type === "equivalent_spec" || pair.match_type === "same_kind";
  const cells = [
    { n: m.same, label: "the same", tone: "bg-same-soft text-same" },
    { n: m.differ, label: "differ or to check", tone: "bg-different-soft text-different" },
    { n: m.brandBetter, label: "brand wins", tone: "bg-brand-better-soft text-brand-better" },
  ];
  return (
    <>
      <p className="text-sm text-ink-2">
        {m.labelMatches === true && (spec ? "Key specs match. " : "Actives match. ")}
        {m.labelMatches === false && (spec ? "Some specs differ. " : "Some actives differ. ")}
        Points we compared:
      </p>
      <ul className="mt-1.5 grid max-w-xl grid-cols-3 gap-1.5">
        {cells.map((c) => (
          <li key={c.label} className={`rounded-tile px-2 py-1.5 ${c.tone}`}>
            <span className="price block text-[1.375rem]">{c.n}</span>
            <span className="block text-xs leading-tight font-medium">{c.label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default async function DupePage({ params }: PageProps<"/dupe/[slug]">) {
  const { slug } = await params;
  const d = getDupe(slug);
  if (!d) notFound();
  return <CountryPart>{(local) => <DupeBody d={d} local={local} />}</CountryPart>;
}

function DupeBody({ d, local }: { d: DupeEntry; local: Local }) {
  const h = heading(d);
  // A brand with nothing that lists here still opens from a direct link, in the shopper's currency, and says so.
  const near = forCountry(d.pairs, local);
  const shown = (near.length ? near : oneOfEachSwap(d.pairs)).map((p) => localText(p, local));
  const top = shown[0];
  const others = shown.slice(1);
  const cat = CATEGORY_MAP[top.category];
  const related = getRelatedDupes(d).filter((r) => forCountry(r.pairs, local).length > 0);
  const { cheaper, dearer, per } = unitPrices(top, local);

  const faq = [
    {
      q: `Is there a ${h.noun} for ${d.brand}?`,
      a: `${matchCountAnswer(shown)} The biggest saving is ${top.alternative.brand}, ${Math.round(top.savingsPct)}% less ${per} at the prices we checked in ${monthYear(top.price_checked)}.`,
    },
    {
      q: `Is ${top.alternative.brand} the same as ${d.brand}?`,
      a: top.match_type === "same_kind" ? `We can't say. ${MATCH_TYPE_META.same_kind.description} ${top.summary}` : top.summary,
    },
    ...(top.differences ? [{ q: `What's different about ${top.alternative.brand}?`, a: top.differences }] : []),
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${h.title} (${h.what})`,
      itemListElement: shown.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${p.alternative.brand}: ${p.alternative.product}`,
        url: `${SITE.url}/compare/${p.slug}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const relatedLinks = [
    ...related.map((r) => ({ href: `/dupe/${r.slug}`, label: r.brand, key: r.slug })),
    ...(d.actives ?? []).flatMap((a) => {
      const s = ingredientSlugFor(a);
      return s ? [{ href: `/ingredient/${s}`, label: `All about ${a}`, key: `ingredient-${a}` }] : [];
    }),
  ];

  return (
    <>
      {!near.length && <NotListedHere market={top.market} local={local} />}
      <div className="bg-canvas pb-8 md:pb-10">
        <ShelfHead
          crumbs={[
            { href: "/", label: "Home" },
            { href: `/category/${cat.slug}`, label: cat.name },
            { href: `/brand/${brandSlugFor(d.brand)}`, label: d.brand },
          ]}
          title={`${h.title} (${h.what})`}
          intro={
            <>
              <strong className="font-semibold text-ink">{top.alternative.brand}</strong> is{" "}
              {Math.round(top.savingsPct)}% cheaper: {cheaper} {per} against {dearer} for {d.brand}. {top.summary}
            </>
          }
          best={top.savingsPct}
          facts={
            <>
              Prices checked {monthYear(top.price_checked)}. Check the price at the store before you buy.
              <ListLinks />
            </>
          }
        />
        {shown.some((p) => HEALTH_CATEGORIES.has(p.category)) && (
          <div className="container-page mb-4">
            <HealthNotice pets={shown.some((p) => p.category === "pet")} />
          </div>
        )}

        <div className="container-page">
          <h2 className="display mb-3 text-xl md:text-2xl">{listHeading(shown)}</h2>
          <div className="grid gap-2 sm:gap-3 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <PairCard pair={toSummary(top)} eager />
            <div className="card flex flex-col p-3 md:p-4">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="display text-lg" title={MATCH_TYPE_META[top.match_type].description}>
                  {MATCH_TYPE_META[top.match_type].label}
                </span>
                {top.match_type !== "same_kind" && <ConfidenceBadge confidence={top.confidence} />}
              </p>
              <p className="mt-1 mb-3 max-w-[68ch] text-sm text-ink-2">{MATCH_TYPE_META[top.match_type].description}</p>
              <MatchCounts pair={top} />
              <p className="mt-auto flex flex-wrap gap-2 pt-3">
                <Link href={`/compare/${top.slug}`} className="btn btn-primary">
                  See the full comparison
                </Link>
                <Link href={`/brand/${brandSlugFor(d.brand)}`} className="btn btn-ghost">
                  All {d.brand} swaps
                </Link>
              </p>
            </div>
          </div>
          {others.length > 0 && (
            <div className="mt-3">
              <SwapGrid pairs={others} lazy />
            </div>
          )}
        </div>
      </div>

      <section className="container-page pt-8 md:pt-10">
        <h2 className="display mb-3 text-xl md:text-2xl">Questions</h2>
        <dl className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
          {faq.map((f) => (
            <div key={f.q} className="border-t border-line pt-3">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 max-w-[68ch] text-sm text-ink-2">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {relatedLinks.length > 0 && (
        <section className="container-page pt-8 md:pt-10">
          <h2 className="display mb-3 text-xl md:text-2xl">Related</h2>
          <TagLinks links={relatedLinks} />
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
    </>
  );
}
