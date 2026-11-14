/**
 * The kit page, for /bundle/<slug> (the view follows the shopper's cookie) and /<country>/bundle/<slug> (that country's
 * view, see src/lib/country-url.ts). Nearly all of a kit page is prices, so the whole body is one RecordPart: on the
 * unprefixed URL the kit's own view (its market's prices and stores) is the static HTML and the shopper's replaces it in
 * the same shape; on a prefixed URL that country's view is the static HTML.
 */
import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ChevronRight, ExternalLink } from "lucide-react";
import { ConfidenceBadge, MatchBadge } from "@/components/Badges";
import { COLLAGE_CELLS } from "@/components/BasketCard";
import { BundleCard } from "@/components/BundleCard";
import { BundleWhereToBuy } from "@/components/BundleWhereToBuy";
import { BundleCheckout } from "@/components/BundleCheckout";
import { BundleBuyBox, BundleBuySection, BundleStickyBuy, piecesJsonLd } from "@/components/BundleBuy";
import { HEALTH_CATEGORIES, HealthNotice, SourceList } from "@/components/Evidence";
import { ProductThumb } from "@/components/ProductThumb";
import { SaveButton } from "@/components/SaveButton";
import { SaveTicket } from "@/components/Ticket";
import { linksEarn, RETAILER_LABEL, storeName } from "@/lib/affiliate";
import { kitEarns } from "@/lib/disclosure";
import { packSize } from "@/lib/basket-view";
import { getAllBundles, getBundle } from "@/lib/catalog";
import { CATEGORY_MAP } from "@/lib/categories";
import { jsonLdText, SITE } from "@/lib/site";
import { unitLabel } from "@/lib/unit-format";
import { forCountry, localText, type Local } from "@/lib/localize";
import { NotListedHere } from "@/components/ShelfParts";
import { RecordFeedback, ReportedPriceNote } from "@/components/RecordFeedback";
import { kitLeadFirst } from "@/lib/reported-state";
import { RecordPart } from "@/components/ForCountry";
import { Money, UnitAmount } from "@/components/Money";
import { KitPriceChecked } from "@/components/PriceChecked";
import type { Bundle } from "@/lib/types";
import { kitFor } from "@/lib/delivery-abroad";
import { bundleDescription, bundleTitle } from "@/lib/seo";
import { countryHead, pageVersionsFor } from "@/lib/seo-catalog";
import { VersionLinks } from "@/components/CountryIndex";
import { withCountry, type PrefixedCountry } from "@/lib/country-url";
import { getT } from "@/lib/i18n";
import { langForCountry } from "@/lib/i18n/lang";
import { kitText } from "@/lib/i18n/record";
import { rich } from "@/lib/i18n/rich";
import { bundleDescriptionDe, bundleTitleDe } from "@/lib/i18n/seo-de";

/** The kit's head for its unprefixed URL (country null) or one country's: title, description, and the rule in seo.ts. */
export function kitMetadata(slug: string, country: PrefixedCountry | null): Metadata {
  const b = getBundle(slug);
  const lang = langForCountry(country);
  if (!b) return { title: getT(lang)("kitPage.notFound") };
  const title = lang === "de" ? bundleTitleDe(b) : bundleTitle(b);
  const description = lang === "de" ? bundleDescriptionDe(b) : bundleDescription(b);
  const head = countryHead(`/bundle/${b.slug}`, country);
  const url = head?.alternates.canonical ?? withCountry(`/bundle/${b.slug}`, country);
  // The share image is made once per kit, at its unprefixed URL.
  const images = country ? { images: [{ url: `/bundle/${b.slug}/opengraph-image`, width: 1200, height: 630 }] } : {};
  return { title, description, ...head, openGraph: { title, description, url, type: "article", ...(lang === "de" ? { locale: "de_DE" } : {}), ...images } };
}

/** The first image on the page that has a real photo. It loads eagerly. */
function eagerTarget(b: Bundle) {
  if (b.photo) return "kit";
  return b.components.slice(0, 4).findIndex((c) => c.photo);
}

export function KitView({ record, country }: { record: Bundle; country: PrefixedCountry | null }) {
  const lang = langForCountry(country);
  const t = getT(lang);
  // The structured data names what the page shows: German text on a German page that has it.
  const named = lang === "de" && record.de ? kitText(record, { lang, converts: () => false }) : record;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("swap.home"), item: `${SITE.url}${withCountry("/", country)}` },
      { "@type": "ListItem", position: 2, name: t("kitPage.crumb"), item: `${SITE.url}${withCountry("/bundles", country)}` },
      { "@type": "ListItem", position: 3, name: named.bundle.name, item: `${SITE.url}${withCountry(`/bundle/${record.slug}`, country)}` },
    ],
  };
  return (
    <>
      <RecordPart>{(local) => <BundleBody record={record} local={local} />}</RecordPart>
      <VersionLinks languages={pageVersionsFor(`/bundle/${record.slug}`)?.languages ?? {}} current={withCountry(`/bundle/${record.slug}`, country)} lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText([jsonLd, piecesJsonLd(named, lang)]) }} />
    </>
  );
}

