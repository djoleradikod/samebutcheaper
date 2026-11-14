"use client";

import { MapPin, Search } from "lucide-react";
import { COUNTRIES, flag, lookForQuery, storesFor, type LookFor } from "@/lib/markets";
import { useCountry } from "@/lib/client/country";
import { CountryPicker } from "./CountryPicker";
import { useT } from "@/lib/i18n/client";
import type { ClientT } from "@/lib/i18n/client-dict";
import { pageLookup } from "@/lib/i18n/en/pages/lookup";

/** The English this file reads (src/lib/i18n/client-dict.ts); the German loads on German pages only. */
const TEXT = { pageLookup };
const german = () => import("@/lib/i18n/de/pages/lookup");

/** "Find the same thing where you live": the search phrase plus store links for the shopper's country. */
export function LocalSearch({
  lookFor,
  from,
  note,
  medicine = false,
}: {
  lookFor: LookFor;
  from: string;
  note?: string;
  medicine?: boolean;
}) {
  const country = useCountry();
  const t: ClientT<typeof TEXT> = useT(TEXT, german);
  const pharmacy = country ? t("pageLookup.pharmacy", country) : null;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <MapPin className="h-4 w-4 text-accent" />
          {country ? t("pageLookup.findIn", country, flag(country)) : t("pageLookup.findWhere")}
        </p>
        <CountryPicker withName />
      </div>
      {country ? (
        <div className="space-y-3 p-5 text-sm">
          <p className="text-ink-2">{t("pageLookup.searchThis")}</p>
          <p className="rounded-xl border border-accent/30 bg-accent-soft/50 px-3 py-2 font-semibold text-accent-strong">
            {lookForQuery(lookFor, country)}
          </p>
          {note && <p className="text-xs leading-relaxed text-muted">{note}</p>}
          {medicine && pharmacy && <p className="text-xs leading-relaxed text-muted">{pharmacy}</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {/* This product has no aisle, so a store that only suits some aisles stays out. */}
            {storesFor(country)
              .filter((s) => !s.aisles)
              .map((s) => (
              <li key={s.id}>
                <a
                  href={`/out?s=${s.id}&c=${country}&q=${encodeURIComponent(lookForQuery(lookFor, country))}&from=${from}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:border-accent"
                >
                  <span className="font-medium">{t("pageLookup.searchStore", s.name)}</span>
                  <Search className="h-4 w-4 shrink-0 text-accent" />
                </a>
              </li>
            ))}
          </ul>
          {!COUNTRIES[country]?.amazon && (
            <p className="text-xs text-muted">{t("pageLookup.ownLabel")}</p>
          )}
        </div>
      ) : (
        <p className="p-5 text-sm text-muted">{t("pageLookup.chooseCountry")}</p>
      )}
    </div>
  );
}
