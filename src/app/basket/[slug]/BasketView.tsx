/**
 * The basket page, for /basket/<slug> (the view follows the shopper's cookie) and /<country>/basket/<slug> (that
 * country's view, see src/lib/country-url.ts). Like a kit, it is prices throughout, so the body is one RecordPart: the
 * basket's own view is the static HTML of the unprefixed URL, and a prefixed URL's static HTML is its country's view.
 */
import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { ChevronRight, ExternalLink } from "lucide-react";
import { BasketCard, COLLAGE_CELLS } from "@/components/BasketCard";
import { BasketCheckout, BasketLines, BasketProvider, BasketStoreSplit, BasketTotals, SaveAllButton } from "@/components/BasketLines";
import { HealthNotice, hostname } from "@/components/Evidence";
import { ProductThumb } from "@/components/ProductThumb";
import { basketLines, basketPhotos, priceDates, toBasketSummary } from "@/lib/basket-view";
import { getAllPresets, getPair, getPreset } from "@/lib/catalog";
import { jsonLdText, SITE } from "@/lib/site";
import type { Preset } from "@/lib/types";
import { basketDescription, basketTitle } from "@/lib/seo";
import { forCountry, type Local } from "@/lib/localize";
import { NotListedHere } from "@/components/ShelfParts";
import { RecordPart } from "@/components/ForCountry";
import { countryHead, pageVersionsFor } from "@/lib/seo-catalog";
import { VersionLinks } from "@/components/CountryIndex";
import { withCountry, type PrefixedCountry } from "@/lib/country-url";
import { dict, getT } from "@/lib/i18n";
import { langForCountry } from "@/lib/i18n/lang";
import { basketText } from "@/lib/i18n/record";
import { basketDescriptionDe, basketTitleDe } from "@/lib/i18n/seo-de";

const NEEDS_HEALTH_NOTE = new Set(["otc-medicine", "supplements", "baby", "pet"]);

/** The basket's head for its unprefixed URL (country null) or one country's: title, description, and the rule in seo.ts. */
export function basketMetadata(slug: string, country: PrefixedCountry | null): Metadata {
  const p = getPreset(slug);
  const lang = langForCountry(country);
  if (!p) return { title: getT(lang)("basketPage.notFound") };
  const title = lang === "de" ? basketTitleDe(p) : basketTitle(p);
  const description = lang === "de" ? basketDescriptionDe(p) : basketDescription(p);
  const head = countryHead(`/basket/${p.slug}`, country);
  const url = head?.alternates.canonical ?? withCountry(`/basket/${p.slug}`, country);
  // The share image is made once per basket, at its unprefixed URL.
  const images = country ? { images: [{ url: `/basket/${p.slug}/opengraph-image`, width: 1200, height: 630 }] } : {};
  return { title, description, ...head, openGraph: { title, description, url, type: "article", ...images } };
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

export function BasketView({ record, country }: { record: Preset; country: PrefixedCountry | null }) {
  const lang = langForCountry(country);
  const t = getT(lang);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("swap.home"), item: `${SITE.url}${withCountry("/", country)}` },
      { "@type": "ListItem", position: 2, name: t("basketPage.crumb"), item: `${SITE.url}${withCountry("/bundles", country)}` },
      { "@type": "ListItem", position: 3, name: lang === "de" && record.de ? record.de.title : record.title, item: `${SITE.url}${withCountry(`/basket/${record.slug}`, country)}` },
    ],
  };
  return (
    <>
      <RecordPart>{(local) => <BasketBody p={record} local={local} />}</RecordPart>
      <VersionLinks languages={pageVersionsFor(`/basket/${record.slug}`)?.languages ?? {}} current={withCountry(`/basket/${record.slug}`, country)} lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(jsonLd) }} />
    </>
  );
}

