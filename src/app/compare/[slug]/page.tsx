import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { BulkBox, buysOnce, packText } from "@/components/BulkBox";
import { HEALTH_CATEGORIES, HealthNotice, PhotoCredits, PhotoLine, SourceList } from "@/components/Evidence";
import { MarketTag } from "@/components/MarketTag";
import { PairCard } from "@/components/PairCard";
import { ProductThumb } from "@/components/ProductThumb";
import { SameOrDifferent } from "@/components/SameOrDifferent";
import { SaveButton } from "@/components/SaveButton";
import { PctTicket } from "@/components/Ticket";
import { StickyBuy } from "@/components/StickyBuy";
import { ShareButton } from "@/components/ShareButton";
import { WhereToBuy } from "@/components/WhereToBuy";
import { BrandWins, WhyBlock } from "@/components/WhyBlock";
import { atStore, linkStoreName, linksEarn, mayEarn, RETAILER_LABEL, storeName } from "@/lib/affiliate";
import { brandSlugFor, getAllPairs, getBrand, getPair, getRelatedPairs, ingredientSlugFor, toSummary } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { comparison, drawbacks, onFileIntro, sortDifferences, type CompareRow } from "@/lib/compare";
import { dupeSlugFor } from "@/lib/dupes";
import { storeOrder } from "@/lib/delivery";
import { sellerOf } from "@/lib/sellers";
import { inSentence, monthYear } from "@/lib/format";
import { jsonLdText, SITE } from "@/lib/site";
import type { Pair, ProductSide } from "@/lib/types";
import { unitDisplay, unitPrice } from "@/lib/unit-format";
import { forCountry, localClaim, localText, MARKET_ADJECTIVE, type Local } from "@/lib/localize";
import { NotListedHere, SameSwapHere } from "@/components/ShelfParts";
import { CountryPart } from "@/components/ForCountry";
import { Money, UnitAmount, OriginalPrice } from "@/components/Money";
import { YearlyBlock } from "@/components/YearlyBlock";

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
  const record = getPair(slug);
  if (!record) notFound();
  const cat = CATEGORY_MAP[record.category];
  return (
    <article>
      <CountryPart fallback={null}>
        {(local) => {
          if (local.shows(record)) return null;
          const twin = record.twin ? getPair(record.twin.slug) : undefined;
          return twin && local.shows(twin) ? <SameSwapHere market={record.market} twin={twin} /> : <NotListedHere market={record.market} local={local} />;
        }}
      </CountryPart>
      <div className="container-page pt-1 md:pt-4">
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
            <li className="text-ink-2">{record.subcategory}</li>
          </ol>
        </nav>

        <h1 className="display text-[28px] break-words md:mt-1.5 md:text-[40px]">
          {record.brand.brand} vs {record.alternative.brand}
        </h1>
      </div>
      <CountryPart>{(local) => <CompareBody record={record} local={local} />}</CountryPart>
    </article>
  );
}

