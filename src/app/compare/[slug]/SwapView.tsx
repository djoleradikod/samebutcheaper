/**
 * The swap page, for both of its URLs: /compare/<slug> (the view follows the shopper's cookie) and /<country>/compare/<slug>
 * (that country's view, see src/lib/country-url.ts).
 *
 * What's in the first HTML:
 * - Everything that reads the same in every country, rendered once and static: the title, the verdict, the match and
 *   evidence labels, why it's the same and where the brand wins (when the record's own text names no price), sources,
 *   photo credits, the questions, and the links on.
 * - Everything that names a price or a store, in a RecordPart: on /compare/<slug> the record's own view (its market's
 *   prices and stores, nothing converted) is in the static HTML and the shopper's view replaces it in the same place, so
 *   a crawler or a visitor with JavaScript off reads the whole argument and nothing jumps when the shopper's arrives. On a
 *   prefixed URL the country is known at build time, so its view is the static HTML and nothing is replaced.
 */
import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ChevronRight, ExternalLink } from "lucide-react";
import { swapDescription } from "@/lib/seo";
import { countryHead, pageVersionsFor, swapDescriptionFor, swapTitleFor } from "@/lib/seo-catalog";
import { VersionLinks } from "@/components/CountryIndex";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { BulkBox, buysOnce, packText } from "@/components/BulkBox";
import { HEALTH_CATEGORIES, HealthNotice, PhotoCredits, PhotoLine, SourceList } from "@/components/Evidence";
import { MarketTag } from "@/components/MarketTag";
import { PairCard } from "@/components/PairCard";
import { toCard } from "@/components/ShelfParts";
import { ProductThumb } from "@/components/ProductThumb";
import { SameOrDifferent } from "@/components/SameOrDifferent";
import { SaveButton } from "@/components/SaveButton";
import { PctTicket } from "@/components/Ticket";
import { StickyBuy } from "@/components/StickyBuy";
import { ShareButton } from "@/components/ShareButton";
import { WhereToBuy } from "@/components/WhereToBuy";
import { BrandWins, WhyBlock } from "@/components/WhyBlock";
import { atStore, mayEarn, RETAILER_LABEL, storeName } from "@/lib/affiliate";
import { swapDisclosure } from "@/lib/disclosure";
import { brandSlugFor, getBrand, getPair, getRelatedPairs, ingredientSlugFor, toSummary } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { comparison, drawbacks, onFileIntro, sortDifferences, type CompareRow } from "@/lib/compare";
import { PREFIXED_COUNTRIES, withCountry, type PrefixedCountry } from "@/lib/country-url";
import { dupeSlugFor } from "@/lib/dupes";
import { deliveryNote as deliveryNoteFor } from "@/lib/delivery-abroad";
import { sellerOf } from "@/lib/sellers";
import { inSentence } from "@/lib/format";
import { jsonLdText, SITE } from "@/lib/site";
import type { Pair, ProductSide } from "@/lib/types";
import { unitDisplay } from "@/lib/unit-format";
import { SwapQuestions } from "@/components/SwapQuestions";
import { getT, type Lang } from "@/lib/i18n";
import { langForCountry } from "@/lib/i18n/lang";
import { listWords as listWordsIn } from "@/lib/i18n/format";
import { unitWordsFor } from "@/lib/i18n/units";
import { productName } from "@/lib/i18n/product-name";
import { unitLabel } from "@/lib/unit-format";
import { comparisonDe, differencesDe, onFileIntroDe } from "@/lib/i18n/compare-de";
import { claimText, germanText, subcategoryName } from "@/lib/i18n/record";
import { forCountry, localClaim, localFor, localText, type Local } from "@/lib/localize";
import { NotListedHere, RecordNoteSlot, SameSwapHere } from "@/components/ShelfParts";
import { RecordFeedback, ReportedPriceNote } from "@/components/RecordFeedback";
import { RecordPart } from "@/components/ForCountry";
import { Money, UnitAmount, OriginalPrice } from "@/components/Money";
import { YearlyBlock } from "@/components/YearlyBlock";
import { PriceChecked } from "@/components/PriceChecked";