function BasketBody({ p: record, local }: { p: Preset; local: Local }) {
  const lang = local.lang;
  const t = getT(lang);
  const p = basketText(record, local);
  // A German page showing a basket with no German text yet: its words stay English, and say so once, by the title.
  const textLang = lang !== "en" && p.textLang === "en" ? "en" : undefined;
  const lines = basketLines(record, local);
  const dates = priceDates(record, lang);
  const all = forCountry(getAllPresets(), local);
  const otherMarkets = all.filter((x) => x.family === p.family && x.slug !== p.slug);
  const related = all
    .filter((x) => x.family !== p.family)
    .sort((a, b) => Number(b.market === p.market) - Number(a.market === p.market) || b.score - a.score)
    .slice(0, 3);
  const health = p.lines.some((l) => NEEDS_HEALTH_NOTE.has(getPair(l.pair)?.category ?? ""));

  return (
    <BasketProvider lines={lines} currency={p.currency} market={p.market} country={local.known ? local.country : null}>
      <article>
        {!local.shows(p) && <NotListedHere market={p.market} local={local} />}
        <div className="border-b border-line bg-canvas">
          <div className="container-page pt-1 pb-6 md:pt-3 md:pb-8">
            <nav aria-label={t("swap.breadcrumb")} className="flex flex-wrap items-center gap-1 text-sm text-ink-2">
              <Link href="/bundles" className="inline-flex min-h-11 items-center hover:underline md:min-h-0">
                {t("basketPage.crumb")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <span className="inline-flex min-h-11 items-center md:min-h-0">{t("basketPage.pricedIn", p.market)}</span>
              {textLang && <span className="ml-2 text-[13px] font-medium text-muted">{t("kits.inEnglish")}</span>}
            </nav>

            <div className="md:mt-3 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:grid-rows-[auto_1fr] md:gap-x-8 lg:gap-x-12">
              <header className="md:col-start-2 md:row-start-1" lang={textLang}>
                <h1 className="display text-[1.75rem] md:text-[2.5rem]">{p.title}</h1>
                <p className="mt-1.5 text-base font-medium text-ink md:text-lg">{p.audience}</p>
                <p className="mt-1 max-w-[62ch] text-[15px] text-ink-2">{p.blurb}</p>
              </header>

              <div className="mt-3 md:col-start-1 md:row-span-2 md:row-start-1 md:mt-0">
                <Collage preset={record} />
                <p className="mt-1.5 text-xs text-muted">
                  <Link href="/credits" className="underline underline-offset-2 hover:text-ink">
                    {t("basketPage.photos")}
                  </Link>
                </p>
              </div>

              <div className="mt-4 md:col-start-2 md:row-start-2 md:mt-5">
                <BasketTotals />
                <BasketStoreSplit />
                <p className="mt-3 max-w-[62ch] text-sm text-ink-2">
                  {t("basketPage.bothTotals")}
                  {dates ? t("basketPage.dated", p.market, dates) : ""}
                </p>
                <div className="mt-3">
                  <SaveAllButton />
                </div>
                {otherMarkets.length > 0 && (
                  <p className="mt-1 text-sm text-ink-2">
                    {t("basketPage.alsoPricedIn")}{" "}
                    {otherMarkets.map((x, i) => (
                      <span key={x.slug}>
                        {i > 0 && ", "}
                        <Link href={`/basket/${x.slug}`} className="text-cobalt underline underline-offset-2">
                          {dict(lang).markets.name[x.market]}
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
            <h2 className="display text-xl md:text-2xl">{t("basketPage.whatsInIt")}</h2>
            <p className="mt-1 text-sm text-ink-2 md:text-[15px]">{t("basketPage.changeQty")}</p>
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
            <h2 className="display text-xl md:text-2xl">{t("basketPage.howChosen")}</h2>
            <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2" lang={textLang}>{p.research}</p>
            <p className="mt-2 max-w-[62ch] text-[15px] text-ink-2">
              {t("basketPage.onEachSwap")}{" "}
              <Link href="/how-we-verify" className="text-cobalt underline underline-offset-2">
                {t("basketPage.howWeCheck")}
              </Link>
            </p>
          </div>
          <div>
            <h3 className="text-base">{t("basketPage.guides")}</h3>
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
            <HealthNotice lang={lang} />
          </div>
        )}

        {related.length > 0 && (
          <section className="container-page pt-8 md:pt-10">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6">
              <h2 className="display text-xl md:text-2xl">{t("basketPage.otherBaskets")}</h2>
              <Link href="/bundles" className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline-offset-2 hover:underline md:min-h-0">
                {t("basketPage.allBasketsKits")}
              </Link>
            </div>
            <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
              {related.map((x) => (
                <BasketCard key={x.slug} basket={toBasketSummary(x, undefined, lang)} lang={lang} />
              ))}
            </div>
          </section>
        )}

      </article>
    </BasketProvider>
  );
}