function CompareBody({ record, local }: { record: Pair; local: Local }) {
  // What the page reads out. comparison() below reads the catalogue's own wording.
  const pair = { ...localText(record, local), evidence_claims: record.evidence_claims.map((c) => localClaim(c, local)) };
  const { brand: b, alternative: a, currency } = pair;
  const cat = CATEGORY_MAP[pair.category];
  const health = HEALTH_CATEGORIES.has(pair.category);
  const related = forCountry(getRelatedPairs(record, 24), local).slice(0, 4).map(toSummary);
  const brandCount = forCountry(getBrand(brandSlugFor(b.brand))?.pairs ?? [], local).length;
  const compared = comparison(record, ingredientSlugFor);
  const rows = readableRows(compared.rows, pair, local);
  const wins = [...compared.ingredients, ...rows].filter((r) => r.verdict === "brand_better");
  const { points, caveats } = sortDifferences(pair.differences);
  const sameLicence = sameLicenceNumber(pair);
  // A test's name is a proper name, so it keeps its capitals.
  const winNames = wins.map((r) => (r.kind === "test" ? r.aspect : inSentence(r.aspect)));
  const against = wins.length > 0 ? `the brand wins on ${listWords(winNames)}.` : drawbacks(points)[0];
  const hasDifferences = wins.length + points.length > 0;
  // Spec names can carry a price too ("about 80p a wash in the test").
  const speak = (r: CompareRow): CompareRow => ({ ...r, aspect: local.prose(r.aspect, currency), brand: local.prose(r.brand, currency), alternative: local.prose(r.alternative, currency) });
  const fullComparison = { ...compared, ingredients: compared.ingredients.map(speak), rows };
  const sources = [...new Set([...pair.sources, ...(compared.nutrition?.records.map((r) => r.page) ?? [])])];

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
    <>
      <div className="container-page pb-8 md:pb-10">
        <div className="mt-4 grid gap-x-10 gap-y-5 md:mt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Shelf pair={pair} />

          <div className="min-w-0">
            <p className="text-[22px] leading-[1.2] font-semibold tracking-[-0.01em] md:text-[28px]">{verdict(pair)}</p>

            <div id={OFFERS} className="scroll-mt-16">
              <Offers pair={pair} local={local} />
            </div>
            <YearlyBlock pair={pair} />

            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5">
              <MatchBadge type={pair.match_type} long />
              {pair.match_type !== "same_kind" && <ConfidenceBadge confidence={pair.confidence} />}
              {sameLicence && (
                <span className="text-[13px] font-medium text-same">Same licensed medicine, {sameLicence}</span>
              )}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <SaveButton slug={pair.slug} className="sm:w-56" />
              <ShareButton
                path={`/compare/${pair.slug}`}
                text={`${a.brand} does the same job as ${b.brand} for ${Math.round(pair.savingsPct)}% less.`}
                className="sm:w-56"
              />
            </div>
            <p className="mt-3 text-[15px] text-ink-2">{sameAmount(pair, local)}</p>
            {hasDifferences && (
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
            )}

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

      <WhyBlock pair={pair} tests={rows.filter((r) => r.kind === "test")} caveats={caveats} className={BAND} />

      <BrandWins id={WHAT_DIFFERS} brandName={b.brand} altName={a.brand} points={points} wins={wins} className="border-t-0" />

      <div className="container-page py-8 md:py-10">
        <SameOrDifferent comparison={fullComparison} brandName={b.brand} altName={a.brand} intro={onFileIntro(fullComparison)} />
      </div>

      <BulkBox pair={pair} local={local} className={BAND} />

      <section id={WHERE_TO_BUY} aria-labelledby={`${WHERE_TO_BUY}-title`} className="container-page scroll-mt-16 py-8 md:py-10">
        <h2 id={`${WHERE_TO_BUY}-title`} className="display text-[22px] md:text-2xl">
          Buying where you live
        </h2>
        <div className="mt-3">
          <WhereToBuy
            slug={pair.slug}
            market={pair.market}
            retailer={a.retailer}
            aisle={pair.category}
            retailerLabel={a.retailer === "other" ? "This store" : (RETAILER_LABEL[a.retailer] ?? "This store")}
            lookFor={pair.lookFor}
            health={health}
            compareWith={fullName(b)}
          />
        </div>
      </section>

      <div className="container-page grid gap-x-10 gap-y-8 pb-8 md:pb-10 lg:grid-cols-2">
        <SourceList sources={sources} />
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

      {local.sells(a.retailer, pair.market) && (
        <StickyBuy watch={OFFERS}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink-2">
                {a.brand}
                {mayEarn(a, pair.market) && adLabel(pair.market) && <span className="ml-2 text-[11px] text-muted">{adLabel(pair.market)}</span>}
              </p>
              <p className="flex items-center gap-2">
                <span className="price text-xl">
                  <Money n={a.price} from={pair.currency} />
                </span>
                <PctTicket pct={pair.savingsPct} size="sm" />
              </p>
            </div>
            <a href={`/go/${pair.slug}/alternative`} target="_blank" rel="sponsored nofollow noopener" className="btn btn-primary shrink-0">
              {a.retailer === "other" ? "See it online" : `See it ${atStore(a.retailer, a.url)}`}
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </StickyBuy>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }}
      />
    </>
  );
}

/**
 * The answer: both packs standing on a shelf rail, the ticket on the rail between them, and a
 * shelf label under each. The columns share rows so the prices line up whatever the names do.
 */
