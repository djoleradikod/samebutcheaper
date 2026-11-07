import Link from "next/link";
import { assignBasketPhotos, cutOutCount, photoCount, toBasketSummary } from "@/lib/basket-view";
import {
  bestPhoto,
  getAllPairs,
  getCategoryStats,
  getClaims,
  getFeaturedPairs,
  getPair,
  getPairsByCategory,
  getPresetsFor,
  getShelfLife,
  getSiteStats,
  NO_PHOTO_STANDING,
  photoStanding,
  pickByPhotos,
  showsOnlyCutOuts,
  toSummary,
} from "@/lib/catalog";
import { AisleTile } from "@/components/CategoryIcon";
import { FeaturedBaskets, FeaturedPairs } from "@/components/FeaturedPairs";
import { Finding, findingExcerpt } from "@/components/Finding";
import { NewsletterForm } from "@/components/NewsletterForm";
import { ProductThumb } from "@/components/ProductThumb";
import { inSentence } from "@/lib/format";
import { MARKET_CODES, type MarketCode } from "@/lib/markets";
import type { CategorySlug, Claim, PairSummary, Preset, ShelfLife } from "@/lib/types";

const MEDICINE: CategorySlug = "otc-medicine";

/* ------------------------------------------------------------ what the page shows */

function perMarket<T>(pick: (market: MarketCode) => T[]) {
  const out: Partial<Record<MarketCode, T[]>> = {};
  for (const m of MARKET_CODES) {
    const list = pick(m);
    if (list.length) out[m] = list;
  }
  return out;
}

function isMedicine(line: Preset["lines"][number]) {
  return getPair(line.pair)?.category === MEDICINE;
}

/**
 * The shopper's market first, then the baskets with enough cut-outs for a full collage, then any with a
 * photo. Across the row no picture shows twice (see assignBasketPhotos).
 */
function basketsFor(market: MarketCode) {
  const photoRank = (p: Preset) => (cutOutCount(p) >= 3 ? 0 : photoCount(p) > 0 ? 1 : 2);
  const rank = (p: Preset) => (p.market === market ? 0 : 3) + photoRank(p);
  const chosen = getPresetsFor(market)
    .filter((p) => p.icon !== "pill" && p.lines.filter(isMedicine).length * 2 <= p.lines.length)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 6);
  const photos = assignBasketPhotos(chosen);
  return chosen.map((p) => toBasketSummary(p, photos.get(p.slug)));
}

/**
 * Never medicine, including remedies filed under another aisle such as infant gas relief, and never a swap
 * with no photo. Cut-outs fill the grid first (see pickByPhotos), with a cap per aisle and per shelf so it
 * shows the range of the site, and within a photo standing it reads as a ranking: biggest saving first.
 */
function biggestSavings(market: MarketCode, limit = 12) {
  const pool = getFeaturedPairs(48, market).filter(
    (p) => photoStanding(p) < NO_PHOTO_STANDING && !/relief|remed|fever|allerg|cough/i.test(p.subcategory),
  );
  return pickByPhotos(pool, limit, (p) => [
    { key: p.category, max: p.category === "supplements" ? 2 : 6 },
    { key: `${p.category}:${p.subcategory.toLowerCase()}`, max: 2 },
  ]).sort((a, b) => photoStanding(a) - photoStanding(b) || b.savingsPct - a.savingsPct);
}

/**
 * One list per market, using the shopper's own prices when there are at least three swaps to show, filled
 * up from the US list. A raw snapshot only shows when there's no swap left without one, even from the US.
 */
function featuredLists(limit = 12) {
  const ranked = perMarket((m) => biggestSavings(m, limit));
  const us = ranked.US ?? [];
  const lists: Partial<Record<MarketCode, PairSummary[]>> = {};
  for (const m of MARKET_CODES) {
    const own = ranked[m] ?? [];
    if (m !== "US" && own.length < 3) continue;
    const merged = m === "US" ? own : [...own, ...us];
    lists[m] = [...merged.filter(showsOnlyCutOuts), ...merged.filter((p) => !showsOnlyCutOuts(p))]
      .slice(0, limit)
      .map(toSummary);
  }
  return lists;
}

const MENTIONS_MEDICINE = /medicin|medicat|drug|pharmac|headache|painkiller|remed/i;
const ABOUT_SWITCHING = /own[- ]label|own[- ]brand|store[- ]brand|cheap|beat/i;

