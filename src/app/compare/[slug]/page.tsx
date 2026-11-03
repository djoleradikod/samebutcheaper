import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BadgeCheck, ChevronRight, ExternalLink, Info, Star } from "lucide-react";
import { brandSlugFor, getAllPairs, getBrand, getPair, getRelatedPairs, ingredientSlugFor, toSummary } from "@/lib/catalog";
import { SaveButton } from "@/components/SaveButton";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { formatSize, inSentence, monthYear, ppu, money } from "@/lib/format";
import { atStore, mayEarn, RETAILER_LABEL } from "@/lib/affiliate";
import { ConfidenceBadge, MatchBadge, SavingsBadge } from "@/components/Badges";
import { PairCard } from "@/components/PairCard";
import { SavingsCalculator } from "@/components/SavingsCalculator";
import { SITE } from "@/lib/site";
import { WhereToBuy } from "@/components/WhereToBuy";
import { ProductThumb } from "@/components/ProductThumb";
import { SameOrDifferent } from "@/components/SameOrDifferent";
import { comparison, differencePoints } from "@/lib/compare";
import type { Pair, ProductSide } from "@/lib/types";

export function generateStaticParams() {
  return getAllPairs().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return { title: "Swap not found" };
  const title = `${pair.brand.brand} vs ${pair.alternative.brand}: save ${Math.round(pair.savingsPct)}%`;
  const description = `${pair.summary} ${ppu(pair.alternative.ppu, pair.currency)} vs ${ppu(pair.brand.ppu, pair.currency)} per ${pair.brand.unit}.`;
  return {
    title,
    description,
    alternates: { canonical: `/compare/${pair.slug}` },
    openGraph: { title, description, url: `/compare/${pair.slug}`, type: "article" },
  };
}

