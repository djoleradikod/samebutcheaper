import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import {
  brandSlugFor,
  getDupe,
  getDupes,
  getRelatedDupes,
  ingredientSlugFor,
  type DupeEntry,
} from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { comparison, matchParts } from "@/lib/compare";
import { monthYear, ppu } from "@/lib/format";
import { ConfidenceBadge, MatchBadge, SavingsBadge } from "@/components/Badges";
import { MarketTag } from "@/components/MarketTag";
import { ProductThumb } from "@/components/ProductThumb";
import { SITE } from "@/lib/site";
import type { Pair } from "@/lib/types";

export function generateStaticParams() {
  return getDupes().map((d) => ({ slug: d.slug }));
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

export async function generateMetadata({ params }: PageProps<"/dupe/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const d = getDupe(slug);
  if (!d) return { title: "Page not found", robots: { index: false } };
  const h = heading(d);
  const top = d.pairs[0];
  return {
    title: `${h.title} (${h.what}): save up to ${Math.round(top.savingsPct)}%`,
    description: `${top.alternative.brand} costs ${ppu(top.alternative.ppu, top.currency)} per ${top.brand.unit} against ${ppu(top.brand.ppu, top.currency)} for ${d.brand}. ${top.summary}`,
    alternates: { canonical: `/dupe/${d.slug}` },
  };
}

function partsText(p: Pair) {
  const m = matchParts(comparison(p));
  const bits: string[] = [];
  if (m.labelMatches === true) bits.push(p.match_type === "equivalent_spec" ? "Key specs match" : "Actives match");
  if (m.labelMatches === false) bits.push(p.match_type === "equivalent_spec" ? "Some specs differ" : "Some actives differ");
  bits.push(`${m.same} points the same`);
  if (m.differ) bits.push(`${m.differ} differ or to check`);
  if (m.brandBetter) bits.push(`brand ahead on ${m.brandBetter}`);
  return bits.join(" · ");
}

export default async function DupePage({ params }: PageProps<"/dupe/[slug]">) {
  const { slug } = await params;
  const d = getDupe(slug);
  if (!d) notFound();
  const h = heading(d);
  const top = d.pairs[0];
  const cat = CATEGORY_MAP[top.category];
  const related = getRelatedDupes(d);
  const n = d.pairs.length;

  const faq = [
    {
      q: `Is there a ${h.noun} for ${d.brand}?`,
      a: `Yes. We've verified ${n} cheaper match${n === 1 ? "" : "es"}. The biggest saving is ${top.alternative.brand}, ${Math.round(top.savingsPct)}% less per ${top.brand.unit} at the prices we checked in ${monthYear(top.price_checked)}.`,
    },
    {
      q: `Is ${top.alternative.brand} the same as ${d.brand}?`,
      a: top.summary,
    },
    ...(top.differences ? [{ q: `What's different about ${top.alternative.brand}?`, a: top.differences }] : []),
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${h.title} (${h.what})`,
      itemListElement: d.pairs.map((p, i) => ({
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

  return (
    <>
      <section className="hero-wash border-b border-line">
        <div className="container-page py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/category/${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/brand/${brandSlugFor(d.brand)}`} className="hover:text-ink">{d.brand}</Link>
          </nav>
          <h1 className="display mt-5 text-4xl font-medium sm:text-5xl">
            {h.title} <span className="text-muted">({h.what})</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
            <strong className="text-ink">{top.alternative.brand}</strong> is {Math.round(top.savingsPct)}% cheaper:{" "}
            {ppu(top.alternative.ppu, top.currency)} per {top.brand.unit} against {ppu(top.brand.ppu, top.currency)} for{" "}
            {d.brand}. {top.summary}
          </p>
          <p className="mt-3 text-sm text-muted">Prices checked {monthYear(top.price_checked)}. Check the price at the store before you buy.</p>
        </div>
      </section>

      <section className="container-page py-10">
        <h2 className="display text-2xl font-medium">
          {n === 1 ? "The verified match" : `All ${n} verified matches`}
        </h2>
        <ul className="mt-5 space-y-3">
          {d.pairs.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/compare/${p.slug}`}
                className="card group flex flex-col gap-4 p-4 transition hover:border-accent sm:flex-row sm:items-center"
              >
                <ProductThumb image={p.alternative.photo?.src ?? null} brand={p.alternative.brand} category={p.category} unit={p.alternative.unit} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold">{p.alternative.brand}</span>
                    <MarketTag market={p.market} />
                  </p>
                  <p className="text-sm text-ink-2">{p.alternative.product}</p>
                  <p className="mt-1 text-xs text-muted">Instead of {p.brand.product}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <MatchBadge type={p.match_type} />
                    <ConfidenceBadge confidence={p.confidence} />
                  </p>
                  <p className="num mt-2 text-xs text-ink-2">{partsText(p)}</p>
                </div>
                <div className="num flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <SavingsBadge pct={p.savingsPct} />
                  <p className="text-sm">
                    <span className="text-muted line-through">{ppu(p.brand.ppu, p.currency)}</span>{" "}
                    <span className="font-semibold text-accent">{ppu(p.alternative.ppu, p.currency)}</span>
                    <span className="text-muted"> / {p.brand.unit}</span>
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-accent">
                    See the proof <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page pb-10">
        <h2 className="display text-2xl font-medium">Questions</h2>
        <dl className="mt-4 space-y-5">
          {faq.map((f) => (
            <div key={f.q} className="max-w-3xl">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(related.length > 0 || d.actives) && (
        <section className="container-page pb-14">
          <h2 className="display text-2xl font-medium">Related</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link key={r.slug} href={`/dupe/${r.slug}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                {r.brand}
              </Link>
            ))}
            {(d.actives ?? []).map((a) => {
              const s = ingredientSlugFor(a);
              return s ? (
                <Link key={a} href={`/ingredient/${s}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                  All about {a}
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