/** The swap's head for its unprefixed URL (country null) or one country's: title, description, and the rule in seo.ts. */
export function swapMetadata(slug: string, country: PrefixedCountry | null): Metadata {
  const pair = getPair(slug);
  const lang = langForCountry(country);
  if (!pair) return { title: getT(lang)("swap.notFound") };
  const title = swapTitleFor(pair.slug, lang) ?? pair.title;
  const description = swapDescriptionFor(pair.slug, lang) ?? swapDescription(pair, lang);
  const head = countryHead(`/compare/${pair.slug}`, country);
  const url = head?.alternates.canonical ?? withCountry(`/compare/${pair.slug}`, country);
  // The share image is made once per swap, at its unprefixed URL; the unprefixed page picks it up from its own folder.
  const images = country ? { images: [{ url: `/compare/${pair.slug}/opengraph-image`, width: 1200, height: 630 }] } : {};
  return { title, description, ...head, openGraph: { title, description, url, type: "article", ...images } };
}

const BAND = "border-y border-line bg-canvas";
const WHERE_TO_BUY = "where-to-buy";
const WHAT_DIFFERS = "what-differs";
/** The "Email me if this changes" form at the foot (RecordFeedbackForms). */
const WATCH = "watch";

/** Where the share button sends people: each country's indexable URL for this swap, else its canonical one. */
function shareVersions(record: Pair) {
  const v = pageVersionsFor(`/compare/${record.slug}`);
  const versions = Object.fromEntries(Object.entries(v?.languages ?? {}).map(([hl, href]) => [hl.split("-")[1], href]));
  return { versions, canonical: v?.xDefault ?? `/compare/${record.slug}` };
}

/** `country`: the URL's country on a prefixed page, null on /compare/<slug>. */
export function SwapView({ record, country }: { record: Pair; country: PrefixedCountry | null }) {
  const cat = CATEGORY_MAP[record.category];
  const lang = langForCountry(country);
  const t = getT(lang);
  const catName = t(`categories.${cat.slug}.name`);
  // The static parts: the URL's country's view, or the record's own one, which is what reads the same for everybody.
  const fixed = localFor(country, false, lang);
  const pairPath = withCountry(`/compare/${record.slug}`, country);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t("swap.home"), item: `${SITE.url}${withCountry("/", country)}` },
        { "@type": "ListItem", position: 2, name: catName, item: `${SITE.url}${withCountry(`/category/${cat.slug}`, country)}` },
        { "@type": "ListItem", position: 3, name: lang === "en" ? record.title : t("swap.title", record.brand.brand, record.alternative.brand), item: `${SITE.url}${pairPath}` },
      ],
    },
    // No Product or Offer markup: this page compares two products we don't sell, at prices that date. See docs/seo-audit.md.
  ];
  return (
    <article>
      <RecordPart own={false} standIn={<RecordNoteSlot record={record} />}>
        {(local) => {
          if (local.shows(record)) return null;
          const twin = record.twin ? getPair(record.twin.slug) : undefined;
          return twin && local.shows(twin) ? <SameSwapHere market={record.market} twin={twin} lang={local.lang} /> : <NotListedHere market={record.market} local={local} />;
        }}
      </RecordPart>
      <div className="container-page pt-1 md:pt-4">
        <nav aria-label={t("swap.breadcrumb")}>
          <ol className="flex flex-wrap items-center gap-x-1 text-[13px] text-muted">
            <li>
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
                {t("swap.home")}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li>
              <Link href={`/category/${cat.slug}`} className="inline-flex min-h-11 items-center hover:text-ink md:min-h-0">
                {catName}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3 w-3" />
            </li>
            <li className="text-ink-2">{subcategoryName(record.subcategory, lang)}</li>
          </ol>
        </nav>

        <h1 className="display text-[28px] break-words md:mt-1.5 md:text-[40px]">
          {t("swap.title", record.brand.brand, record.alternative.brand)}
        </h1>
      </div>
      <CompareBody record={record} fixed={fixed} />
      <SwapQuestions record={record} lang={lang} />
      <VersionLinks languages={pageVersionsFor(`/compare/${record.slug}`)?.languages ?? {}} current={pairPath} lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
    </article>
  );
}

