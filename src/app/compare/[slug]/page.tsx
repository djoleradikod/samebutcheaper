import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { BulkBox, buysOnce, packText } from "@/components/BulkBox";
import { HEALTH_CATEGORIES, HealthNotice, hostname, PhotoCaption, PhotoCredits, SourceList } from "@/components/Evidence";
import { MarketTag } from "@/components/MarketTag";
import { PairCard } from "@/components/PairCard";
import { ProductThumb } from "@/components/ProductThumb";
import { SameOrDifferent } from "@/components/SameOrDifferent";
import { SaveButton } from "@/components/SaveButton";
import { PctTicket } from "@/components/Ticket";
import { WhereToBuy } from "@/components/WhereToBuy";
import { BrandWins, WhyBlock } from "@/components/WhyBlock";
import { atStore, mayEarn, RETAILER_LABEL, tagUrl } from "@/lib/affiliate";
import { brandSlugFor, getAllPairs, getBrand, getPair, getRelatedPairs, ingredientSlugFor, toSummary } from "@/lib/catalog";
import { CATEGORY_MAP, MATCH_TYPE_META } from "@/lib/categories";
import { comparison, differencePoints, drawbacks, type CompareRow } from "@/lib/compare";
import { dupeSlugFor } from "@/lib/dupes";
import { inSentence, money, monthYear } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { Pair, ProductSide } from "@/lib/types";
import { unitDisplay, unitPrice } from "@/lib/unit-format";

export function generateStaticParams() {
  const params = getAllPairs().map((p) => ({ slug: p.slug }));
  // Cache Components needs at least one param to check the route. This one renders the 404.
  return params.length ? params : [{ slug: "__no-swaps__" }];
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) return { title: "Swap not found" };
  const { label } = unitDisplay(pair.brand.unit);
  const title = `${pair.brand.brand} vs ${pair.alternative.brand}: ${Math.round(pair.savingsPct)}% cheaper`;
  const description = `${pair.summary} ${unitPrice(pair.alternative.ppu, pair.brand.unit, pair.currency)} vs ${unitPrice(pair.brand.ppu, pair.brand.unit, pair.currency)} ${label}.`;
  return {
    title,
    description,
    alternates: { canonical: `/compare/${pair.slug}` },
    openGraph: { title, description, url: `/compare/${pair.slug}`, type: "article" },
  };
}

