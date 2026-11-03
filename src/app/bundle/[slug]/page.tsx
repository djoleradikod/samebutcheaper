import type { Metadata } from "next";
import Link from "next/link";
import { ProductThumb } from "@/components/ProductThumb";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowRight, ChevronRight, ExternalLink, Package } from "lucide-react";
import { getAllBundles, getBundle } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { formatSize, monthYear, ppu, money } from "@/lib/format";
import { mayEarn, RETAILER_LABEL } from "@/lib/affiliate";
import { ConfidenceBadge, MatchBadge, SavingsBadge } from "@/components/Badges";
import { BundleCard } from "@/components/BundleCard";
import { Differences, HEALTH_CATEGORIES, HealthNotice, SourceList } from "@/components/Evidence";
import { SITE } from "@/lib/site";
import { SaveButton } from "@/components/SaveButton";
import { BundleWhereToBuy } from "@/components/BundleWhereToBuy";

export function generateStaticParams() {
  const bundles = getAllBundles();
  // Cache Components requires at least one param; the placeholder 404s.
  return bundles.length ? bundles.map((b) => ({ slug: b.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/bundle/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = getBundle(slug);
  if (!b) return { title: "Bundle not found" };
  const title = `${b.bundle.name}: build it for ${Math.round(b.savingsPct)}% less`;
  const description = `${b.summary} ${money(b.equivalentTotal, b.currency)} instead of ${money(b.bundle.price, b.currency)}.`;
  return {
    title,
    description,
    alternates: { canonical: `/bundle/${b.slug}` },
    openGraph: { title, description, url: `/bundle/${b.slug}`, type: "article" },
  };
}

export default async function BundlePage({ params }: PageProps<"/bundle/[slug]">) {
  const { slug } = await params;
  const b = getBundle(slug);
  if (!b) notFound();
  const cat = CATEGORY_MAP[b.category];
  const related = getAllBundles()
    .filter((x) => x.slug !== b.slug)
    .sort((x, y) => Number(y.category === b.category) - Number(x.category === b.category))
    .slice(0, 3);
  const perMonth =
    b.bundle.billing === "subscription" && b.bundle.supply_days
      ? (b.savings / b.bundle.supply_days) * 30
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Bundles", item: `${SITE.url}/bundles` },
      { "@type": "ListItem", position: 3, name: b.title, item: `${SITE.url}/bundle/${b.slug}` },
    ],
  };

  return (
    <article>
      <div className="hero-wash border-b border-line">
        <div className="container-page py-8 md:py-12">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/bundles" className="hover:text-ink">Bundles</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/category/${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
          </nav>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <MatchBadge type={b.match_type} long />
            <ConfidenceBadge confidence={b.confidence} />
            <span className="text-xs text-muted">Prices checked {monthYear(b.price_checked)}</span>
          </div>
          <h1 className="display mt-4 max-w-4xl text-4xl leading-tight font-medium sm:text-5xl">
            {b.bundle.name}
            <span className="block text-muted">rebuilt for {Math.round(b.savingsPct)}% less</span>
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-2">{b.summary}</p>

          <div className="num mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-line bg-white/85 p-5 shadow-[var(--shadow)] backdrop-blur">
            <SavingsBadge pct={b.savingsPct} size="lg" />
            <div>
              <p className="text-xs text-muted">
                {b.bundle.brand} {b.bundle.billing === "subscription" ? "per shipment" : "bundle"}
              </p>
              <p className="text-lg text-muted line-through">{money(b.bundle.price, b.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Same amount, built yourself</p>
              <p className="text-lg font-semibold text-accent">{money(b.equivalentTotal, b.currency)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">
                {perMonth ? "You save per month" : "You save"}
              </p>
              <p className="text-lg font-semibold">{money(perMonth ?? b.savings, b.currency)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          <section className="card overflow-hidden">
            <div className="flex items-center gap-4 border-b border-line bg-brand-soft/60 px-5 py-4">
              {b.bundle.image ? (
                <ProductThumb image={b.bundle.image} brand={b.bundle.brand} category={b.category} size="sm" />
              ) : (
                <Package className="h-5 w-5 text-brand-tone" />
              )}
              <div>
                <h2 className="font-semibold">What&apos;s in the {b.bundle.brand} bundle</h2>
                <p className="text-sm text-muted">
                  {money(b.bundle.price, b.currency)}
                  {b.bundle.billing === "subscription" ? " per shipment" : ""}
                  {b.bundle.supply_days ? ` · about a ${b.bundle.supply_days}-day supply` : ""}
                </p>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {b.bundle.items.map((item, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="num text-muted">
                    {formatSize(item.size, item.unit)}
                    {item.key_ingredients.length > 0 &&
                      ` · ${item.key_ingredients.map((k) => `${k.name}${k.amount ? ` ${k.amount}` : ""}`).join(", ")}`}
                  </span>
                </li>
              ))}
              {b.bundle.extras.length > 0 && (
                <li className="px-5 py-3 text-xs text-muted">Also includes: {b.bundle.extras.join(", ")}</li>
              )}
            </ul>
          </section>

          <div className="flex justify-center text-muted" aria-hidden="true">
            <ArrowDown className="h-5 w-5" />
          </div>

          <section className="card overflow-hidden border-accent/30">
            <div className="border-b border-line bg-accent-soft/50 px-5 py-4">
              <h2 className="font-semibold text-accent-strong">Build it yourself</h2>
              <p className="text-sm text-muted">
                Each item is replaced by a product with the same active ingredients, formula or spec.
              </p>
            </div>
            <ol className="divide-y divide-line">
              {b.components.map((c, i) => {
                const item = b.bundle.items[c.replaces];
                return (
                  <li key={i} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    <ProductThumb image={c.image} brand={c.brand} category={b.category} unit={c.unit} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted">Replaces: {item.name}</p>
                      <p className="mt-0.5 font-semibold">{c.brand}</p>
                      <p className="text-sm text-ink-2">{c.product}</p>
                      <div className="num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <MatchBadge type={c.match_type} />
                        <span>{ppu(c.ppu, b.currency)} per {c.unit}</span>
                        <span>
                          Pack {formatSize(c.size, c.unit)} for {money(c.price, b.currency)}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-4 sm:col-span-1 sm:flex-col sm:items-end sm:gap-2">
                      <p className="num text-right">
                        <span className="block text-xs text-muted">Same amount</span>
                        <span className="font-semibold text-accent">{money(c.equivalentCost, b.currency)}</span>
                      </p>
                      <a
                        href={`/go/${b.slug}/item-${i}`}
                        target="_blank"
                        rel="sponsored nofollow noopener"
                        className="btn btn-ghost px-3 py-2 text-sm"
                      >
                        {RETAILER_LABEL[c.retailer]} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="num grid gap-1 border-t border-line bg-surface-2 px-5 py-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted">Same amount as the bundle: </span>
                <span className="font-semibold text-accent">{money(b.equivalentTotal, b.currency)}</span>
              </p>
              <p className="sm:text-right">
                <span className="text-muted">Buying the full packs: </span>
                <span className="font-semibold">{money(b.upfrontTotal, b.currency)}</span>
              </p>
              {b.upfrontTotal > b.bundle.price && (
                <p className="text-xs text-muted sm:col-span-2">
                  The full packs cost more up front, but they hold more product, so they last longer than the
                  bundle.
                </p>
              )}
            </div>
          </section>

          <section className="prose-sbc">
            <h2>How we checked each item</h2>
            <p>{b.evidence}</p>
          </section>
          <Differences text={b.differences} />
          <SourceList sources={b.sources} />
          {HEALTH_CATEGORIES.has(b.category) && <HealthNotice />}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-sm font-semibold">Shopping list</p>
            <ul className="mt-3 space-y-2">
              {b.components.map((c, i) => (
                <li key={i}>
                  <a
                    href={`/go/${b.slug}/item-${i}`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm hover:border-accent"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.brand}</span>
                      <span className="num block text-xs text-muted">
                        {money(c.price, b.currency)} at {RETAILER_LABEL[c.retailer]}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={`/go/${b.slug}/brand`}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="mt-4 block text-center text-xs text-muted underline underline-offset-2"
            >
              See the {b.bundle.brand} bundle price
            </a>
          </div>
          <p className="text-center text-xs text-muted">
            {b.components.some((c) => mayEarn(c)) || mayEarn(b.bundle)
              ? "Affiliate links. We may earn a commission at no cost to you."
              : "We don't earn anything from these links."}{" "}
            <Link href="/disclosure" className="underline underline-offset-2">Details</Link>
          </p>
          <BundleWhereToBuy
            slug={b.slug}
            market={b.market}
            health={HEALTH_CATEGORIES.has(b.category)}
            items={b.components.map((c) => ({
              retailer: c.retailer,
              retailerLabel: RETAILER_LABEL[c.retailer],
              replaces: b.bundle.items[c.replaces].name,
              lookFor: c.lookFor,
            }))}
          />
          <SaveButton slug={b.slug} />
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page pb-4">
          <h2 className="display text-2xl font-medium">More bundles</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((x) => (
              <BundleCard key={x.slug} bundle={x} />
            ))}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}