/** What the page reads out for one shopper: the record's text with its prices in their currency. compare.ts reads the catalogue's own wording. */
function swapFor(record: Pair, local: Local) {
  const pair = { ...localText(record, local), evidence_claims: record.evidence_claims.map((c) => localClaim(c, local)) };
  const compared = comparison(record, ingredientSlugFor);
  const rows = readableRows(compared.rows, pair, local);
  const wins = [...compared.ingredients, ...rows].filter((r) => r.verdict === "brand_better");
  const { points, caveats } = sortDifferences(pair.differences);
  // A test's name is a proper name, so it keeps its capitals.
  const winNames = wins.map((r) => (r.kind === "test" ? r.aspect : inSentence(r.aspect)));
  const against = wins.length > 0 ? `the brand wins on ${listWords(winNames)}.` : drawbacks(points)[0];
  // Spec names can carry a price too ("about 80p a wash in the test").
  const speak = (r: CompareRow): CompareRow => ({
    ...r,
    aspect: local.prose(r.aspect, record.currency),
    brand: local.prose(r.brand, record.currency),
    alternative: local.prose(r.alternative, record.currency),
  });
  const fullComparison = { ...compared, ingredients: compared.ingredients.map(speak), rows };
  const tests = rows.filter((r) => r.kind === "test");
  if (local.lang === "en") return { pair, compared, rows, wins, points, caveats, against, fullComparison, tests, intro: onFileIntro(fullComparison), textLang: "en" as Lang };
  // A German page: the same findings, each in German where the record has German text (src/lib/i18n/compare-de.ts).
  const text = germanText(record, local);
  const t = getT("de");
  const table = comparisonDe(fullComparison, record, text);
  const winsDe = [...table.ingredients, ...table.rows].filter((r) => r.verdict === "brand_better");
  const firstDrawback = drawbacks(points)[0];
  const pairDe = {
    ...pair,
    ...(text ? { summary: text.summary, evidence: text.evidence, why: text.why, differences: text.differences.join(" ") } : {}),
    evidence_claims: pair.evidence_claims.map((c) => claimText(c, local)),
  };
  return {
    pair: pairDe,
    compared,
    rows: table.rows,
    wins: winsDe,
    points: differencesDe(points, record, text),
    caveats: differencesDe(caveats, record, text),
    against: wins.length > 0 ? t("swap.brandWinsOn", listWordsIn(winsDe.map((r) => r.aspect), "de")) : firstDrawback && differencesDe([firstDrawback], record, text)[0],
    fullComparison: table,
    // "Cost per wash in the test" is detail for the table, as WhyBlock reads the English.
    tests: table.rows.filter((r, i) => r.kind === "test" && !/\bin the test$/.test(rows[i].aspect)),
    intro: onFileIntroDe(fullComparison, table),
    textLang: (text ? "de" : "en") as Lang,
  };
}

/**
 * Whether the record's own text names a price anywhere the why-and-differs part shows it. Where it doesn't, that part
 * reads the same in every country and is rendered once, statically. Every currency we convert from has a market whose
 * currency differs, so a price anywhere shows up as a change in at least one of them.
 */
function whyNamesPrice(record: Pair) {
  const texts = (local: Local) => {
    const s = swapFor(record, local);
    return JSON.stringify([s.pair.summary, s.pair.evidence, s.pair.why, s.pair.evidence_claims, s.points, s.caveats, s.against, s.tests, s.wins]);
  };
  const own = texts(localFor(null));
  return PREFIXED_COUNTRIES.some((c) => texts(localFor(c)) !== own);
}