const BAND = "border-y border-line bg-canvas";
const WHERE_TO_BUY = "where-to-buy";
const WHAT_DIFFERS = "what-differs";

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params;
  const pair = getPair(slug);
  if (!pair) notFound();

  const { brand: b, alternative: a, currency } = pair;
  const cat = CATEGORY_MAP[pair.category];
  const health = HEALTH_CATEGORIES.has(pair.category);
  const related = getRelatedPairs(pair, 4).map(toSummary);
  const brandCount = getBrand(brandSlugFor(b.brand))?.pairs.length ?? 0;
  const compared = comparison(pair, ingredientSlugFor);
  const rows = readableRows(compared.rows, pair);
  const wins = [...compared.ingredients, ...rows].filter((r) => r.verdict === "brand_better");
  const points = pair.differences ? differencePoints(pair.differences) : [];
  const sameLicence = sameLicenceNumber(pair);
  const against = wins.length > 0 ? `the brand wins on ${listWords(wins.map((r) => inSentence(r.aspect)))}.` : drawbacks(points)[0];

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
    ...[a, b].map((p) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.product,
      brand: { "@type": "Brand", name: p.brand },
      ...(p.photo ? { image: `${SITE.url}${p.photo.src}-480.webp` } : {}),
      offers: {
        "@type": "Offer",
        price: p.price.toFixed(2),
        priceCurrency: currency,
        url: p.url,
      },
    })),
  ];

  return (
    <article>
      <div className="container-page pt-1 pb-8 md:pt-4 md:pb-10">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-1 text-[13px] text-muted">
            <li>
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li>
              <Link href={`/category/${cat.slug}`} className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
                {cat.name}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li className="text-ink-2">{pair.subcategory}</li>
          </ol>
        </nav>

        <h1 className="display text-[28px] break-words md:mt-1.5 md:text-[40px]">
          {b.brand} vs {a.brand}
        </h1>

        <div className="mt-4 grid gap-x-10 gap-y-5 md:mt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Shelf pair={pair} />

          <div className="min-w-0">
            <p className="text-[22px] leading-[1.2] font-semibold tracking-[-0.01em] md:text-[28px]">{verdict(pair)}</p>

            <Offers pair={pair} />

            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5">
              <MatchBadge type={pair.match_type} long />
              <ConfidenceBadge confidence={pair.confidence} />
              {sameLicence && (
                <span className="text-[13px] font-medium text-same">Same licensed medicine, {sameLicence}</span>
              )}
            </p>
            <SaveButton slug={pair.slug} className="mt-3 sm:w-56" />
            <p className="mt-3 text-[15px] text-ink-2">{sameAmount(pair)}</p>
            <p className="mt-1.5 text-[15px] text-ink-2">
              {against && (
                <>
                  <span className="font-semibold text-brand-better">Against it: </span>
                  {against}{" "}
                </>
              )}
              <a
                href={`#${WHAT_DIFFERS}`}
                className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0"
              >
                What differs
              </a>
            </p>

            <p className="mt-2 text-[13px] text-muted">
              {disclosure(pair)}{" "}
              <Link href="/disclosure" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                Details
              </Link>
            </p>
          </div>
        </div>

        {health && <HealthNotice className="mt-5 max-w-4xl" />}
      </div>

      <WhyBlock pair={pair} className={BAND} />

      <BrandWins id={WHAT_DIFFERS} brandName={b.brand} altName={a.brand} points={points} wins={wins} className="border-t-0" />

      <div className="container-page py-8 md:py-10">
        <SameOrDifferent
          comparison={{ ...compared, rows }}
          brandName={b.brand}
          altName={a.brand}
          intro={`${MATCH_TYPE_META[pair.match_type].description} Every point we checked, including where the brand is better.`}
        />
      </div>

      <BulkBox pair={pair} className={BAND} />

      <section id={WHERE_TO_BUY} aria-labelledby={`${WHERE_TO_BUY}-title`} className="container-page scroll-mt-16 py-8 md:py-10">
        <h2 id={`${WHERE_TO_BUY}-title`} className="display text-[22px] md:text-2xl">
          Buying where you live
        </h2>
        <div className="mt-3">
          <WhereToBuy
            slug={pair.slug}
            market={pair.market}
            retailer={a.retailer}
            retailerLabel={a.retailer === "other" ? "This store" : (RETAILER_LABEL[a.retailer] ?? "This store")}
            lookFor={pair.lookFor}
            health={health}
            compareWith={fullName(b)}
          />
        </div>
      </section>

      <div className="container-page grid gap-x-10 gap-y-8 pb-8 md:pb-10 lg:grid-cols-2">
        <SourceList sources={pair.sources} />
        <PhotoCredits
          items={[a, b].map((p) => ({
            name: fullName(p),
            brand: p.brand,
            photo: p.photo,
            category: pair.category,
            unit: p.unit,
          }))}
        />
      </div>

      <section aria-labelledby={related.length > 0 ? "related" : undefined} className={BAND}>
        <div className="container-page py-8 md:py-10">
          {related.length > 0 && (
            <>
              <h2 id="related" className="display text-[22px] md:text-2xl">
                More {inSentence(cat.name)} swaps
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
                {related.map((p) => (
                  <PairCard key={p.slug} pair={p} />
                ))}
              </div>
            </>
          )}
          <p className={`flex flex-wrap gap-x-6 text-sm font-medium ${related.length > 0 ? "mt-3" : ""}`}>
            <Link href={`/dupe/${dupeSlugFor(pair)}`} className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2">
              All cheaper matches for {b.brand}
            </Link>
            {brandCount > 1 && (
              <Link
                href={`/brand/${brandSlugFor(b.brand)}`}
                className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2"
              >
                {brandCount} {b.brand} products with cheaper matches
              </Link>
            )}
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </article>
  );
}

