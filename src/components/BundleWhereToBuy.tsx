"use client";

import { lookForQuery, storesFor, type LookFor, type MarketCode } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { deliversTo, separateSite } from "@/lib/sellers";
import { useT } from "@/lib/i18n/client";
import { pageKitWhere } from "@/lib/i18n/en/pages/kitWhere";
import { CountryPicker } from "./CountryPicker";

/** The English this component reads (src/lib/i18n/client-dict.ts); the German loads on German pages only. */
const TEXT = { pageKitWhere };
const german = () => import("@/lib/i18n/de/pages/kitWhere");

type Item = { retailer: string; retailerLabel: string; replaces: string; lookFor: LookFor };

/** Bundle version of WhereToBuy: one search phrase per item. */
export function BundleWhereToBuy({
  slug,
  market,
  items,
  health = false,
}: {
  slug: string;
  market: MarketCode;
  items: Item[];
  health?: boolean;
}) {
  const country = useCountry();
  const t = useT(TEXT, german);
  if (!country) return null;
  const blocked = items.filter((i) => deliversTo(i.retailer, market, country) !== "yes");

  if (!blocked.length) {
    return (
      <p className="text-[13px] text-ink-2">
        {country === market ? t("pageKitWhere.allSell", country) : t("pageKitWhere.allDeliver", country)}
      </p>
    );
  }

  const stores = storesFor(country)
    .filter((s) => !s.aisles)
    .slice(0, 2);
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <h2 className="text-sm">{t("pageKitWhere.buyingIn", country)}</h2>
        <CountryPicker />
      </div>
      <div className="p-4 text-sm">
        <p className="text-ink-2">{t("pageKitWhere.checkedIn", market, country)}</p>
        <ul className="mt-2 divide-y divide-line">
          {blocked.map((item, i) => {
            const q = lookForQuery(item.lookFor, country);
            const own = separateSite(item.retailer, country);
            return (
              <li key={i} className="py-2">
                <p className="text-xs text-muted">{t("pageKitWhere.insteadOf", item.replaces)}</p>
                <p className="mt-0.5 font-semibold">{q}</p>
                <p className="flex flex-wrap gap-x-3 text-[13px]">
                  {own && (
                    <a
                      href={own}
                      target="_blank"
                      rel="nofollow noopener"
                      className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-7"
                    >
                      {t("pageKitWhere.storeIn", item.retailerLabel, country)}
                    </a>
                  )}
                  {stores.map((s) => (
                    <a
                      key={s.id}
                      href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(q)}&from=${slug}`}
                      target="_blank"
                      rel="sponsored nofollow noopener"
                      className="inline-flex min-h-11 items-center font-medium text-cobalt underline underline-offset-2 md:min-h-7"
                    >
                      {t("pageKitWhere.search", s.name)}
                    </a>
                  ))}
                </p>
              </li>
            );
          })}
        </ul>
        {health && (
          <p className="mt-2 text-xs leading-relaxed text-ink-2">{t("pageKitWhere.medicine", market)}</p>
        )}
      </div>
    </div>
  );
}