/** Findings about switching, newest first, spread across publishers and countries. */
function pickFindings(limit = 3) {
  const date = (c: Claim) => (/^\d/.test(c.sources[0].date) ? c.sources[0].date : "");
  const ranked = getClaims()
    .filter(
      (c) =>
        !c.categories.includes(MEDICINE) && !MENTIONS_MEDICINE.test(`${c.title} ${findingExcerpt(c.finding)}`),
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
  return picked;
}

const BULK_COLUMNS: { advice: ShelfLife["advice"]; title: string; body: string }[] = [
  { advice: "stock_up", title: "Stock up", body: "Keeps for years, so a big pack is safe." },
  { advice: "buy_to_use", title: "Buy to use", body: "Fine in bulk if you get through it in time." },
  { advice: "buy_small", title: "Buy small", body: "Goes off or weakens, so skip the big pack." },
];

/** The headline figure of a shelf-life record, before its citations and exceptions. */
function keepsFor(unopened: string) {
  const clause = unopened.split(/\s\(|\.\s|,\s/)[0].replace(/\.$/, "");
  return clause.length > 60 ? clause.split(":")[0] : clause;
}

function bulkRows(advice: ShelfLife["advice"], limit = 5) {
  const pairs = getAllPairs().filter((p) => p.category !== MEDICINE);
  return getShelfLife()
    .filter((r) => r.advice === advice)
    .map((r) => {
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

function buildFaq(aisles: string[]) {
  const names = aisles.map(inSentence);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
  return [
    {
      q: "What do you compare?",
      a: `Everyday products where you can pay less for the same job. Today that means ${list}. Prices are compared per unit, so a big pack and a small pack can be judged fairly.`,
    },
    {
      q: "If two products do the same job, why does one cost more?",
      a: "A brand's price also pays for advertising, packaging and its place on the shelf. Sometimes the brand does earn the extra, and we show where it's better.",
    },
    {
      q: "How do you decide two products match?",
      a: "We only list a swap when the evidence fits one of four standards: the same active ingredient at the same strength, the same formula per the label, the same manufacturer, or an equivalent spec. Every swap says which standard it meets, lists what differs and links to at least two sources.",
    },
    {
      q: "Should I buy the biggest pack?",
      a: "Only if it's cheaper per unit and you'll use it before it goes off. Bigger packs usually cost less per unit, but not always.",
    },
    {
      q: "How do you make money?",
      a: "Some links are affiliate links, so we may earn a small commission if you buy, at no extra cost to you. No brand or store pays to be listed or ranked. Swaps are ranked by how much you save, and we show where the brand is better too.",
    },
    {
      q: "Are the prices current?",
      a: "Prices are typical shelf prices from the month shown on each swap, and they change often. Check the price at the store before you buy.",
    },
    {
      q: "Is any of this medical advice?",
      a: "No. For medicines and supplements, read the label and ask a pharmacist or doctor.",
    },
  ];
}

/* --------------------------------------------------------------------- the page */

export default function Home() {
  const stats = getSiteStats();
  const categories = getCategoryStats().filter((c) => c.count > 0);
  const baskets = perMarket(basketsFor);
  const hasBaskets = Object.keys(baskets).length > 0;
  const featured = featuredLists();
  const findings = pickFindings();
  const hasShelfLife = getShelfLife().length > 0;
  const faq = buildFaq(categories.map((c) => c.name));

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
        <div className="container-page pt-4 pb-8 md:pt-5 md:pb-10">
          {/* The first screen is the shop: one line, then the baskets. */}
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-8">
            <h1 className="display text-[1.75rem] md:text-[2.5rem]">Same job. Lower price.</h1>
            <div className="text-[13px] leading-snug text-ink-2 md:pb-1 md:text-right">
              <p className="text-sm font-medium text-ink">
                <span className="num">{stats.pairs}</span> swaps, each with at least two sources.
              </p>
              <p className="hidden md:block">
                No brand pays to be listed. Some links earn us a commission.{" "}
                <Link href="/how-we-verify" className="text-cobalt underline underline-offset-2">
                  How we check
                </Link>
              </p>
            </div>
          </div>

          {hasBaskets && (
            <section className="mt-4">
              <SectionHeading title="Swap a whole basket" />
              <FeaturedBaskets lists={baskets} />
            </section>
          )}

          <section className={hasBaskets ? "mt-8 md:mt-10" : "mt-4"}>
            <SectionHeading
              title="Biggest savings"
              links={[
                { href: "/biggest-savings", label: "All swaps" },
                { href: "/credits", label: "Photos" },
              ]}
            />
            <FeaturedPairs lists={featured} eagerFirst={!hasBaskets} />
          </section>
        </div>
      </div>

      {findings.length > 0 && (
        <section className="container-page py-8 md:py-10">
          <SectionHeading title="Why it's worth switching" links={[{ href: "/why", label: "All findings" }]} />
          <div className="grid gap-3 md:grid-cols-3">
            {findings.map((c) => (
              <Finding key={c.id} claim={c} />
            ))}
          </div>
        </section>
      )}

      {hasShelfLife && (
        <section className="border-t border-line">
          <div className="container-page py-8 md:py-10">
            <SectionHeading
              title="Buying in bulk"
              body="A bigger pack only saves money if it's cheaper per unit and you'll use it before it goes off. These are for unopened packs."
              links={[{ href: "/why", label: "All shelf lives, with sources" }]}
            />
            <div className="grid gap-6 md:grid-cols-3 md:gap-8">
              {BULK_COLUMNS.map((col) => {
                const rows = bulkRows(col.advice);
                if (!rows.length) return null;
                return (
                  <div key={col.advice}>
                    <h3 className="text-lg">{col.title}</h3>
                    <p className="text-sm text-ink-2">{col.body}</p>
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
          <SectionHeading title="All aisles" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {categories.map((c) => {
              const best = bestPhoto(getPairsByCategory(c.slug));
              return (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  className="card group flex flex-col p-2 transition-colors hover:border-ink-2"
                >
                  <div className="aspect-[4/3]">
                    {best ? (
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
                    <span className="num">{c.count}</span> swap{c.count === 1 ? "" : "s"}, up to{" "}
                    <span className="num">{Math.round(c.maxSavings)}%</span> cheaper
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container-page flex flex-col gap-3 py-8 md:flex-row md:items-start md:justify-between md:gap-8">
          <h2 className="display text-xl md:text-2xl">Get new swaps by email</h2>
          <NewsletterForm source="home" />
        </div>
      </section>

      <section className="container-page pt-8 md:pt-10">
        <SectionHeading title="Questions" />
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
          Know a swap we&apos;re missing?{" "}
          <Link href="/suggest" className="font-medium text-cobalt underline underline-offset-2">
            Suggest it
          </Link>
          .
        </p>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
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