/**
 * The answer: both packs standing on a shelf rail, the ticket on the rail between them, and a
 * shelf label under each. The columns share rows so the prices line up whatever the names do.
 */
function Shelf({ pair }: { pair: Pair }) {
  return (
    <div className="grid min-w-0 grid-cols-2 grid-rows-[repeat(5,auto)] gap-x-2 self-start sm:gap-x-4 md:max-w-lg lg:max-w-none">
      <ShelfColumn pair={pair} product={pair.brand} side="brand" />
      <ShelfColumn pair={pair} product={pair.alternative} side="alternative" />
      <div aria-hidden="true" className="col-span-2 col-start-1 row-start-1 h-[3px] self-end bg-ink" />
      <div className="z-10 col-span-2 col-start-1 row-start-1 translate-y-1/2 self-end justify-self-center">
        <PctTicket
          pct={pair.savingsPct}
          size="lg"
          className="md:px-3.5 md:py-2.5 md:pl-[26px] md:text-[2.25rem] md:[--hole-r:5px] md:[--hole-x:12px]"
        />
      </div>
    </div>
  );
}

function ShelfColumn({ pair, product: p, side }: { pair: Pair; product: ProductSide; side: "brand" | "alternative" }) {
  const cheaper = side === "alternative";
  const { label } = unitDisplay(p.unit);
  return (
    <div className="row-span-5 grid min-w-0 grid-rows-subgrid">
      <div className="mx-auto w-full max-w-36 pb-2.5 md:max-w-none">
        <ProductThumb
          size="tile"
          image={p.photo?.src ?? null}
          brand={p.brand}
          alt={fullName(p)}
          category={pair.category}
          unit={p.unit}
          eager
          sizes="(min-width: 768px) 260px, 144px"
        />
      </div>
      <p className="min-w-0 pt-8 md:pt-9">
        <span className="block text-[13px] font-medium text-muted">{cheaper ? "The cheaper one" : "The brand"}</span>
        <span className="block text-[15px] leading-tight font-bold break-words md:text-lg">{p.brand}</span>
      </p>
      <p
        className={`price mt-1.5 self-end ${cheaper ? "text-[2rem] text-ink min-[360px]:text-[2.5rem] md:text-[3.5rem] lg:text-[2.75rem]" : "text-[1.75rem] text-ink-2 min-[360px]:text-[2rem] md:text-[2.75rem] lg:text-[2.25rem]"}`}
      >
        {money(p.price, pair.currency)}
      </p>
      <div className="mt-1.5 hidden min-w-0 md:block">
        <p className="text-sm font-medium text-ink-2">{packText(p.size, p.unit)}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
          <span className={`price text-xl md:text-2xl ${cheaper ? "text-ink" : "text-ink-2"}`}>
            {unitPrice(p.ppu, p.unit, pair.currency)}
          </span>
          <span className="text-[13px] leading-tight font-medium text-muted">{label}</span>
        </p>
      </div>
      <div className="mt-1 min-w-0 md:mt-2">
        <PhotoCaption photo={p.photo} />
      </div>
    </div>
  );
}

type Offer = {
  name: string;
  note?: string;
  store: string;
  price: number;
  size: number;
  ppu: number;
  href: string;
  buttonLabel: string;
  primary: boolean;
};

/** The columns once there's room for them. Under that, each offer stacks and nothing scrolls sideways. */
const OFFER_COLUMNS = "@2xl:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem_6.5rem_6.5rem]";

function storeName(retailer: string, url: string) {
  return retailer === "other" ? hostname(url) : (RETAILER_LABEL[retailer] ?? hostname(url));
}