const HEALTH_CATEGORIES = new Set(["otc-medicine", "supplements", "baby", "pet", "skincare-personal-care"]);

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();

  const cat = CATEGORY_MAP[pair.category];
  const related = getRelatedPairs(pair, 3).map(toSummary);
  const brandCount = getBrand(brandSlugFor(pair.brand.brand))?.pairs.length ?? 0;
  const unitsPerPack = pair.brand.size;
  const compared = comparison(pair, ingredientSlugFor);
  const differences = pair.differences ? differencePoints(pair.differences) : [];
  const sameLicence = sameLicenceNumber(pair);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: cat.name, item: `${SITE.url}/category/${cat.slug}` },
        { "@type": "ListItem", position: 3, name: pair.title, item: `${SITE.url}/compare/${pair.slug}` },
      ],
    },
    ...[pair.alternative, pair.brand].map((p) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.product,
      brand: { "@type": "Brand", name: p.brand },
      offers: {
        "@type": "Offer",
        price: p.price.toFixed(2),
        priceCurrency: pair.currency,
        url: p.url,
      },
    })),
  ];

  return (
    <article>
      <div className="hero-wash border-b border-line">
        <div className="container-page py-8 md:py-12">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <Link href="/" className="hover:text-ink">Home</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/category/${cat.slug}`} className="hover:text-ink">{cat.name}</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink-2">{pair.subcategory}</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <MatchBadge type={pair.match_type} long />
            <ConfidenceBadge confidence={pair.confidence} />
            {sameLicence && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky/15 px-2.5 py-0.5 text-xs font-semibold text-ink">
                <BadgeCheck className="h-3.5 w-3.5 text-sky" aria-hidden="true" />
                Same licensed medicine ({sameLicence})
              </span>
            )}
            <span className="text-xs text-muted">Prices checked {monthYear(pair.price_checked)}</span>
          </div>
          <h1 className="display mt-4 max-w-4xl text-4xl leading-tight font-medium sm:text-5xl">
            {pair.brand.brand} <span className="text-muted">vs</span> {pair.alternative.brand}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-2">{pair.summary}</p>

          {/* Savings strip */}
          <div className="num mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-line bg-white/85 p-5 shadow-[var(--shadow)] backdrop-blur">
            <SavingsBadge pct={pair.savingsPct} size="lg" />
            <div>
              <p className="text-xs text-muted">Price per {pair.brand.unit}</p>
              <p className="text-lg">
                <span className="text-muted line-through">{ppu(pair.brand.ppu, pair.currency)}</span>{" "}
                <span className="font-semibold text-accent">{ppu(pair.alternative.ppu, pair.currency)}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Saved on a pack of {formatSize(unitsPerPack, pair.brand.unit)}</p>
              <p className="text-lg font-semibold">{money(pair.savingsPerPack, pair.currency)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8">
          {/* Product cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <ProductPanel side="brand" pair={pair} product={pair.brand} />
            <ProductPanel side="alternative" pair={pair} product={pair.alternative} />
          </div>

          {/* What's the same, what's different */}
          <SameOrDifferent
            comparison={compared}
            brandName={pair.brand.brand}
            altName={pair.alternative.brand}
            intro={`${MATCH_TYPE_META[pair.match_type].description} Here is every point, including where the brand is better.`}
          />

          {/* Evidence */}
          <section className="prose-sbc">
            <h2>Why we say they&apos;re the same</h2>
            <p>{pair.evidence}</p>
            {differences.length > 0 && (
              <div className="mt-5 flex gap-3 rounded-2xl border border-brand-tone/20 bg-brand-soft p-5">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-tone" />
                <div>
                  <p className="!my-0 font-semibold text-ink">Honest differences</p>
                  <ul className="!mt-2 !mb-0 list-disc space-y-1 !pl-5 text-sm leading-relaxed text-ink-2">
                    {differences.map((d) => (
                      <li key={d} className="!my-0">{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="display text-2xl font-medium">Sources</h2>
            <p className="mt-1 text-sm text-muted">What we checked. Look for yourself.</p>
            <ol className="mt-4 space-y-2">
              {pair.sources.map((s, i) => (
                <li key={s} className="flex gap-3 text-sm">
                  <span className="num w-5 shrink-0 text-muted">{i + 1}.</span>
                  <a
                    href={s}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex min-w-0 items-center gap-1 break-all text-accent underline-offset-2 hover:underline"
                  >
                    <span className="font-medium">{hostname(s)}</span>
                    <span className="truncate text-muted">{pathOf(s)}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </li>
              ))}
            </ol>
          </section>

          {HEALTH_CATEGORIES.has(pair.category) && (
            <div className="flex gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-5 text-sm text-ink-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
              <p className="leading-relaxed">
                This compares labels and published evidence. It isn&apos;t medical advice. Inactive ingredients
                (fillers, dyes, flavours) can differ, which matters if you have allergies. Always read the label,
                and ask a pharmacist, doctor or vet if you&apos;re unsure.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {isDurable(pair) ? (
            <div className="card p-5">
              <p className="text-sm text-muted">You save, once</p>
              <p className="num mt-1 text-3xl font-semibold text-accent">{money(pair.savingsPerPack, pair.currency)}</p>
              <p className="mt-2 text-sm text-ink-2">
                {money(pair.alternative.price, pair.currency)} instead of {money(pair.brand.price, pair.currency)} for
                the same amount. It&apos;s a one-off buy, so there&apos;s no monthly saving to add up.
              </p>
            </div>
          ) : (
            <SavingsCalculator
              currency={pair.currency}
              brandPpu={pair.brand.ppu}
              altPpu={pair.alternative.ppu}
              unit={pair.brand.unit}
              defaultMonthly={defaultMonthly(pair)}
            />
          )}
          <a
            href={`/go/${pair.slug}/alternative`}
            rel="sponsored nofollow noopener"
            target="_blank"
            className="btn btn-primary w-full py-3.5 text-base"
          >
            Get {pair.alternative.brand} {atStore(pair.alternative.retailer)}
            <ExternalLink className="h-4 w-4" />
          </a>
          <p className="text-center text-xs text-muted">
            {mayEarn(pair.alternative)
              ? "Affiliate link. We may earn a commission at no cost to you."
              : "We don't earn anything from this link."}{" "}
            <Link href="/disclosure" className="underline underline-offset-2">Details</Link>
          </p>
          <WhereToBuy
            slug={pair.slug}
            market={pair.market}
            retailer={pair.alternative.retailer}
            retailerLabel={RETAILER_LABEL[pair.alternative.retailer]}
            lookFor={pair.lookFor}
            health={HEALTH_CATEGORIES.has(pair.category)}
            compareWith={
              pair.brand.product.toLowerCase().startsWith(pair.brand.brand.toLowerCase())
                ? pair.brand.product
                : `${pair.brand.brand} ${pair.brand.product}`
            }
          />
          <SaveButton slug={pair.slug} />
          {brandCount > 1 && (
            <Link
              href={`/brand/${brandSlugFor(pair.brand.brand)}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 text-sm hover:border-accent"
            >
              <span className="font-medium">{brandCount} {pair.brand.brand} products</span> have cheaper
              matches <span className="text-accent">→</span>
            </Link>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="container-page pb-4">
          <h2 className="display text-2xl font-medium">More {inSentence(cat.name)} swaps</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PairCard key={p.slug} pair={p} />
            ))}
          </div>
        </section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </article>
  );
}

