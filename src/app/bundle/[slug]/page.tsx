import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { COLLAGE_CELLS } from "@/components/BasketCard";
import { BundleCard } from "@/components/BundleCard";
import { BundleWhereToBuy } from "@/components/BundleWhereToBuy";
import { HEALTH_CATEGORIES, HealthNotice, SourceList } from "@/components/Evidence";
import { ProductThumb } from "@/components/ProductThumb";
import { SaveButton } from "@/components/SaveButton";
import { SaveTicket } from "@/components/Ticket";
import { linksEarn, mayEarn, RETAILER_LABEL, storeName } from "@/lib/affiliate";
import { packSize } from "@/lib/basket-view";
import { getAllBundles, getBundle } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { money, monthYear } from "@/lib/format";
import { jsonLdText, SITE } from "@/lib/site";
import { unitDisplay } from "@/lib/unit-format";
import { forCountry, localText, MARKET_ADJECTIVE } from "@/lib/localize";
import { NotListedHere } from "@/components/ShelfParts";
import { getLocal } from "@/lib/server-country";
import { Money, UnitAmount } from "@/components/Money";
import type { Bundle } from "@/lib/types";

export function generateStaticParams() {
  const bundles = getAllBundles();
  // Cache Components requires at least one param; the placeholder 404s.
  return bundles.length ? bundles.map((b) => ({ slug: b.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/bundle/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = getBundle(slug);
  if (!b) return { title: "Kit not found" };
  const title = `${b.bundle.name}: rebuilt for ${Math.round(b.savingsPct)}% less`;
  const description = `${b.summary} ${money(b.equivalentTotal, b.currency)} for the same amount, against ${money(b.bundle.price, b.currency)} for the kit.`;
  return {
    title,
    description,
    alternates: { canonical: `/bundle/${b.slug}` },
    openGraph: { title, description, url: `/bundle/${b.slug}`, type: "article" },
  };
}

/** The first image on the page that has a real photo. It loads eagerly. */
function eagerTarget(b: Bundle) {
  if (b.photo) return "kit";
  return b.components.slice(0, 4).findIndex((c) => c.photo);
}

export default async function BundlePage({ params }: PageProps<"/bundle/[slug]">) {
  const { slug } = await params;
  const record = getBundle(slug);
  if (!record) notFound();

  const local = await getLocal();
  const b = localText(record, local);
  const sells = (retailer: string) => local.sells(retailer, b.market);
  const cat = CATEGORY_MAP[b.category];
  const related = forCountry(getAllBundles(), local)
    .filter((x) => x.slug !== b.slug)
    .sort((x, y) => Number(y.category === b.category) - Number(x.category === b.category) || y.score - x.score)
    .slice(0, 4);
  const perMonth =
    b.bundle.billing === "subscription" && b.bundle.supply_days ? (b.savings / b.bundle.supply_days) * 30 : null;
  const pieces = b.components.slice(0, 4);
  const eager = eagerTarget(b);
  const earns = b.components.some((c) => mayEarn(c, b.market)) || mayEarn(b.bundle, b.market);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Baskets and kits", item: `${SITE.url}/bundles` },
      { "@type": "ListItem", position: 3, name: b.bundle.name, item: `${SITE.url}/bundle/${b.slug}` },
    ],
  };

  return (
    <article>
      {!local.shows(record) && <NotListedHere market={record.market} local={local} />}
      <div className="border-b border-line bg-canvas">
        <div className="container-page pt-1 pb-6 md:pt-3 md:pb-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
            <Link href="/bundles" className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
              Baskets and kits
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <Link href={`/category/${cat.slug}`} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
              {cat.name}
            </Link>
          </nav>

          <h1 className="display max-w-[30ch] text-[1.75rem] md:mt-3 md:text-[2.5rem]">{b.bundle.name}</h1>
          <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2 md:text-base">{b.summary}</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
            {/* The answer first: the kit, the ticket, and the same amount built from cheaper pieces. */}
            <div className="grid grid-cols-2 items-start gap-x-2 gap-y-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-x-4">
              <div className="min-w-0">
                <div className="aspect-square md:aspect-[4/3]">
                  <ProductThumb
                    size="fill"
                    image={b.photo?.src ?? null}
                    brand={b.bundle.brand}
                    alt={b.bundle.name}
                    category={b.category}
                    eager={eager === "kit"}
                    sizes="(min-width: 1024px) 340px, 45vw"
                  />
                </div>
                <p className="mt-2 text-[13px] font-medium text-ink-2">The {b.bundle.brand} kit</p>
                <p className="price mt-1 text-[1.75rem] font-semibold text-muted md:text-[2rem]"><Money n={b.bundle.price} from={b.currency} /></p>
                <p className="mt-1 text-xs text-muted">
                  {b.bundle.billing === "subscription" ? "Per shipment" : "One price"}
                  {b.bundle.supply_days ? `, about ${b.bundle.supply_days} days' supply` : ""}
                </p>
              </div>

              <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto md:self-center">
                <SaveTicket
                  size="lg"
                  amount={b.savings}
                  currency={b.currency}
                  sub={perMonth ? `about ${local.bare(perMonth, b.currency)} a month` : `${Math.round(b.savingsPct)}% less`}
                />
              </div>

              <div className="min-w-0">
                <div className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-1 md:aspect-[4/3]">
                  {pieces.map((c, i) => (
                    <div key={c.replaces} className={`min-h-0 min-w-0 ${COLLAGE_CELLS[pieces.length]?.[i] ?? ""}`}>
                      <ProductThumb
                        size="fill"
                        quiet
                        image={c.photo?.src ?? null}
                        brand={c.brand}
                        alt={c.product}
                        category={b.category}
                        unit={c.unit}
                        eager={eager === i}
                        sizes="(min-width: 1024px) 170px, 22vw"
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[13px] font-medium text-ink-2">
                  Built from {b.components.length} cheaper item{b.components.length === 1 ? "" : "s"}
                </p>
                <p className="price mt-1 text-[2.25rem] text-ink md:text-[2.75rem]"><Money n={b.equivalentTotal} from={b.currency} /></p>
                <p className="mt-1 text-xs text-muted">The same amount as the kit holds</p>
              </div>
            </div>

            <aside className="card self-start p-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">Match</dt>
                  <dd>
                    <MatchBadge type={b.match_type} long />
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">Evidence</dt>
                  <dd>
                    <ConfidenceBadge confidence={b.confidence} />
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">Prices checked</dt>
                  <dd className="text-[13px] font-medium">{monthYear(b.price_checked)}</dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">Buying every full pack</dt>
                  <dd className="price text-base"><Money n={b.upfrontTotal} from={b.currency} /></dd>
                </div>
              </dl>
              {b.upfrontTotal > b.bundle.price && (
                <p className="mt-2 text-[13px] leading-snug text-ink-2">
                  The full packs cost more up front. They hold more than the kit, so they last longer.
                </p>
              )}
              <div className="mt-3 space-y-2">
                <SaveButton slug={b.slug} />
                {sells(b.bundle.retailer) && (
                  <a
                    href={`/go/${b.slug}/brand`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="btn btn-ghost w-full"
                  >
                    See the kit at {storeName(b.bundle.retailer, b.bundle.url)} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 pt-6 md:pt-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="display mb-3 text-xl md:text-2xl">Piece by piece</h2>
            <div className="card">
              <ol className="divide-y divide-line">
                {b.components.map((c, i) => {
                  const item = b.bundle.items[c.replaces];
                  return (
                    <li key={c.replaces} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4 md:p-4">
                      <ProductThumb
                        image={c.photo?.src ?? null}
                        brand={c.brand}
                        alt={c.product}
                        category={b.category}
                        unit={c.unit}
                        size="sm"
                        sizes="(min-width: 768px) 96px, 64px"
                        className="md:h-24 md:w-24"
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] leading-snug text-ink-2">
                          Instead of <span className="font-medium text-ink">{item.name}</span>
                          {`, ${packSize(item.size, item.unit)}`}
                        </p>
                        <p className="mt-1 text-[15px] leading-snug font-semibold">{withBrand(c.brand, c.product)}</p>
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-ink-2">
                          <span>
                            <span className="price text-[15px] text-ink"><UnitAmount ppu={c.ppu} unit={c.unit} from={b.currency} /></span>{" "}
                            {unitDisplay(c.unit).label}
                          </span>
                          <span>
                            Pack of {packSize(c.size, c.unit)}, <span className="num"><Money n={c.price} from={b.currency} /></span>
                          </span>
                          <MatchBadge type={c.match_type} />
                        </p>
                        {c.photo && (
                          <p className="mt-1 text-xs text-muted">
                            Photo:{" "}
                            <a href={c.photo.page} target="_blank" rel="noopener nofollow" className="underline underline-offset-2 hover:text-ink">
                              {c.photo.credit}
                            </a>
                            , {c.photo.license}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:flex-col md:items-end md:justify-start">
                        <p className="md:text-right">
                          <span className="block text-xs font-medium text-muted">Same amount</span>
                          <span className="price mt-0.5 block text-[1.375rem] text-ink"><Money n={c.equivalentCost} from={b.currency} /></span>
                        </p>
                        {sells(c.retailer) && (
                          <a
                            href={`/go/${b.slug}/item-${i}`}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className="btn btn-ghost text-sm"
                          >
                            {c.retailer === "other" ? "Go to the store" : RETAILER_LABEL[c.retailer]} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-b-card border-t border-line-strong bg-canvas px-3 py-3 md:px-4">
                <p className="text-sm font-medium">Same amount as the kit</p>
                <p className="price text-[1.375rem] text-ink"><Money n={b.equivalentTotal} from={b.currency} /></p>
              </div>
            </div>
          </section>

          {(b.differences || b.bundle.extras.length > 0) && (
            <section className="rounded-card border border-different/30 bg-different-soft p-4 md:p-5">
              <h2 className="display text-xl md:text-2xl">Where the kit differs</h2>
              {b.differences && <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2">{b.differences}</p>}
              {b.bundle.extras.length > 0 && (
                <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2">
                  <span className="font-semibold text-ink">The kit also comes with: </span>
                  {b.bundle.extras.join(", ")}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="display text-xl md:text-2xl">How we checked each item</h2>
            <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2">{b.evidence}</p>
          </section>

          <SourceList sources={b.sources} />
          {HEALTH_CATEGORIES.has(b.category) && <HealthNotice />}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <h2 className="text-base">Shopping list</h2>
            <ul className="mt-2 divide-y divide-line">
              {b.components.map((c, i) => (
                <li key={c.replaces}>
                  <a
                    href={sells(c.retailer) ? `/go/${b.slug}/item-${i}` : "#where-to-buy"}
                    target={sells(c.retailer) ? "_blank" : undefined}
                    rel="sponsored nofollow noopener"
                    className="group flex min-h-11 items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium group-hover:underline">{c.brand}</span>
                      <span className="block text-xs text-muted">
                        <span className="num"><Money n={c.price} from={b.currency} /></span> at {sells(c.retailer) ? storeName(c.retailer, c.url) : `a ${MARKET_ADJECTIVE[b.market]} store`}
                      </span>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cobalt" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">
            {earns
              ? "Some of these are affiliate links, so we may earn a commission at no extra cost to you."
              : linksEarn()
                ? "These links don't earn us anything. A store search further down may."
                : "We don't earn anything from these links."}{" "}
            <Link href="/disclosure" className="underline underline-offset-2">
              Details
            </Link>
          </p>
          <div id="where-to-buy" className="scroll-mt-20">
            <BundleWhereToBuy
              slug={b.slug}
              market={b.market}
              health={HEALTH_CATEGORIES.has(b.category)}
              items={b.components.map((c) => ({
                retailer: c.retailer,
                retailerLabel: storeName(c.retailer, c.url),
                replaces: b.bundle.items[c.replaces].name,
                lookFor: c.lookFor,
              }))}
            />
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page pt-8 md:pt-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6">
            <h2 className="display text-xl md:text-2xl">More kits</h2>
            <Link href="/bundles" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
              All baskets and kits
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
            {related.map((x) => (
              <BundleCard key={x.slug} bundle={x} />
            ))}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
    </article>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}