function CompareBody({ record, fixed }: { record: Pair; fixed: Local }) {
  const { brand: b, alternative: a } = record;
  const lang = fixed.lang;
  const t = getT(lang);
  const cat = CATEGORY_MAP[record.category];
  const health = HEALTH_CATEGORIES.has(record.category);
  const sameLicence = sameLicenceNumber(record);
  const compared = comparison(record, ingredientSlugFor);
  const sources = [...new Set([...record.sources, ...(compared.nutrition?.records.map((r) => r.page) ?? [])])];
  const why = (local: Local) => {
    const s = swapFor(record, local);
    return (
      <>
        <WhyBlock pair={s.pair} tests={s.tests} caveats={s.caveats} className={BAND} lang={local.lang} textLang={s.textLang} />
        <BrandWins id={WHAT_DIFFERS} brandName={b.brand} altName={a.brand} points={s.points} wins={s.wins} className="border-t-0" lang={local.lang} textLang={s.textLang} />
      </>
    );
  };

  return (
    <>
      <div className="container-page pb-8 md:pb-10">
        <div className="mt-4 grid gap-x-10 gap-y-5 md:mt-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <RecordPart>{(local) => <Shelf pair={record} lang={local.lang} />}</RecordPart>

          <div className="min-w-0">
            <p className="text-[22px] leading-[1.2] font-semibold tracking-[-0.01em] md:text-[28px]">{verdict(record, lang)}</p>

            <ReportedPriceNote record="pair" slug={record.slug} className="mt-3" lang={lang} />
            <div id={OFFERS} className="scroll-mt-16">
              <RecordPart>
                {(local) => (
                  <>
                    <Offers pair={record} local={local} />
                    <YearlyBlock pair={record} lang={local.lang} />
                  </>
                )}
              </RecordPart>
            </div>

            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5">
              <MatchBadge type={record.match_type} long lang={lang} />
              {record.match_type !== "same_kind" && <ConfidenceBadge confidence={record.confidence} lang={lang} />}
              {sameLicence && <span className="text-[13px] font-medium text-same">{t("swap.sameLicence", sameLicence)}</span>}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <SaveButton slug={record.slug} className="sm:w-56" />
              <ShareButton
                {...shareVersions(record)}
                text={t("swap.share", a.brand, b.brand, Math.round(record.savingsPct))}
                className="sm:w-56"
              />
              <a href={`#${WATCH}`} className="btn btn-ghost">
                {t("feedback.watchHeading")}
              </a>
            </div>
            <RecordPart>{(local) => <SameAmountAndAgainst record={record} local={local} />}</RecordPart>

            <p className="mt-2 text-[13px] text-muted">
              {disclosure(record, lang)}{" "}
              <Link href="/disclosure" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                {t("swap.details")}
              </Link>
            </p>
          </div>
        </div>

        {health && <HealthNotice className="mt-5 max-w-4xl" category={record.category} lang={lang} />}
      </div>

      {whyNamesPrice(record) ? <RecordPart>{why}</RecordPart> : why(fixed)}

      <div className="container-page py-8 md:py-10">
        <RecordPart>
          {(local) => {
            const s = swapFor(record, local);
            return <SameOrDifferent comparison={s.fullComparison} brandName={b.brand} altName={a.brand} intro={s.intro} lang={local.lang} />;
          }}
        </RecordPart>
      </div>

      <RecordPart>{(local) => <BulkBox pair={swapFor(record, local).pair} local={local} className={BAND} />}</RecordPart>

      <section id={WHERE_TO_BUY} aria-labelledby={`${WHERE_TO_BUY}-title`} className="container-page scroll-mt-16 py-8 md:py-10">
        <h2 id={`${WHERE_TO_BUY}-title`} className="display text-[22px] md:text-2xl">
          {t("swap.buyingWhereYouLive")}
        </h2>
        <div className="mt-3">
          <RecordPart>
            {() => (
              <WhereToBuy
                slug={record.slug}
                market={record.market}
                retailer={a.retailer}
                aisle={record.category}
                retailerLabel={a.retailer === "other" ? t("swap.thisStore") : (RETAILER_LABEL[a.retailer] ?? t("swap.thisStore"))}
                lookFor={record.lookFor}
                health={health}
                compareWith={fullName(b)}
              />
            )}
          </RecordPart>
        </div>
      </section>

      <div className="container-page grid gap-x-10 gap-y-8 pb-8 md:pb-10 lg:grid-cols-2">
        <SourceList sources={sources} lang={lang} />
        <PhotoCredits
          lang={lang}
          items={[a, b].map((p) => ({
            name: fullName(p),
            brand: p.brand,
            photo: p.photo,
            category: record.category,
            unit: p.unit,
          }))}
        />
      </div>
      <RecordFeedback record="pair" slug={record.slug} />

      <RecordPart>{(local) => <Related record={record} local={local} cat={cat} />}</RecordPart>

      <RecordPart own={false}>{(local) => <SwapStickyBuy pair={record} local={local} />}</RecordPart>
    </>
  );
}

