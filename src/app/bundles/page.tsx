import type { Metadata } from "next";
import Link from "next/link";
import { BasketCard } from "@/components/BasketCard";
import { BundleCard } from "@/components/BundleCard";
import { isMedicineBasket, toBasketSummary } from "@/lib/basket-view";
import { getAllBundles, getAllPresets } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/categories";
import { MARKET_CODES, MARKETS, type MarketCode } from "@/lib/markets";
import type { Bundle, Preset } from "@/lib/types";
import { MarketFirst } from "./MarketFirst";
import { forCountry } from "@/lib/localize";
import { getCountry } from "@/lib/server-country";

export const metadata: Metadata = {
  title: "Baskets and brand kits, priced both ways",
  description:
    "Whole shopping baskets and brand kits rebuilt from cheaper products. Totals buy the same amount on both sides, and every item links to what we have on file for it.",
  alternates: { canonical: "/bundles" },
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

/** Kits with real photos first, then the biggest saving. */
function kitOrder(a: Bundle, b: Bundle) {
  const photos = (x: Bundle) => x.components.filter((c) => c.photo).length + (x.photo ? 1 : 0);
  return photos(b) - photos(a) || b.score - a.score;
}

export default async function BundlesPage() {
  const country = await getCountry();
  const presets = forCountry(getAllPresets(), country);
  const bundles = forCountry(getAllBundles(), country);
  const markets = basketsByMarket(presets);
  const aisles = CATEGORIES.map((c) => ({
    ...c,
    kits: bundles.filter((b) => b.category === c.slug).sort(kitOrder),
  })).filter((c) => c.kits.length > 0);

  if (!presets.length && !bundles.length) {
    return (
      <section className="container-page py-8 md:py-12">
        <h1 className="display text-[1.75rem] md:text-[2.5rem]">Baskets and brand kits</h1>
        <p className="mt-3 max-w-[62ch] text-[15px] text-ink-2">
          None are listed yet. The single swaps are ready, and if a kit costs you too much you can tell us which one.
        </p>
        <p className="mt-4 flex flex-wrap gap-2">
          <Link href="/biggest-savings" className="btn btn-primary">
            See the biggest savings
          </Link>
          <Link href="/suggest" className="btn btn-ghost">
            Suggest a kit
          </Link>
        </p>
      </section>
    );
  }

  return (
    <>
      <div className="border-b border-line bg-canvas">
        <div className="container-page pt-4 pb-5 md:pt-6 md:pb-6">
          <h1 className="display text-[1.75rem] md:text-[2.5rem]">{presets.length ? "Baskets and brand kits" : "Brand kits"}</h1>
          <p className="mt-1.5 max-w-[68ch] text-[15px] text-ink-2 md:text-base">
            {presets.length > 0 && (
              <>
                <span className="num">{presets.length}</span> basket{presets.length === 1 ? "" : "s"} for a moment in life, built from
                swaps we&apos;ve checked. Both totals buy the same amount.{" "}
              </>
            )}
            {bundles.length > 0 && (
              <>
                <span className="num">{bundles.length}</span> brand kit{bundles.length === 1 ? "" : "s"} taken apart and rebuilt from
                cheaper items, one piece at a time.
              </>
            )}
          </p>
          {(presets.length > 0 || aisles.length > 1) && (
            <nav aria-label="On this page" className="mt-3 flex flex-wrap gap-1.5">
              {presets.length > 0 && (
                <a href="#baskets" className={jump}>
                  Baskets <span className="num font-normal text-muted">{presets.length}</span>
                </a>
              )}
              {aisles.map((a) => (
                <a key={a.slug} href={`#${a.slug}`} className={jump}>
                  {a.name} kits <span className="num font-normal text-muted">{a.kits.length}</span>
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
                  <h2 className="display mb-3 text-xl md:text-2xl">Baskets priced in {MARKETS[market].short}</h2>
                  <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((p, i) => (
                      <BasketCard key={p.slug} basket={toBasketSummary(p)} eager={g === 0 && i === 0} />
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
              <h2 className="display text-xl md:text-2xl">Brand kits, rebuilt from cheaper items</h2>
              <p className="mt-1 max-w-[68ch] text-sm text-ink-2 md:text-[15px]">
                Brands sell regimens, stacks and gift sets as one price. We match each piece with a cheaper product and add up the same
                amount.
              </p>
            </div>
          )}
          {aisles.map((a) => (
            <section key={a.slug} id={a.slug} className="container-page scroll-mt-24 pt-6">
              {presets.length > 0 ? (
                <h3 className="mb-3 text-lg">{a.name}</h3>
              ) : (
                <h2 className="display mb-3 text-xl md:text-2xl">{a.name}</h2>
              )}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
                {a.kits.map((b) => (
                  <BundleCard key={b.slug} bundle={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="container-page flex gap-4 pt-6 text-sm font-medium">
        <Link href="/how-we-verify" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-0">
          How we check
        </Link>
        <Link href="/credits" className="inline-flex min-h-11 items-center text-cobalt underline-offset-2 hover:underline md:min-h-0">
          Photos
        </Link>
      </p>
    </>
  );
}