function BundleBody({ record, local }: { record: Bundle; local: Local }) {
  const lang = local.lang;
  const t = getT(lang);
  const b = kitFor(localText(kitText(record, local), local), local.known ? local.country : null);
  // A German page showing a kit with no German text yet: its words stay English, and say so once, by the title.
  const inEnglish = lang !== "en" && b.textLang === "en";
  const textLang = inEnglish ? "en" : undefined;
  const sells = (retailer: string) => local.sells(retailer, b.market);
  const cat = CATEGORY_MAP[b.category];
  const related = forCountry(getAllBundles(), local)
    .filter((x) => x.slug !== b.slug)
    .sort((x, y) => kitLeadFirst(x, y) || Number(y.category === b.category) - Number(x.category === b.category) || y.score - x.score)
    .slice(0, 4);
  const perMonth =
    b.bundle.billing === "subscription" && b.bundle.supply_days ? (b.netSavings / b.bundle.supply_days) * 30 : null;
  const pieces = b.components.slice(0, 4);
  const eager = eagerTarget(b);
  const earns = kitEarns(b);

  return (
    <article>
      {!local.shows(record) && <NotListedHere market={record.market} local={local} />}
      <div id="kit-hero" className="border-b border-line bg-canvas">
        <div className="container-page pt-1 pb-6 md:pt-3 md:pb-8">
          <nav aria-label={t("swap.breadcrumb")} className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
            <Link href="/bundles" className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
              {t("kitPage.crumb")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <Link href={`/category/${cat.slug}`} className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
              {lang === "en" ? cat.name : t(`categories.${cat.slug}.name`)}
            </Link>
            {inEnglish && <span className="ml-2 text-[13px] font-medium text-muted">{t("kits.inEnglish")}</span>}
          </nav>

          {/* Store listing names run long; a long one sets smaller, so the prices still reach the first screen on a phone. */}
          <h1 className={`display md:mt-3 ${b.bundle.name.length > 120 ? "max-w-[60ch] text-lg leading-snug md:text-[1.5rem]" : b.bundle.name.length > 70 ? "max-w-[44ch] text-[1.375rem] md:text-[1.875rem]" : "max-w-[30ch] text-[1.75rem] md:text-[2.5rem]"}`} lang={textLang}>{b.bundle.name}</h1>
          <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2 md:text-base" lang={textLang}>{b.summary}</p>

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
                <p className="mt-2 text-[13px] font-medium text-ink-2">{t("kitPage.theKit", b.bundle.brand)}</p>
                <p className="price mt-1 text-[1.75rem] font-semibold text-muted md:text-[2rem]"><Money n={b.bundle.price} from={b.currency} /></p>
                <p className="mt-1 text-xs text-muted">
                  {b.bundle.billing === "subscription" ? t("kitPage.perShipment") : t("kitPage.onePrice")}
                  {b.bundle.supply_days ? t("kitPage.supply", b.bundle.supply_days) : ""}
                </p>
              </div>

              <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto md:self-center">
                <SaveTicket
                  size="lg"
                  amount={b.netSavings}
                  currency={b.currency}
                  sub={perMonth ? t("kitPage.aMonth", local.bare(perMonth, b.currency)) : t("kitPage.less", Math.round(b.netSavingsPct))}
                  word={t("cards.save")}
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
                <p className="mt-2 text-[13px] font-medium text-ink-2">{t("kitPage.builtFrom", b.components.length)}</p>
                <p className="price mt-1 text-[2.25rem] text-ink md:text-[2.75rem]"><Money n={b.equivalentTotal} from={b.currency} /></p>
                <p className="mt-1 text-xs text-muted">{t("kitPage.sameAmountHolds")}</p>
              </div>
            </div>

            <aside className="card order-first self-start p-4 lg:order-none">
              <BundleBuyBox b={b} local={local} />
              <ReportedPriceNote record="bundle" slug={b.slug} className="mt-3" lang={lang} />
              <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">{t("kitPage.match")}</dt>
                  <dd>
                    <MatchBadge type={b.match_type} long lang={lang} />
                  </dd>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-ink-2">{t("kitPage.evidence")}</dt>
                  <dd>
                    <ConfidenceBadge confidence={b.confidence} lang={lang} />
                  </dd>
                </div>
                <KitPriceChecked bundle={b} lang={lang} />
              </dl>
              <div className="mt-3 space-y-2">
                <SaveButton slug={b.slug} />
                {sells(b.bundle.retailer) && (
                  <a
                    href={`/go/${b.slug}/brand`}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    className="btn btn-ghost w-full"
                  >
                    {t("kitPage.seeKitAt", storeName(b.bundle.retailer, b.bundle.url))} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
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
            <h2 className="display mb-3 text-xl md:text-2xl">{t("kitPage.pieceByPiece")}</h2>
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
                          {rich(t("kitPage.insteadOf"), { name: <span className="font-medium text-ink" lang={textLang}>{item.name}</span>, pack: packSize(item.size, item.unit, lang) })}
                        </p>
                        <p className="mt-1 text-[15px] leading-snug font-semibold">{withBrand(c.brand, c.product)}</p>
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-ink-2">
                          <span>
                            <span className="price text-[15px] text-ink"><UnitAmount ppu={c.ppu} unit={c.unit} from={b.currency} /></span>{" "}
                            {unitLabel(c.unit, lang)}
                          </span>
                          <span>
                            {rich(t("kitPage.packOf"), { pack: packSize(c.size, c.unit, lang), price: <span className="num"><Money n={c.price} from={b.currency} /></span> })}
                          </span>
                          <MatchBadge type={c.match_type} lang={lang} />
                        </p>
                        {c.photo && (
                          <p className="mt-1 text-xs text-muted">
                            {t("kitPage.photo")}{" "}
                            <a href={c.photo.page} target="_blank" rel="noopener nofollow" className="underline underline-offset-2 hover:text-ink">
                              {c.photo.credit}
                            </a>
                            , {c.photo.license}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:flex-col md:items-end md:justify-start">
                        <p className="md:text-right">
                          <span className="block text-xs font-medium text-muted">{t("kitPage.sameAmount")}</span>
                          <span className="price mt-0.5 block text-[1.375rem] text-ink"><Money n={c.equivalentCost} from={b.currency} /></span>
                        </p>
                        {sells(c.retailer) && (
                          <a
                            href={`/go/${b.slug}/item-${i}`}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className="btn btn-ghost text-sm"
                          >
                            {RETAILER_LABEL[c.retailer === "other" ? c.seller : c.retailer] ?? t("kitPage.goToStore")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-b-card border-t border-line-strong bg-canvas px-3 py-3 md:px-4">
                <p className="text-sm font-medium">{t("kitPage.sameAmountAsKit")}</p>
                <p className="price text-[1.375rem] text-ink"><Money n={b.equivalentTotal} from={b.currency} /></p>
              </div>
            </div>
          </section>

          <BundleCheckout b={b} local={local} />

          {(b.differences || b.bundle.extras.length > 0) && (
            <section className="rounded-card border border-different/30 bg-different-soft p-4 md:p-5">
              <h2 className="display text-xl md:text-2xl">{t("kitPage.differs")}</h2>
              {b.differences && <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2" lang={textLang}>{b.differences}</p>}
              {b.bundle.extras.length > 0 && (
                <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2" lang={textLang}>
                  <span className="font-semibold text-ink">{t("kitPage.alsoComes")}</span>
                  {b.bundle.extras.map((e) => local.prose(e, b.currency)).join(", ")}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="display text-xl md:text-2xl">{t("kitPage.howChecked")}</h2>
            <p className="mt-2 max-w-[68ch] text-[15px] text-ink-2" lang={textLang}>{b.evidence}</p>
          </section>

          <SourceList sources={b.sources} lang={lang} />
          {HEALTH_CATEGORIES.has(b.category) && <HealthNotice category={b.category} lang={lang} />}
          <RecordFeedback record="bundle" slug={b.slug} />
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <BundleBuySection b={b} local={local} />
          <p className="text-xs text-muted">
            {earns ? t("kitPage.earns") : linksEarn() ? t("kitPage.searchMayEarn") : t("kitPage.noEarn")}{" "}
            <Link href="/disclosure" className="underline underline-offset-2">
              {t("kitPage.details")}
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
            <h2 className="display text-xl md:text-2xl">{t("kitPage.moreKits")}</h2>
            <Link href="/bundles" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
              {t("kitPage.allBasketsKits")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
            {related.map((x) => (
              <BundleCard key={x.slug} bundle={x} lang={lang} />
            ))}
          </div>
        </section>
      )}
      <BundleStickyBuy b={b} lang={lang} />
    </article>
  );
}

function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}