function SameAmountAndAgainst({ record, local }: { record: Pair; local: Local }) {
  const s = swapFor(record, local);
  const t = getT(local.lang);
  const hasDifferences = s.wins.length + s.points.length > 0;
  return (
    <>
      <p className="mt-3 text-[15px] text-ink-2">{sameAmount(s.pair, local)}</p>
      {hasDifferences && (
        <p className="mt-1.5 text-[15px] text-ink-2">
          {s.against && (
            <>
              <span className="font-semibold text-brand-better">{t("swap.againstIt")}</span>
              {s.against}{" "}
            </>
          )}
          <a href={`#${WHAT_DIFFERS}`} className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-0">
            {t("swap.whatDiffers")}
          </a>
        </p>
      )}
    </>
  );
}

function Related({ record, local, cat }: { record: Pair; local: Local; cat: (typeof CATEGORY_MAP)[keyof typeof CATEGORY_MAP] }) {
  const b = record.brand;
  const t = getT(local.lang);
  const related = forCountry(getRelatedPairs(record, 24), local).slice(0, 4).map((p) => (local.lang === "en" ? toSummary(p) : toCard(p, local.lang)));
  const brandCount = forCountry(getBrand(brandSlugFor(b.brand))?.pairs ?? [], local).length;
  return (
    <section aria-labelledby={related.length > 0 ? "related" : undefined} className={BAND}>
      <div className="container-page py-8 md:py-10">
        {related.length > 0 && (
          <>
            <h2 id="related" className="display text-[22px] md:text-2xl">
              {local.lang === "en" ? t("swap.moreSwaps", inSentence(cat.name)) : t("swap.moreSwaps", t(`categories.${cat.slug}.name`))}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
              {related.map((p) => (
                <PairCard key={p.slug} pair={p} lang={local.lang} />
              ))}
            </div>
          </>
        )}
        <p className={`flex flex-wrap gap-x-6 text-sm font-medium ${related.length > 0 ? "mt-3" : ""}`}>
          <Link href={`/dupe/${dupeSlugFor(record)}`} className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2">
            {t("swap.allCheaperMatches", b.brand)}
          </Link>
          {brandCount > 1 && (
            <Link href={`/brand/${brandSlugFor(b.brand)}`} className="inline-flex min-h-11 items-center text-cobalt underline underline-offset-2">
              {t("swap.brandProducts", brandCount, b.brand)}
            </Link>
          )}
        </p>
      </div>
    </section>
  );
}

function SwapStickyBuy({ pair, local }: { pair: Pair; local: Local }) {
  const a = pair.alternative;
  const t = getT(local.lang);
  if (!local.sells(a.retailer, pair.market)) return null;
  return (
    <StickyBuy watch={OFFERS}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink-2">
            {a.brand}
            {mayEarn(a, pair.market, pair.prices?.alternative) && adLabel(pair.market) && <span className="ml-2 text-[11px] text-muted">{t("swap.adLabel", pair.market)}</span>}
          </p>
          <p className="flex items-center gap-2">
            <span className="price text-xl">
              <Money n={a.price} from={pair.currency} />
            </span>
            <PctTicket pct={pair.savingsPct} size="sm" label={t("swap.ticket", Math.round(pair.savingsPct))} german={local.lang === "de"} />
          </p>
        </div>
        <a href={`/go/${pair.slug}/alternative`} target="_blank" rel="sponsored nofollow noopener" className="btn btn-primary shrink-0">
          {a.retailer === "other" ? t("swap.seeItOnline") : t("swap.seeItAt", atStore(a.retailer, a.url, local.lang))}
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
        </a>
      </div>
    </StickyBuy>
  );
}

