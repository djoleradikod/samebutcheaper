import Link from "@/components/CountryLink";
import { linksEarn } from "@/lib/affiliate";
import { homeHead } from "@/lib/seo-catalog";

/** The x-default of /us, /uk, /de, /ca and /ie (src/lib/country-url.ts). */
export const metadata = homeHead(null);
import { assignBasketPhotos, cutOutCount, photoCount, toBasketSummary } from "@/lib/basket-view";
import {
  bestPhoto,
  getAllPairs,
  getAllPresets,
  getCategoryStats,
  getClaims,
  getFeaturedPairs,
  getPair,
  getPairsByCategory,
  getPresetsFor,
  getShelfLife,
  NO_PHOTO_STANDING,
  photoStanding,
  pickByPhotos,
  showsOnlyCutOuts,
  toSummary,
} from "@/lib/catalog";
import { AisleTile } from "@/components/CategoryIcon";
import { isCutOut } from "@/lib/photos";
import { FeaturedBaskets, FeaturedPairs } from "@/components/FeaturedPairs";
import { Finding, findingExcerpt } from "@/components/Finding";
import { NewsletterForm } from "@/components/NewsletterForm";
import { ProductThumb } from "@/components/ProductThumb";
import { ShoppingCheckCta } from "@/components/ShoppingCheckCta";
import { findingShows, forCountry, isThinMarket, localClaim, type Local } from "@/lib/localize";
import { dict, getT, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { claimText, shelfText } from "@/lib/i18n/record";
import { formatPercent } from "@/lib/i18n/format";
import { toCard } from "@/components/ShelfParts";
import type { MarketCode } from "@/lib/markets";
import { CountryPart } from "@/components/ForCountry";
import { jsonLdText } from "@/lib/site";
import type { CategorySlug, Claim, Pair as PairT, PairSummary, Preset, ShelfLife } from "@/lib/types";

const MEDICINE: CategorySlug = "otc-medicine";

/* ------------------------------------------------------------ what the page shows */

function isMedicine(line: Preset["lines"][number]) {
  return getPair(line.pair)?.category === MEDICINE;
}

/**
 * The shopper's market first, then the baskets with enough cut-outs for a full collage, then any with a
 * photo. Across the row no picture shows twice (see assignBasketPhotos).
 */
function basketsFor(local: Local) {
  const market = local.listMarket;
  const photoRank = (p: Preset) => (cutOutCount(p) >= 3 ? 0 : photoCount(p) > 0 ? 1 : 2);
  const rank = (p: Preset) => (p.market === market ? 0 : 3) + photoRank(p);
  const unrated = (p: Preset) => p.lines.filter((l) => !getPair(l.pair)?.alternative.rating).length / p.lines.length;
  const chosen = getPresetsFor(market, forCountry(getAllPresets(), local))
    .filter((p) => p.icon !== "pill" && p.lines.filter(isMedicine).length * 2 <= p.lines.length)
    .sort((a, b) => rank(a) - rank(b) || unrated(a) - unrated(b))
    .slice(0, 6);
  const photos = assignBasketPhotos(chosen);
  return chosen.map((p) => toBasketSummary(p, photos.get(p.slug), local.lang));
}

/**
 * Never medicine, including remedies filed under another aisle such as infant gas relief, and never a swap
 * with no photo. Cut-outs fill the grid first (see pickByPhotos), with a cap per aisle and per shelf so it
 * shows the range of the site, and within a photo standing it reads as a ranking: biggest saving first.
 */
function biggestSavings(market: MarketCode, local: Local, limit = 12) {
  const fit = (p: PairT) => photoStanding(p) < NO_PHOTO_STANDING && !/relief|remed|fever|allerg|cough/i.test(p.subcategory);
  const caps = (p: PairT) => [
    { key: p.category, max: p.category === "supplements" ? 2 : 6 },
    { key: `${p.category}:${p.subcategory.toLowerCase()}`, max: 2 },
  ];
  // Rated swaps come first, so an unrated product only fills what they leave.
  const rated = getFeaturedPairs(48, market, (pairs) => forCountry(pairs, local).filter((p) => p.alternative.rating)).filter(fit);
  const first = pickByPhotos(rated, limit, caps);
  const pool = getFeaturedPairs(48, market, (pairs) => forCountry(pairs, local)).filter((p) => fit(p) && !first.includes(p));
  // The shop window shows both products where it can, so nobody's told to buy something they can't see.
  const both = pool.filter((p) => p.brand.photo && p.alternative.photo);
  const room = limit - first.length;
  const fill = room > 0 ? pickByPhotos(both.length >= room ? both : pool, room, caps) : [];
  const unrated = (p: PairT) => Number(!p.alternative.rating);
  return [...first, ...fill].sort((a, b) => unrated(a) - unrated(b) || photoStanding(a) - photoStanding(b) || b.savingsPct - a.savingsPct);
}

/**
 * The market that leads for this shopper. Only Canada, with too few of its own, fills up from the US: US and
 * Canadian records never show elsewhere. A raw snapshot only shows when there's no swap left without one.
 */
function featuredFor(local: Local, limit = 12): PairSummary[] {
  const market = local.listMarket;
  const own = biggestSavings(market, local, limit);
  // Canada lists few of its own, and only the US and UK swaps whose stores sell there, so it draws on every market it can see.
  const merged = market === "CA" ? [...own, ...(["US", "GB", "DE", "IE"] as const).flatMap((m) => biggestSavings(m, local, limit))] : own;
  // A market too thin to lead still opens with what we've priced there, photo or not.
  const home = isThinMarket(local.country)
    ? getAllPairs()
        .filter((p) => p.market === local.country && p.category !== MEDICINE)
        .slice(0, 4)
    : [];
  // Rated first, then what shows only cut-outs. See biggestSavings.
  const order = (p: PairT) => (p.alternative.rating ? 0 : 2) + (showsOnlyCutOuts(p) ? 0 : 1);
  // A country whose few listed swaps all lack photos (Australia) gets them anyway, not an empty section.
  const fill = home.length + merged.length ? [] : forCountry(getAllPairs(), local).filter((p) => p.category !== MEDICINE).sort((a, b) => b.savingsPct - a.savingsPct).slice(0, 4);
  const list = [...home, ...[...merged].sort((a, b) => order(a) - order(b)), ...fill].slice(0, limit);
  return local.lang === "en" ? list.map(toSummary) : list.map((p) => toCard(p, local.lang));
}

const MENTIONS_MEDICINE = /medicin|medicat|drug|pharmac|headache|painkiller|remed/i;
const ABOUT_SWITCHING = /own[- ]label|own[- ]brand|store[- ]brand|cheap|beat/i;

/**
 * Findings about switching, newest first, spread across publishers and countries, as findingShows allows. Prices follow the shopper's currency.
 */
function pickFindings(local: Local, limit = 3) {
  const date = (c: Claim) => (/^\d/.test(c.sources[0].date) ? c.sources[0].date : "");
  const ranked = getClaims()
    .filter(
      (c) =>
        !c.categories.includes(MEDICINE) &&
        !MENTIONS_MEDICINE.test(`${c.title} ${findingExcerpt(c.finding)}`) &&
        c.markets.length > 0 &&
        findingShows(c, local) &&
        (local.lang === "en" || claimText(c, local).lang === local.lang),
    )
    .sort(
      (a, b) =>
        Number(ABOUT_SWITCHING.test(b.title)) - Number(ABOUT_SWITCHING.test(a.title)) ||
        date(b).localeCompare(date(a)),
    );
  const picked: Claim[] = [];
  const publishers = new Set<string>();
  const markets = new Set<string>();
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (publishers.has(c.sources[0].publisher) || c.markets.some((m) => markets.has(m))) continue;
    picked.push(c);
    publishers.add(c.sources[0].publisher);
    c.markets.forEach((m) => markets.add(m));
  }
  for (const c of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.map((c) => (local.lang === "en" ? localClaim(c, local) : claimText(c, local)));
}

const BULK_COLUMNS: ShelfLife["advice"][] = ["stock_up", "buy_to_use", "buy_small"];

/** The headline figure of a shelf-life record, before its citations and exceptions. */
function keepsFor(unopened: string) {
  const clause = unopened.split(/\s\(|\.\s|,\s/)[0].replace(/\.$/, "");
  return clause.length > 60 ? clause.split(":")[0] : clause;
}

function bulkRows(advice: ShelfLife["advice"], local: Local, limit = 5) {
  const pairs = forCountry(getAllPairs(), local).filter((p) => p.category !== MEDICINE);
  return getShelfLife()
    .filter((r) => r.advice === advice)
    .map((record) => {
      const r = shelfText(record, local.lang);
      const swaps = pairs.filter((p) => p.shelfLife?.id === r.id);
      const best = bestPhoto(swaps);
      return {
        id: r.id,
        label: r.label,
        keeps: keepsFor(r.unopened),
        swaps: swaps.length,
        href: swaps[0] ? `/compare/${(best?.pair ?? swaps[0]).slug}` : null,
        photo: best?.photo.src ?? null,
        photoName: best?.name ?? r.label,
      };
    })
    .sort((a, b) => b.swaps - a.swaps)
    .slice(0, limit);
}

function buildFaq(aisles: string[], lang: Lang) {
  return getT(lang)("home.faq", aisles, linksEarn());
}

/** The middle saving, rounded, so the headline claim holds for a typical swap rather than the best one. */
function medianPct(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

/* --------------------------------------------------------------------- the page */

export default function Home() {
  const lang = getLang();
  const t = getT(lang);
  return (
    <>
      <div className="bg-canvas">
        <div className="container-page pt-4 md:pt-5">
          {/* The first screen is the shop: one line, then the baskets. */}
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-8">
            <h1 className="display text-[1.75rem] md:text-[2.5rem]">{t("home.h1")}</h1>
            <div className="text-[13px] leading-snug text-ink-2 md:pb-1 md:text-right">
              <CountryPart fallback={<p className="text-sm font-medium">&nbsp;</p>}>
                {(local) => {
                  const listed = forCountry(getAllPairs(), local);
                  const typical = medianPct(listed.map((p) => p.savingsPct));
                  return (
                    <p className="text-sm font-medium text-ink">
                      <span className="num">{listed.length}</span>
                      {t("home.swapsSources", listed.length)}
                      {typical >= 10 ? (
                        <>
                          {t("home.typically")}
                          <span className="num">{formatPercent(typical, lang)}</span>
                          {t("home.cheaperPerUnit")}
                        </>
                      ) : (
                        "."
                      )}
                    </p>
                  );
                }}
              </CountryPart>
              <p className="hidden md:block">
                {t("home.noBrandPays")} {linksEarn() ? t("home.someEarn") : t("home.noneEarn")}{" "}
                <Link href="/how-we-verify" className="text-cobalt underline underline-offset-2">
                  {t("home.howWeCheck")}
                </Link>
              </p>
            </div>
          </div>
          <ShoppingCheckCta className="mt-3 md:mt-4" lang={lang} />
        </div>
      </div>
      <CountryPart>{(local) => <HomeBody local={local} />}</CountryPart>
    </>
  );
}

function HomeBody({ local }: { local: Local }) {
  const lang = local.lang;
  const t = getT(lang);
  const aisleName = (slug: CategorySlug, name: string) => (lang === "en" ? name : dict(lang).categories[slug].name);
  const categories = getCategoryStats((list) => forCountry(list, local))
    .filter((c) => c.count > 0)
    .map((c) => ({ ...c, name: aisleName(c.slug, c.name) }));
  const baskets = basketsFor(local);
  const hasBaskets = baskets.length > 0;
  const featured = featuredFor(local);
  const findings = pickFindings(local);
  const hasShelfLife = getShelfLife().length > 0;
  const faq = buildFaq(categories.map((c) => c.name), lang);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <div className="bg-canvas">
        {/* Padding, not the first section's margin, which would collapse out of the band and leave a white strip above it. */}
        <div className="container-page pt-4 pb-8 md:pb-10">
          {hasBaskets && (
            <section>
              <SectionHeading title={t("home.basket")} />
              <FeaturedBaskets list={baskets} lang={lang} />
            </section>
          )}

          <section className={hasBaskets ? "mt-8 md:mt-10" : ""}>
            <SectionHeading
              title={t("home.biggest")}
              links={[
                { href: "/biggest-savings", label: t("home.allSwaps") },
                { href: "/credits", label: t("home.photos") },
              ]}
            />
            <FeaturedPairs list={featured} eagerFirst={!hasBaskets} lang={lang} />
          </section>
        </div>
      </div>

      {findings.length > 0 && (
        <section className="container-page py-8 md:py-10">
          <SectionHeading title={t("home.why")} links={[{ href: "/why", label: t("home.allFindings") }]} />
          <div className="grid gap-3 md:grid-cols-3">
            {findings.map((c) => (
              <Finding key={c.id} claim={c} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {hasShelfLife && (
        <section className="border-t border-line">
          <div className="container-page py-8 md:py-10">
            <SectionHeading
              title={t("home.bulk")}
              body={t("home.bulkBody")}
              links={[
                { href: "/bulk", label: t("home.allBulk") },
                { href: "/why", label: t("home.allShelfLives") },
              ]}
            />
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {BULK_COLUMNS.map((advice) => {
                const rows = bulkRows(advice, local);
                if (!rows.length) return null;
                const [title, body] = dict(lang).home.columns[advice];
                return (
                  <div key={advice}>
                    <h3 className="text-lg">{title}</h3>
                    <p className="text-sm text-ink-2">{body}</p>
                    <ul className="mt-2">
                      {rows.map((r) => {
                        const body = (
                          <>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">{r.label}</span>
                              <span className="block text-[13px] text-ink-2">{r.keeps}</span>
                            </span>
                            {r.photo && <ProductThumb size="md" image={r.photo} brand={r.photoName} />}
                          </>
                        );
                        return (
                          <li key={r.id} className="border-t border-line">
                            {r.href ? (
                              <Link href={r.href} className="flex min-h-11 items-center gap-3 py-2 hover:underline">
                                {body}
                              </Link>
                            ) : (
                              <div className="flex min-h-11 items-center gap-3 py-2">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="bg-canvas">
        <div className="container-page py-8 md:py-10">
          <SectionHeading title={t("home.allAisles")} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {categories.map((c) => {
              const best = bestPhoto(forCountry(getPairsByCategory(c.slug), local));
              return (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="card group flex flex-col p-2 transition-colors hover:border-ink-2"
                >
                  <div className="aspect-[4/3]">
                    {best && isCutOut(best.photo) ? (
                      <ProductThumb
                        size="fill"
                        image={best.photo.src}
                        brand={c.name}
                        alt={best.name}
                        className="border-0!"
                        sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
                      />
                    ) : (
                      <AisleTile icon={c.icon} name={c.name} />
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-snug font-semibold group-hover:underline">{c.name}</p>
                  <p className="text-xs font-medium text-muted">
                    <span className="num">{c.count}</span>
                    {t("home.tileSwaps", c.count)}
                    <span className="num">{formatPercent(c.maxSavings, lang)}</span>
                    {t("home.tileCheaper")}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container-page flex flex-col gap-3 py-8 md:flex-row md:items-start md:justify-between md:gap-8">
          <h2 className="display text-xl md:text-2xl">{t("home.email")}</h2>
          <NewsletterForm source="home" />
        </div>
      </section>

      <section className="container-page pt-8 md:pt-10">
        <SectionHeading title={t("home.questions")} />
        <div className="grid gap-x-8 lg:grid-cols-2">
          {faq.map((f) => (
            <details key={f.q} className="group border-t border-line">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-2.5 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="text-lg leading-none text-muted group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-[68ch] pb-3 text-sm text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-ink-2">
          {t("home.missing")}{" "}
          <Link href="/suggest" className="font-medium text-cobalt underline underline-offset-2">
            {t("home.suggestIt")}
          </Link>
          .
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(faqLd) }} />
    </>
  );
}

function SectionHeading({
  title,
  body,
  links = [],
}: {
  title: string;
  body?: string;
  links?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <div className="max-w-2xl">
        <h2 className="display text-xl md:text-2xl">{title}</h2>
        {body && <p className="mt-1 text-sm text-ink-2 md:text-[15px]">{body}</p>}
      </div>
      {links.length > 0 && (
        <p className="flex gap-4 text-sm font-medium">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-cobalt underline-offset-2 hover:underline">
              {l.label}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
