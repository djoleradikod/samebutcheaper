import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { BasketCard, COLLAGE_CELLS } from "@/components/BasketCard";
import { BasketCheckout, BasketLines, BasketProvider, BasketStoreSplit, BasketTotals, SaveAllButton } from "@/components/BasketLines";
import { HealthNotice, hostname } from "@/components/Evidence";
import { ProductThumb } from "@/components/ProductThumb";
import { basketLines, basketPhotos, priceDates, toBasketSummary } from "@/lib/basket-view";
import { getAllPresets, getPair, getPreset } from "@/lib/catalog";
import { MARKET_LABEL, MARKETS } from "@/lib/markets";
import { jsonLdText, SITE } from "@/lib/site";
import type { Preset } from "@/lib/types";
import { basketDescription, basketTitle } from "@/lib/seo";
import { forCountry, type Local } from "@/lib/localize";
import { NotListedHere } from "@/components/ShelfParts";
import { CountryPart } from "@/components/ForCountry";

const NEEDS_HEALTH_NOTE = new Set(["otc-medicine", "supplements", "baby", "pet"]);

export function generateStaticParams() {
  const presets = getAllPresets();
  // Cache Components requires at least one param; the placeholder 404s.
  return presets.length ? presets.map((p) => ({ slug: p.slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/basket/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = getPreset(slug);
  if (!p) return { title: "Basket not found" };
  const title = basketTitle(p);
  const description = basketDescription(p);
  return {
    title,
    description,
    alternates: { canonical: `/basket/${p.slug}` },
    openGraph: { title, description, url: `/basket/${p.slug}`, type: "article" },
  };
}

/**
 * One big photo with the rest around it, short on a phone and taller where it sits beside the
 * text. A plain grid for fewer than five. Name tiles if no photo is licensed yet.
 */
function Collage({ preset }: { preset: Preset }) {
  const photos = basketPhotos(preset, 6, true);
  if (photos.length >= 5) {
    return (
      <div className="grid aspect-[2/1] w-full grid-cols-4 grid-rows-2 gap-1 md:aspect-[4/3] md:grid-cols-3 md:grid-rows-3">
        {photos.map((p, i) => (
          <div
            key={p.src}
            className={`min-h-0 min-w-0 ${i === 0 ? "col-span-2 row-span-2" : ""} ${i === 5 ? "hidden md:block" : ""} ${
              i === 4 && photos.length === 5 ? "md:col-span-2" : ""
            }`}
          >
            <ProductThumb
              size="fill"
              image={p.src}
              brand={p.name}
              eager={i === 0}
              sizes={i === 0 ? "(min-width: 1024px) 300px, 50vw" : "(min-width: 1024px) 150px, 25vw"}
            />
          </div>
        ))}
      </div>
    );
  }
  const cells = COLLAGE_CELLS[photos.length];
  return (
    <div className="grid aspect-[2/1] w-full grid-cols-2 grid-rows-2 gap-1 md:aspect-[4/3]">
      {cells
        ? photos.map((p, i) => (
            <div key={p.src} className={`min-h-0 min-w-0 ${cells[i]}`}>
              <ProductThumb size="fill" image={p.src} brand={p.name} eager={i === 0} sizes="(min-width: 1024px) 300px, 50vw" />
            </div>
          ))
        : preset.lines.slice(0, 4).map((l) => (
            <div key={l.pair} className="min-h-0 min-w-0">
              <ProductThumb size="fill" brand={l.altName} />
            </div>
          ))}
    </div>
  );
}

export default async function BasketPage({ params }: PageProps<"/basket/[slug]">) {
  const { slug } = await params;
  const p = getPreset(slug);
  if (!p) notFound();
  return <CountryPart>{(local) => <BasketBody p={p} local={local} />}</CountryPart>;
}

function BasketBody({ p, local }: { p: NonNullable<ReturnType<typeof getPreset>>; local: Local }) {
  const lines = basketLines(p, local);
  const dates = priceDates(p);
  const all = forCountry(getAllPresets(), local);
  const otherMarkets = all.filter((x) => x.family === p.family && x.slug !== p.slug);
  const related = all
    .filter((x) => x.family !== p.family)
    .sort((a, b) => Number(b.market === p.market) - Number(a.market === p.market) || b.score - a.score)
    .slice(0, 3);
  const health = p.lines.some((l) => NEEDS_HEALTH_NOTE.has(getPair(l.pair)?.category ?? ""));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "Baskets and kits", item: `${SITE.url}/bundles` },
      { "@type": "ListItem", position: 3, name: p.title, item: `${SITE.url}/basket/${p.slug}` },
    ],
  };

  return (
    <BasketProvider lines={lines} currency={p.currency} market={p.market} country={local.known ? local.country : null}>
      <article>
        {!local.shows(p) && <NotListedHere market={p.market} local={local} />}
        <div className="border-b border-line bg-canvas">
          <div className="container-page pt-1 pb-6 md:pt-3 md:pb-8">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
              <Link href="/bundles" className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
                Baskets and kits
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <span className="inline-flex min-h-11 items-center md:min-h-0">Priced in {MARKETS[p.market].short}</span>
            </nav>

            <div className="md:mt-3 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-[auto_1fr] md:gap-x-8 lg:gap-x-12">
              <header className="md:col-start-2 md:row-start-1">
                <h1 className="display text-[1.75rem] md:text-[2.5rem]">{p.title}</h1>
                <p className="mt-1.5 text-base font-medium text-ink md:text-lg">{p.audience}</p>
                <p className="mt-1 max-w-[62ch] text-[15px] text-ink-2">{p.blurb}</p>
              </header>

              <div className="mt-3 md:col-start-1 md:row-span-2 md:row-start-1 md:mt-0">
                <Collage preset={p} />
                <p className="mt-1.5 text-xs text-muted">
                  <Link href="/credits" className="underline underline-offset-2 hover:text-ink">
                    Photos
                  </Link>
                </p>
              </div>

              <div className="mt-4 md:col-start-2 md:row-start-2 md:mt-5">
                <BasketTotals />
                <BasketStoreSplit />
                <p className="mt-3 max-w-[62ch] text-sm text-ink-2">
                  Both totals buy the same amount of each product, added up from each swap&apos;s price per unit. Stores sell whole
                  packs, so the till figures count the packs you&apos;d buy.
                  {dates ? ` Prices are from ${MARKETS[p.market].short}, dated ${dates}, so check them before you buy.` : ""}
                </p>
                <div className="mt-3">
                  <SaveAllButton />
                </div>
                {otherMarkets.length > 0 && (
                  <p className="mt-1 text-sm text-ink-2">
                    Also priced in{" "}
                    {otherMarkets.map((x, i) => (
                      <span key={x.slug}>
                        {i > 0 && ", "}
                        <Link href={`/basket/${x.slug}`} className="text-cobalt underline underline-offset-2">
                          {MARKET_LABEL[x.market]}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="container-page pt-6 md:pt-8">
          <div className="mb-3 max-w-[62ch]">
            <h2 className="display text-xl md:text-2xl">What&apos;s in it</h2>
            <p className="mt-1 text-sm text-ink-2 md:text-[15px]">
              Change a quantity and both sides scale, so you still compare the same amount. Set it to zero to leave an item out.
            </p>
          </div>
          <BasketLines />
        </section>

        <div className="container-page pt-8 md:pt-10">
          <div className="max-w-3xl">
            <BasketCheckout />
          </div>
        </div>

        <section className="container-page grid gap-6 pt-8 md:grid-cols-2 md:gap-12 md:pt-10">
          <div>
            <h2 className="display text-xl md:text-2xl">How this list was chosen</h2>
            <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">{p.research}</p>
            <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">
              Prices and evidence are on each swap, with their own sources and dates.{" "}
              <Link href="/how-we-verify" className="text-cobalt underline underline-offset-2">
                How we check
              </Link>
            </p>
          </div>
          <div>
            <h3 className="text-base">Guides and checklists we read</h3>
            <ul className="mt-1">
              {p.sources.map((s) => (
                <li key={s}>
                  <a
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-cobalt underline underline-offset-2 md:min-h-8"
                  >
                    {hostname(s)}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {health && (
          <div className="container-page pt-6">
            <HealthNotice />
          </div>
        )}

        {related.length > 0 && (
          <section className="container-page pt-8 md:pt-10">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6">
              <h2 className="display text-xl md:text-2xl">Other baskets</h2>
              <Link href="/bundles" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
                All baskets and kits
              </Link>
            </div>
            <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
              {related.map((x) => (
                <BasketCard key={x.slug} basket={toBasketSummary(x)} />
              ))}
            </div>
          </section>
        )}

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
      </article>
    </BasketProvider>
  );
}