function offersFor(pair: Pair): Offer[] {
  const { brand: b, alternative: a, bulkView } = pair;
  const side = (p: ProductSide, which: "brand" | "alternative"): Offer => ({
    name: fullName(p),
    store: storeName(p.retailer, p.url),
    price: p.price,
    size: p.size,
    ppu: p.ppu,
    href: `/go/${pair.slug}/${which}`,
    buttonLabel: seeLabel(p),
    primary: which === "alternative",
  });
  const offers = [side(a, "alternative"), side(b, "brand")];
  const big = bulkView.bigger;
  if (big) {
    offers.push({
      name: big.product,
      note: "The bigger pack",
      store: storeName(big.retailer, big.url),
      price: big.price,
      size: big.size,
      ppu: big.ppu,
      href: tagUrl(big.url),
      buttonLabel: big.retailer === "other" ? "See it online" : `See it ${atStore(big.retailer)}`,
      primary: false,
    });
  }
  return offers;
}

/** The offer list: every price with its store, pack, unit price and date, on the first screen. */
function Offers({ pair }: { pair: Pair }) {
  const unit = pair.alternative.unit;
  const { label } = unitDisplay(unit);
  const checked = monthYear(pair.price_checked);
  return (
    <div className="@container mt-3">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pb-2">
        {pair.priceOld ? (
          <span className="text-[15px] font-semibold text-different">
            Prices from {checked}, over a year old. Check before you buy.
          </span>
        ) : (
          <span className="text-[15px] font-medium text-ink-2">Prices checked {checked}.</span>
        )}
        <MarketTag market={pair.market} whereToBuy={WHERE_TO_BUY} />
      </p>
      <div role="table" aria-label="Prices and stores" className="divide-y divide-line border-y border-line-strong">
        <div role="row" className={`hidden gap-x-3 py-1.5 text-[13px] font-medium text-muted @2xl:grid ${OFFER_COLUMNS}`}>
          <span role="columnheader">Product</span>
          <span role="columnheader">Store</span>
          <span role="columnheader">Price</span>
          <span role="columnheader">Pack</span>
          <span role="columnheader">Unit price</span>
          <span role="columnheader" className="sr-only">
            Link
          </span>
        </div>
        {offersFor(pair).map((o) => (
          <div
            key={o.name}
            role="row"
            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 @md:grid-cols-[minmax(0,1fr)_auto_7rem] @2xl:items-center ${OFFER_COLUMNS}`}
          >
            <p role="cell" className="col-start-1 row-start-1 min-w-0 text-sm leading-snug break-words">
              <span className={o.primary ? "font-semibold" : "font-medium text-ink-2"}>{o.name}</span>
              {o.note && <span className="block text-[13px] text-muted">{o.note}</span>}
            </p>
            <p
              role="cell"
              className="col-start-1 row-start-2 min-w-0 text-[13px] font-medium break-words text-ink-2 @2xl:col-start-2 @2xl:row-start-1"
            >
              {o.store}
            </p>
            <p
              role="cell"
              className={`price col-start-2 row-span-2 row-start-1 text-right text-[1.375rem] @2xl:col-start-3 @2xl:row-span-1 @2xl:text-left ${o.primary ? "text-ink" : "text-ink-2"}`}
            >
              {money(o.price, pair.currency)}
            </p>
            <div className="col-span-2 col-start-1 row-start-3 flex flex-wrap items-baseline gap-x-2 @md:col-span-1 @2xl:contents">
              <p role="cell" className="text-[13px] font-medium text-ink-2 @2xl:col-start-4 @2xl:row-start-1">
                {packText(o.size, unit)}
              </p>
              <p role="cell" className="text-[13px] leading-tight font-medium text-muted @2xl:col-start-5 @2xl:row-start-1">
                <span className="price text-[15px] text-ink">{unitPrice(o.ppu, unit, pair.currency)}</span> {label}
              </p>
            </div>
            <div
              role="cell"
              className="col-span-2 col-start-1 row-start-4 mt-1 @md:col-span-1 @md:col-start-3 @md:row-span-3 @md:row-start-1 @md:mt-0 @md:self-center @2xl:col-start-6 @2xl:row-span-1"
            >
              <a
                href={o.href}
                target="_blank"
                rel="sponsored nofollow noopener"
                className={`btn w-full text-center ${o.primary ? "btn-primary" : "btn-ghost"}`}
              >
                <span className="@md:hidden">{o.buttonLabel}</span>
                <span className="hidden @md:inline">
                  See it<span className="sr-only">: {o.buttonLabel}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The one-sentence answer, in the words the match level allows. */
function verdict(pair: Pair) {
  const { brand: b, alternative: a } = pair;
  const { label } = unitDisplay(b.unit);
  const what = {
    identical_active: `has the same active ingredient as ${b.brand}`,
    identical_formula: `has the same formula as ${b.brand}`,
    same_manufacturer: `comes from the same manufacturer as ${b.brand}`,
    equivalent_spec: `does the same job as ${b.brand}`,
  }[pair.match_type];
  return `${a.brand} ${what} and costs ${Math.round(pair.savingsPct)}% less${label === "each" ? "" : ` ${label}`}.`;
}

/** What the saving comes to for the same amount, since packs are often different sizes. */
function sameAmount(pair: Pair) {
  const { brand: b, alternative: a, savingsPerPack: saved, currency } = pair;
  if (a.size === b.size) {
    // "Price per cell" is a unit of something you keep buying, whatever its size says.
    if (/\bper\b/i.test(a.product)) return `Each ${b.unit} costs ${money(saved, currency)} less.`;
    if (buysOnce(a.unit, a.size)) return `You buy it once, so you save ${money(saved, currency)} once.`;
    return `A pack this size costs ${money(saved, currency)} less.`;
  }
  // The cheaper pack is a different size, so this is its unit price times the brand's pack.
  const forSameAmount = (a.price / a.size) * b.size;
  return `For the same ${packText(b.size, b.unit)} you pay about ${money(forSameAmount, currency)} with ${a.brand} and ${money(b.price, currency)} with ${b.brand}.`;
}

function disclosure(pair: Pair) {
  const earning = [pair.alternative, pair.brand].filter((p) => mayEarn(p));
  if (earning.length === 0) return "We don't earn anything from these links.";
  if (earning.length === 2) return "Affiliate links. We may earn a commission at no cost to you.";
  return `The ${RETAILER_LABEL[earning[0].retailer]} link is an affiliate link. We may earn a commission at no cost to you.`;
}

function listWords(words: string[]) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What the store button says. A brand's own shop reads "See it at Apple". */
function seeLabel(p: ProductSide) {
  if (p.retailer === "other") return `See ${p.brand} online`;
  const store = RETAILER_LABEL[p.retailer];
  if (store?.toLowerCase() === p.brand.toLowerCase()) return `See it at ${store}`;
  return `See ${p.brand} ${atStore(p.retailer)}`;
}

function fullName(p: ProductSide) {
  // "Bramwells (Aldi)" and "Aldi Bramwells Beans, 410g" already name the brand once.
  const brand = p.brand.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  return p.product.toLowerCase().includes(brand) ? p.product : `${p.brand} ${p.product}`;
}

/** Puts the generated pack and price rows in the same words as the shelf label. Researched rows stay as written. */
function readableRows(rows: CompareRow[], pair: Pair): CompareRow[] {
  const { brand: b, alternative: a, currency } = pair;
  const researched = new Set((pair.aspects ?? []).map((r) => r.aspect));
  return rows.map((r) => {
    if (researched.has(r.aspect)) return r;
    if (r.aspect === "Pack") return { ...r, brand: packText(b.size, b.unit), alternative: packText(a.size, a.unit) };
    if (r.aspect === `Price per ${b.unit}`) {
      return {
        ...r,
        aspect: `Price ${unitDisplay(b.unit).label}`,
        brand: unitPrice(b.ppu, b.unit, currency),
        alternative: `${unitPrice(a.ppu, a.unit, currency)} (${Math.round(pair.savingsPct)}% less)`,
      };
    }
    return r;
  });
}

/** The licence number both packs share, when they're the same licensed medicine (e.g. one UK PL number). */
function sameLicenceNumber(pair: Pair) {
  const b = pair.brand.license_id?.replace(/\s+/g, " ").trim().toUpperCase();
  const a = pair.alternative.license_id?.replace(/\s+/g, " ").trim().toUpperCase();
  return b && a && b === a ? b : null;
}