function Shelf({ pair }: { pair: Pair }) {
  return (
    <div className="grid min-w-0 grid-cols-2 grid-rows-[repeat(4,auto)] gap-x-2 self-start sm:gap-x-4 md:max-w-lg lg:max-w-none">
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
      <PhotoLine
        className="col-span-2 mt-2"
        items={[pair.brand, pair.alternative].map((p) => ({ name: p.brand, photo: p.photo }))}
      />
    </div>
  );
}

function ShelfColumn({ pair, product: p, side }: { pair: Pair; product: ProductSide; side: "brand" | "alternative" }) {
  const cheaper = side === "alternative";
  const { label } = unitDisplay(p.unit);
  return (
    <div className="row-span-4 grid min-w-0 grid-rows-subgrid">
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
        <Money n={p.price} from={pair.currency} />
        <OriginalPrice n={p.price} from={pair.currency} market={pair.market} checked={pair.price_checked} className="mt-1 font-sans" />
      </p>
      <div className="mt-1.5 hidden min-w-0 md:block">
        <p className="text-sm font-medium text-ink-2">{packText(p.size, p.unit)}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
          <span className={`price text-xl md:text-2xl ${cheaper ? "text-ink" : "text-ink-2"}`}>
            <UnitAmount ppu={p.ppu} unit={p.unit} from={pair.currency} />
          </span>
          <span className="text-[13px] leading-tight font-medium text-muted">{label}</span>
        </p>
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
  /** Null when that store doesn't sell in the selected country: we neither name it nor link to it. */
  href: string | null;
  buttonLabel: string;
  primary: boolean;
  /** Set when the link earns us a commission in a market whose rules want the link itself marked as an ad. */
  ad?: string;
};

/** The columns once there's room for them. Under that, each offer stacks and nothing scrolls sideways. */
const OFFERS = "prices";
const OFFER_COLUMNS = "@2xl:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5rem_6.5rem_6.5rem]";

function offersFor(pair: Pair, local: Local): Offer[] {
  const { brand: b, alternative: a, bulkView } = pair;
  const sells = (retailer: string) => local.sells(retailer, pair.market);
  const elsewhere = `A ${MARKET_ADJECTIVE[pair.market]} store`;
  // A cheap pack on its own can fall under a store's free-delivery line, which a shopper should know before the click.
  const deliveryNote = (p: ProductSide) => {
    if (!sells(p.retailer)) return undefined;
    const order = storeOrder(sellerOf(p), pair.market, p.price);
    if (!order.delivery || order.freeOver === null) return undefined;
    const fee = local.money(order.delivery, pair.currency);
    const over = local.money(order.freeOver, pair.currency);
    return `Delivery ${fee} on its own, free over ${over}${order.pickup ? ", or free store pickup" : ""}`;
  };
  const side = (p: ProductSide, which: "brand" | "alternative"): Offer => ({
    name: fullName(p),
    note: deliveryNote(p),
    store: sells(p.retailer) ? storeName(p.retailer, p.url) : elsewhere,
    price: p.price,
    size: p.size,
    ppu: p.ppu,
    href: sells(p.retailer) ? `/go/${pair.slug}/${which}` : null,
    buttonLabel: seeLabel(p),
    primary: which === "alternative",
    ad: mayEarn(p, pair.market) ? adLabel(pair.market) : undefined,
  });
  const offers = [side(a, "alternative"), side(b, "brand")];
  const big = bulkView.bigger;
  if (big) {
    offers.push({
      name: big.product,
      note: "The bigger pack",
      store: sells(big.retailer) ? storeName(big.retailer, big.url) : elsewhere,
      price: big.price,
      size: big.size,
      ppu: big.ppu,
      href: sells(big.retailer) ? `/go/${pair.slug}/bigger` : null,
      buttonLabel: big.retailer === "other" ? "See it online" : `See it ${atStore(big.retailer)}`,
      primary: false,
      ad: mayEarn({ retailer: big.retailer as ProductSide["retailer"], url: big.url }, pair.market) ? adLabel(pair.market) : undefined,
    });
  }
  return offers;
}

/** The offer list: every price with its store, pack, unit price and date, on the first screen. */
function Offers({ pair, local }: { pair: Pair; local: Local }) {
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
        {offersFor(pair, local).map((o) => (
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
              <Money n={o.price} from={pair.currency} />
              <OriginalPrice n={o.price} from={pair.currency} market={pair.market} checked={pair.price_checked} className="mt-1 font-sans" />
            </p>
            <div className="col-span-2 col-start-1 row-start-3 flex flex-wrap items-baseline gap-x-2 @md:col-span-1 @2xl:contents">
              <p role="cell" className="text-[13px] font-medium text-ink-2 @2xl:col-start-4 @2xl:row-start-1">
                {packText(o.size, unit)}
              </p>
              <p role="cell" className="text-[13px] leading-tight font-medium text-muted @2xl:col-start-5 @2xl:row-start-1">
                <span className="price text-[15px] text-ink"><UnitAmount ppu={o.ppu} unit={unit} from={pair.currency} /></span> {label}
              </p>
            </div>
            <div
              role="cell"
              className="col-span-2 col-start-1 row-start-4 mt-1 @md:col-span-1 @md:col-start-3 @md:row-span-3 @md:row-start-1 @md:mt-0 @md:self-center @2xl:col-start-6 @2xl:row-span-1"
            >
              {o.href ? (
                <>
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
                  {o.ad && <span className="mt-0.5 block text-center text-[11px] font-medium text-muted">{o.ad}</span>}
                </>
              ) : (
                <a href={`#${WHERE_TO_BUY}`} className="btn btn-ghost w-full text-center">
                  Where to buy
                </a>
              )}
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
    same_kind: `is the same kind of product as ${b.brand}`,
  }[pair.match_type];
  return `${a.brand} ${what} and costs ${Math.round(pair.savingsPct)}% less${label === "each" ? "" : ` ${label}`}.`;
}

/** What the saving comes to for the same amount, since packs are often different sizes. */
function sameAmount(pair: Pair, local: Local) {
  const { brand: b, alternative: a, savingsPerPack: saved, currency } = pair;
  if (a.size === b.size) {
    // "Price per cell" is a unit of something you keep buying, whatever its size says.
    if (/\bper\b/i.test(a.product)) return `Each ${b.unit} costs ${local.money(saved, currency)} less.`;
    if (buysOnce(a.unit, a.size)) return `You buy it once, so you save ${local.money(saved, currency)} once.`;
    return `A pack this size costs ${local.money(saved, currency)} less.`;
  }
  // The cheaper pack is a different size, so this is its unit price times the brand's pack.
  const forSameAmount = (a.price / a.size) * b.size;
  return `For the same ${packText(b.size, b.unit)} you pay about ${local.bare(forSameAmount, currency)} with ${a.brand} and ${local.money(b.price, currency)} with ${b.brand}.`;
}

/**
 * The word an earning link carries beside it, where a market's rules want the link itself marked: German law wants
 * "Anzeige" or "Werbung" at the link, and the UK and Irish ad codes want "Ad". The line under the prices says the rest.
 */
function adLabel(market: Pair["market"]) {
  return market === "DE" ? "Anzeige" : market === "GB" || market === "IE" ? "Ad" : undefined;
}

function disclosure(pair: Pair) {
  const earning = [pair.alternative, pair.brand].filter((p) => mayEarn(p, pair.market));
  // A store search or bigger pack further down can still carry a tag when these two don't.
  if (earning.length === 0) return linksEarn() ? "These two links don't earn us anything. A link further down this page may." : "We don't earn anything from these links.";
  if (earning.length === 2) return "Affiliate links. We may earn a commission at no cost to you.";
  return `The ${linkStoreName(earning[0])} link is an affiliate link. We may earn a commission at no cost to you.`;
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
function readableRows(rows: CompareRow[], pair: Pair, local: Local): CompareRow[] {
  const { brand: b, alternative: a, currency } = pair;
  const researched = new Set((pair.aspects ?? []).map((r) => r.aspect));
  return rows.map((r) => {
    if (researched.has(r.aspect)) return { ...r, brand: local.prose(r.brand, currency), alternative: local.prose(r.alternative, currency) };
    if (r.aspect === "Pack") return { ...r, brand: packText(b.size, b.unit), alternative: packText(a.size, a.unit) };
    if (r.aspect === `Price per ${b.unit}`) {
      return {
        ...r,
        aspect: `Price ${unitDisplay(b.unit).label}`,
        brand: local.unit(b.ppu, b.unit, currency),
        alternative: `${local.unit(a.ppu, a.unit, currency)} (${Math.round(pair.savingsPct)}% less)`,
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