/** Things you buy once (chargers, pans, tools), where a monthly saving makes no sense. */
function isDurable(pair: Pair) {
  return pair.category === "tech-tools" && !/filter|batter|bulb|cartridge|refill/i.test(pair.brand.unit);
}

/** A sensible starting point for the calculator: about one brand pack a month, capped. */
function defaultMonthly(pair: Pair) {
  const size = pair.brand.size;
  if (size <= 120) return size;
  return Math.round(size / 4);
}

function ProductPanel({ side, pair, product }: { side: "brand" | "alternative"; pair: Pair; product: ProductSide }) {
  const isAlt = side === "alternative";
  const credit = photoCredit(product.image);
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 shadow-[var(--shadow)] ${
        isAlt ? "border-accent/40 bg-tint ring-1 ring-accent/20" : "border-line bg-white"
      }`}
    >
      <ProductThumb image={product.image} brand={product.brand} category={pair.category} unit={product.unit} size="lg" />
      {credit && <p className="mt-1.5 text-[11px] text-muted">{credit}</p>}
      <p className={`mt-4 text-xs font-semibold tracking-wide uppercase ${isAlt ? "text-accent" : "text-brand-tone"}`}>
        {isAlt ? "The cheaper one" : "The brand name"}
      </p>
      <h2 className="mt-1.5 text-xl font-semibold">{product.brand}</h2>
      <p className="mt-1 text-sm text-ink-2">{product.product}</p>
      {(product.rating || product.license_id) && (
        <div className="num mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          {product.rating && (
            <a
              href={product.rating.source}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 hover:text-ink"
            >
              <Star className="h-3.5 w-3.5 fill-highlight text-highlight-ink" aria-hidden="true" />
              <span className="font-semibold text-ink">{product.rating.stars.toFixed(1)}</span>
              <span>({product.rating.count.toLocaleString("en-US")} reviews at {hostname(product.rating.source)})</span>
            </a>
          )}
          {product.license_id && <span>Licence {product.license_id}</span>}
        </div>
      )}
      <dl className="num mt-5 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Pack</dt>
          <dd className="font-medium">{formatSize(product.size, product.unit)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Price</dt>
          <dd className="font-medium">{money(product.price, pair.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Per {product.unit}</dt>
          <dd className={`font-semibold ${isAlt ? "text-accent" : ""}`}>{ppu(product.ppu, pair.currency)}</dd>
        </div>
      </dl>
      <div className="mt-auto pt-5">
        <a
          href={`/go/${pair.slug}/${side}`}
          target="_blank"
          rel="sponsored nofollow noopener"
          className={`btn w-full ${isAlt ? "btn-primary" : "btn-ghost"}`}
        >
          {isAlt ? "Check price" : "Brand price"} {atStore(product.retailer)}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

/** The licence number both packs share, when they're the same licensed medicine (e.g. one UK PL number). */
function sameLicenceNumber(pair: Pair) {
  const b = pair.brand.license_id?.replace(/\s+/g, " ").trim().toUpperCase();
  const a = pair.alternative.license_id?.replace(/\s+/g, " ").trim().toUpperCase();
  return b && a && b === a ? b : null;
}

const OPEN_FACTS: Record<string, string> = {
  openfoodfacts: "Open Food Facts",
  openbeautyfacts: "Open Beauty Facts",
  openpetfoodfacts: "Open Pet Food Facts",
  openproductsfacts: "Open Products Facts",
};

/** Open Facts photos are CC BY-SA, so we credit them under the picture. */
function photoCredit(image?: string | null) {
  if (!image) return null;
  const host = hostname(image);
  const key = Object.keys(OPEN_FACTS).find((k) => host.includes(k));
  return key ? `Photo: ${OPEN_FACTS[key]} contributors, CC BY-SA` : null;
}

function hostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
function pathOf(u: string) {
  try {
    const p = new URL(u).pathname;
    return p.length > 1 ? p : "";
  } catch {
    return "";
  }
}