/**
 * The answer: both packs standing on a shelf rail, the ticket on the rail between them, and a
 * shelf label under each. The columns share rows so the prices line up whatever the names do.
 */
function Shelf({ pair, lang }: { pair: Pair; lang: Lang }) {
  const t = getT(lang);
  return (
    <div className="grid min-w-0 grid-cols-2 grid-rows-[repeat(4,auto)] gap-x-2 self-start sm:gap-x-4 md:max-w-lg lg:max-w-none">
      <ShelfColumn pair={pair} product={pair.brand} side="brand" lang={lang} />
      <ShelfColumn pair={pair} product={pair.alternative} side="alternative" lang={lang} />
      <div aria-hidden="true" className="col-span-2 col-start-1 row-start-1 h-[3px] self-end bg-ink" />
      <div className="z-10 col-span-2 col-start-1 row-start-1 translate-y-1/2 self-end justify-self-center">
        <PctTicket
          pct={pair.savingsPct}
          size="lg"
          label={t("swap.ticket", Math.round(pair.savingsPct))} german={lang === "de"}
          className="md:px-3.5 md:py-2.5 md:pl-[26px] md:text-[2.25rem] md:[--hole-r:5px] md:[--hole-x:12px]"
        />
      </div>
      <PhotoLine className="col-span-2 mt-2" lang={lang} items={[pair.brand, pair.alternative].map((p) => ({ name: p.brand, photo: p.photo }))} />
    </div>
  );
}

