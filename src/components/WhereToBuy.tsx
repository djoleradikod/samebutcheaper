"use client";

import { COUNTRIES, lookForQuery, pharmacyNote, storesFor, type LookFor, type MarketCode } from "@/lib/markets";
import { useT } from "@/lib/i18n/client";
import { useCountry } from "@/lib/client/country";
import { deliversTo, separateSite, sellsIn } from "@/lib/sellers";
import { CountryPicker } from "./CountryPicker";
import { shared } from "@/lib/i18n/en/client/shared";
import { where } from "@/lib/i18n/en/client/where";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { shared, where };

/** "walmart.ca" from the chain's national address, for a link that says where it goes. */
function siteName(url: string) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/(?:en-ca|en)?\/?$/, "");
  } catch {
    return url;
  }
}

/**
 * Tells shoppers whether the listed store delivers to their country, and if it doesn't, what to look for and where to search
 * locally. The rule is deliversTo in sellers.ts, the same one that decides whether the page links the store at all.
 */
export function WhereToBuy({
  slug,
  market,
  retailer,
  retailerLabel,
  lookFor,
  health = false,
  compareWith,
  aisle,
}: {
  slug: string;
  market: MarketCode;
  /** The seller as sellerOf gives it, or the retailer when they're the same. */
  retailer: string;
  retailerLabel: string;
  lookFor: LookFor;
  /** Medicines and supplements: add the "rules differ by country" caveat. */
  health?: boolean;
  /** Brand-name product to compare labels against, for non-ingredient matches. */
  compareWith?: string;
  /** Leaves out specialist stores for other aisles. */
  aisle?: string;
}) {
  const country = useCountry();
  const t = useT(TEXT);

  if (!country) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
        {t("where.pick", market)}
        <CountryPicker withName />
      </p>
    );
  }

  const delivery = deliversTo(retailer, market, country);

  if (delivery === "yes") {
    return (
      <p className="text-[13px] font-medium text-ink-2">
        {country === market ? t("where.sellsHere", retailerLabel, market) : t("where.deliversFrom", retailerLabel, market, country)}
      </p>
    );
  }

  const query = lookForQuery(lookFor, country);
  const amazon = COUNTRIES[country]?.amazon;
  const pharmacy = pharmacyNote(country) !== null;
  const stores = storesFor(country, aisle);
  const ownSite = separateSite(retailer, country);
  const status =
    delivery === "maybe"
      ? t("where.maybe", retailerLabel, market)
      : ownSite
        ? t("where.ownSite", retailerLabel, country, market)
        : sellsIn(retailer, country)
          ? t("where.sellsToo", retailerLabel, market, country)
          : t("where.noDelivery", market, country, !!lookFor.actives?.length);
  return (
    <div className="card overflow-hidden" aria-live="polite">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <p className="text-sm font-semibold">{t("where.buyingIn", country)}</p>
        <CountryPicker />
      </div>
      <div className="grid gap-x-6 gap-y-4 p-4 text-sm md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <p className="text-ink-2">{status}</p>
          <div>
            <p className="text-[13px] font-semibold text-ink-2">{t("where.lookForIn", country)}</p>
            <p className="mt-1 rounded-tile border border-line-strong bg-canvas px-3 py-2 text-base font-semibold break-words">{query}</p>
          </div>
          <p className="text-[13px] text-muted">
            {lookFor.actives?.length ? t("where.sameActives") : compareWith ? t("where.compareLabel", compareWith) : t("where.storeBrands")}
            {health && t("where.medicineRules", market)}
            {health && pharmacy && ` ${t("shared.pharmacy")}`}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-2">{t("where.searchStores", country)}</p>
          <ul className="mt-1 divide-y divide-line border-y border-line">
            {ownSite && (
              <li>
                <a
                  href={ownSite}
                  target="_blank"
                  rel="nofollow noopener"
                  className="flex min-h-11 items-center font-medium text-cobalt hover:underline"
                >
                  {t("where.goTo", retailerLabel, siteName(ownSite))}
                </a>
              </li>
            )}
            {stores.map((s) => (
              <li key={s.id}>
                <a
                  href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(query)}&from=${slug}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="flex min-h-11 items-center font-medium text-cobalt hover:underline"
                >
                  {t("where.search", s.name)}
                </a>
              </li>
            ))}
          </ul>
          {!amazon && (
            <p className="mt-2 text-[13px] text-muted">{t("where.noBigStore", country)}</p>
          )}
          <p className="mt-2 text-[13px] text-muted">{t("where.checkedIn", market)}</p>
        </div>
      </div>
    </div>
  );
}
