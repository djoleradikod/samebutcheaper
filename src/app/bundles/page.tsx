import type { Metadata } from "next";
import Link from "@/components/CountryLink";
import { countryHead } from "@/lib/seo-catalog";
import { BasketCard } from "@/components/BasketCard";
import { BundleCard } from "@/components/BundleCard";
import { isMedicineBasket, toBasketSummary } from "@/lib/basket-view";
import { getAllBundles, getAllPresets } from "@/lib/catalog";
import { kitCaution } from "@/lib/buy-list";
import { kitCanLeadNow, kitLeadFirst } from "@/lib/reported-state";
import { CATEGORIES } from "@/lib/categories";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import type { Bundle, Preset } from "@/lib/types";
import { MarketFirst } from "./MarketFirst";
import { KitFilters } from "./KitFilters";
import { forCountry, type Local } from "@/lib/localize";
import { CountryPart } from "@/components/ForCountry";
import { dict, getT } from "@/lib/i18n";
import { countryAt } from "@/lib/i18n/de/client";

export const metadata: Metadata = {
  title: "Baskets and brand kits, priced both ways",
  description:
    "Whole shopping baskets and brand kits rebuilt from cheaper products. Totals buy the same amount on both sides, and every item links to what we have on file for it.",
  ...countryHead("/bundles", null),
};

const jump =
  "inline-flex min-h-11 items-center gap-1.5 rounded-tile border border-line bg-paper px-3 text-sm font-medium hover:border-ink-2 md:min-h-9";

/** Markets with the most baskets first. Everyday baskets first within each, medicine last. */
function basketsByMarket(presets: Preset[]) {
  const groups = new Map<MarketCode, Preset[]>();
  for (const m of MARKET_CODES) {
    const list = presets.filter((p) => p.market === m);
    if (list.length) {
      groups.set(
        m,
        [...list].sort((a, b) => Number(isMedicineBasket(a)) - Number(isMedicineBasket(b)) || b.score - a.score),
      );
    }
  }
  return [...groups].sort((a, b) => b[1].length - a[1].length);
}

/** Kits shoppers haven't reported as changed, then without a caution, then with real photos, then the biggest saving. */
function kitOrder(a: Bundle, b: Bundle) {
  const photos = (x: Bundle) => x.components.filter((c) => c.photo).length + (x.photo ? 1 : 0);
  return kitLeadFirst(a, b) || Number(!!kitCaution(a)) - Number(!!kitCaution(b)) || photos(b) - photos(a) || b.score - a.score;
}

export default function BundlesPage() {
  return <CountryPart>{(local) => <BundlesBody local={local} />}</CountryPart>;
}

/** The heading itself depends on the country: a shopper with no baskets gets "Brand kits". */
function BundlesBody({ local }: { local: Local }) {
  const lang = local.lang;
  const t = getT(lang);
  const presets = forCountry(getAllPresets(), local);
  const bundles = forCountry(getAllBundles(), local);
  const markets = basketsByMarket(presets);
  const aisles = CATEGORIES.map((c) => ({
    ...c,
    ...(lang === "en" ? {} : { name: dict(lang).categories[c.slug].name }),
    kits: bundles.filter((b) => b.category === c.slug).sort(kitOrder),
  })).filter((c) => c.kits.length > 0);

  if (!presets.length && !bundles.length) {
    return (
      <section className="container-page py-8 md:py-12">
        <h1 className="display text-[1.75rem] md:text-[2.5rem]">{t("bundlesPage.both")}</h1>
        <p className="mt-3 max-w-[62ch] text-[15px] text-ink-2">{t("bundlesPage.none")}</p>
        <p className="mt-4 flex flex-wrap gap-2">
          <Link href="/biggest-savings" className="btn btn-primary">
            {t("bundlesPage.seeBiggest")}
          </Link>
          <Link href="/suggest" className="btn btn-ghost">
            {t("bundlesPage.suggestKit")}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="border-b border-line bg-canvas">
        <div className="container-page pt-4 pb-5 md:pt-6 md:pb-6">
          <h1 className="display text-[1.75rem] md:text-[2.5rem]">{presets.length ? t("bundlesPage.both") : t("bundlesPage.kitsOnly")}</h1>
          <p className="mt-1.5 max-w-[68ch] text-[15px] text-ink-2 md:text-base">
            {presets.length > 0 && (
              <>
                <span className="num">{presets.length}</span>
                {t("bundlesPage.baskets", presets.length)}
              </>
            )}
            {bundles.length > 0 && (
              <>
                <span className="num">{bundles.length}</span>
                {t("bundlesPage.kits", bundles.length)}
              </>
            )}
          </p>
          {(presets.length > 0 || aisles.length > 1) && (
            <nav aria-label={t("bundlesPage.onThisPage")} className="mt-3 flex flex-wrap gap-1.5">
              {presets.length > 0 && (
                <a href="#baskets" className={jump}>
                  {t("bundlesPage.basketsJump")} <span className="num font-normal text-muted">{presets.length}</span>
                </a>
              )}
              {aisles.map((a) => (
                <a key={a.slug} href={`#${a.slug}`} className={jump}>
                  {t("bundlesPage.aisleKits", a.name)} <span className="num font-normal text-muted">{a.kits.length}</span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      {presets.length > 0 && (
        <div id="baskets" className="scroll-mt-24">
          <MarketFirst
            groups={markets.map(([market, list], g) => ({
              market,
              node: (
                <section className="container-page pt-6 md:pt-8">
                  <h2 className="display mb-3 text-xl md:text-2xl">{t("bundlesPage.pricedIn", lang === "en" ? MARKETS[market].short : countryAt(market))}</h2>
                  <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((p, i) => (
                      <BasketCard key={p.slug} basket={toBasketSummary(p, undefined, lang)} eager={g === 0 && i === 0} lang={lang} />
                    ))}
                  </div>
                </section>
              ),
            }))}
          />
        </div>
      )}

      {aisles.length > 0 && (
        <div className={presets.length ? "mt-8 border-t border-line md:mt-10" : ""}>
          {presets.length > 0 && (
            <div className="container-page pt-6 md:pt-8">
              <h2 className="display text-xl md:text-2xl">{t("bundlesPage.kitsHeading")}</h2>
              <p className="mt-1 max-w-[68ch] text-sm text-ink-2 md:text-[15px]">{t("bundlesPage.kitsIntro")}</p>
            </div>
          )}
          <KitFilters
            sub={presets.length > 0}
            aisles={aisles.map((a) => ({ slug: a.slug, name: a.name }))}
            items={aisles
              .flatMap((a) => a.kits)
              .map((b, rank) => ({
                slug: b.slug,
                aisle: b.category,
                oneStore: b.checkout.stores.length === 1,
                net: local.amount(b.netSavings, b.currency),
                netPct: b.netSavingsPct,
                rank,
                ...(kitCanLeadNow(b) ? {} : { stale: true }),
                node: <BundleCard bundle={b} lang={lang} />,
              }))}
          />
        </div>
      )}

      <p className="container-page flex gap-4 pt-6 text-sm font-medium">
        <Link href="/how-we-verify" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-0">
          {t("lists.howWeCheck")}
        </Link>
        <Link href="/credits" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-0">
          {t("lists.photos")}
        </Link>
      </p>
    </>
  );
}