function ShelfColumn({ pair, product: p, side, lang }: { pair: Pair; product: ProductSide; side: "brand" | "alternative"; lang: Lang }) {
  const cheaper = side === "alternative";
  const t = getT(lang);
  const label = unitLabel(p.unit, lang);
  return (
    <div className={`row-span-4 row-start-1 grid min-w-0 grid-rows-subgrid ${cheaper ? "col-start-2" : "col-start-1"}`}>
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
          lang={lang}
        />
      </div>
      <p className="min-w-0 pt-8 md:pt-9">
        <span className="block text-[13px] font-medium text-muted">{cheaper ? t("swap.shelf.cheaper") : t("swap.shelf.brand")}</span>
        <span className="block text-[15px] leading-tight font-bold break-words md:text-lg">{p.brand}</span>
      </p>
      <p
        className={`price mt-1.5 self-end ${cheaper ? "text-[2rem] text-ink min-[360px]:text-[2.5rem] md:text-[3.5rem] lg:text-[2.75rem]" : "text-[1.75rem] text-ink-2 min-[360px]:text-[2rem] md:text-[2.75rem] lg:text-[2.25rem]"}`}
      >
        <Money n={p.price} from={pair.currency} />
        <OriginalPrice n={p.price} from={pair.currency} market={pair.market} checked={pair.price_checked} className="mt-1 font-sans" />
      </p>
      <div className="mt-1 min-w-0 md:mt-1.5">
        <p className="text-sm font-medium text-ink-2">{packText(p.size, p.unit, lang)}</p>
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
  const t = getT(local.lang);
  const elsewhere = t("swap.offers.elsewhere", pair.market);
  // A cheap pack on its own can fall under a store's free-delivery line, which a shopper should know before the click.
  // For a shopper in another country, their country's rule or "not checked", never the home market's (delivery-abroad.ts).
  const deliveryNote = (p: ProductSide) => (sells(p.retailer) ? deliveryNoteFor(sellerOf(p), pair.market, p.price, pair.currency, local) : undefined);
  const side = (p: ProductSide, which: "brand" | "alternative"): Offer => ({
    name: productName(fullName(p), local.lang),
    note: deliveryNote(p),
    store: sells(p.retailer) ? storeName(p.retailer, p.url) : elsewhere,
    price: p.price,
    size: p.size,
    ppu: p.ppu,
    href: sells(p.retailer) ? `/go/${pair.slug}/${which}` : null,
    buttonLabel: seeLabel(p, local.lang),
    primary: which === "alternative",
    ad: mayEarn(p, pair.market, pair.prices?.[which]) ? t("swap.adLabel", pair.market) : undefined,
  });
  const offers = [side(a, "alternative"), side(b, "brand")];
  const big = bulkView.bigger;
  if (big) {
    offers.push({
      name: big.product,
      note: t("swap.offers.biggerPack"),
      store: sells(big.retailer) ? storeName(big.retailer, big.url) : elsewhere,
      price: big.price,
      size: big.size,
      ppu: big.ppu,
      href: sells(big.retailer) ? `/go/${pair.slug}/bigger` : null,
      buttonLabel: big.retailer === "other" ? t("swap.seeItOnline") : t("swap.seeItAt", atStore(big.retailer, undefined, local.lang)),
      primary: false,
      ad: mayEarn({ retailer: big.retailer as ProductSide["retailer"], url: big.url }, pair.market) ? t("swap.adLabel", pair.market) : undefined,
    });
  }
  return offers;
}

/** The offer list: every price with its store, pack, unit price and date, on the first screen. */
function Offers({ pair, local }: { pair: Pair; local: Local }) {
  const unit = pair.alternative.unit;
  const t = getT(local.lang);
  const label = unitLabel(unit, local.lang);
  return (
    <div className="@container mt-3">
      <PriceChecked pair={pair} local={local} tag={<MarketTag market={pair.market} whereToBuy={WHERE_TO_BUY} />} />
      <div role="table" aria-label={t("swap.offers.label")} className="divide-y divide-line border-y border-line-strong">
        <div role="row" className={`hidden gap-x-3 py-1.5 text-[13px] font-medium text-muted @2xl:grid ${OFFER_COLUMNS}`}>
          <span role="columnheader">{t("swap.offers.product")}</span>
          <span role="columnheader">{t("swap.offers.store")}</span>
          <span role="columnheader">{t("swap.offers.price")}</span>
          <span role="columnheader">{t("swap.offers.pack")}</span>
          <span role="columnheader">{t("swap.offers.unitPrice")}</span>
          <span role="columnheader" className="sr-only">
            {t("swap.offers.link")}
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
                {packText(o.size, unit, local.lang)}
              </p>
              <p role="cell" className="text-[13px] leading-tight font-medium text-muted @2xl:col-start-5 @2xl:row-start-1">
                <span className="price text-[15px] text-ink">
                  <UnitAmount ppu={o.ppu} unit={unit} from={pair.currency} />
                </span>{" "}
                {label}
              </p>
            </div>
            <div
              role="cell"
              className="col-span-2 col-start-1 row-start-4 mt-1 @md:col-span-1 @md:col-start-3 @md:row-span-3 @md:row-start-1 @md:mt-0 @md:self-center @2xl:col-start-6 @2xl:row-span-1"
            >
              {o.href ? (
                <>
                  <a href={o.href} target="_blank" rel="sponsored nofollow noopener" className={`btn w-full text-center ${o.primary ? "btn-primary" : "btn-ghost"}`}>
                    <span className="@md:hidden">{o.buttonLabel}</span>
                    <span className="hidden @md:inline">
                      {t("swap.seeIt")}<span className="sr-only">: {o.buttonLabel}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                  {o.ad && <span className="mt-0.5 block text-center text-[11px] font-medium text-muted">{o.ad}</span>}
                </>
              ) : (
                <a href={`#${WHERE_TO_BUY}`} className="btn btn-ghost w-full text-center">
                  {t("swap.whereToBuy")}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The one-sentence answer, in the words the match level allows. It names no price, so it's the same in every country. */
function verdict(pair: Pair, lang: Lang) {
  const { brand: b, alternative: a } = pair;
  const t = getT(lang);
  const { label } = unitDisplay(b.unit);
  const what = t(`swap.verdict.${pair.match_type}`, b.brand);
  return t("swap.verdict.line", a.brand, what, Math.round(pair.savingsPct), label === "each" ? "" : unitLabel(b.unit, lang));
}

/** What the saving comes to for the same amount, since packs are often different sizes. */
function sameAmount(pair: Pair, local: Local) {
  const { brand: b, alternative: a, savingsPerPack: saved, currency } = pair;
  const t = getT(local.lang);
  if (a.size === b.size) {
    // "Price per cell" is a unit of something you keep buying, whatever its size says.
    if (/\bper\b/i.test(a.product)) return t("swap.sameAmount.each", local.lang === "en" ? b.unit : unitWordsFor(b.unit, "de", 1), local.money(saved, currency));
    if (buysOnce(a.unit, a.size)) return t("swap.sameAmount.once", local.money(saved, currency));
    return t("swap.sameAmount.pack", local.money(saved, currency));
  }
  // The cheaper pack is a different size, so this is its unit price times the brand's pack.
  const forSameAmount = (a.price / a.size) * b.size;
  return t("swap.sameAmount.forSame", packText(b.size, b.unit, local.lang), local.bare(forSameAmount, currency), a.brand, local.money(b.price, currency), b.brand);
}

/**
 * The word an earning link carries beside it, where a market's rules want the link itself marked: German law wants
 * "Anzeige" or "Werbung" at the link, and the UK and Irish ad codes want "Ad". The line under the prices says the rest.
 */
function adLabel(market: Pair["market"]) {
  return market === "DE" ? "Anzeige" : market === "GB" || market === "IE" ? "Ad" : undefined;
}

// Decided per link, feed links included (src/lib/disclosure.ts).
const disclosure = swapDisclosure;

function listWords(words: string[]) {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** What the store button says. A brand's own shop reads "See it at Apple". */
function seeLabel(p: ProductSide, lang: Lang) {
  const t = getT(lang);
  if (p.retailer === "other") return t("swap.seeBrandOnline", p.brand);
  const store = RETAILER_LABEL[p.retailer];
  if (store?.toLowerCase() === p.brand.toLowerCase()) return t("swap.seeItAtStore", store);
  return t("swap.seeBrandAt", p.brand, atStore(p.retailer, undefined, lang));
}

function fullName(p: ProductSide) {
  // "Bramwells (Aldi)" and "Aldi Bramwells Beans, 410g" already name the brand once.
  const brand = p.brand.replace(/\s*\(.*\)\s*$/, "").toLowerCase();
  return p.product.toLowerCase().includes(brand) ? p.product : `${p.brand} ${p.product}`;
}

/** Puts the generated pack and price rows in the same words as the shelf label. Researched rows stay as written. */
function readableRows(rows: CompareRow[], pair: Pair, local: Local): CompareRow[] {
  const { brand: b, alternative: a, currency } = pair;
  const t = getT(local.lang);
  const researched = new Set((pair.aspects ?? []).map((r) => r.aspect));
  return rows.map((r) => {
    if (researched.has(r.aspect)) return { ...r, brand: local.prose(r.brand, currency), alternative: local.prose(r.alternative, currency) };
    if (r.aspect === "Pack") return { ...r, brand: packText(b.size, b.unit, local.lang), alternative: packText(a.size, a.unit, local.lang) };
    if (r.aspect === `Price per ${b.unit}`) {
      return {
        ...r,
        aspect: t("rows.pricePer", unitLabel(b.unit, local.lang)),
        brand: local.unit(b.ppu, b.unit, currency),
        alternative: t("rows.less", local.unit(a.ppu, a.unit, currency), Math.round(pair.savingsPct)),
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
