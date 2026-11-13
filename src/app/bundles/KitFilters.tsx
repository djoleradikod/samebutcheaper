"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { filterKits, KIT_SORTS, type KitFacts, type KitSort } from "@/lib/kit-filter";
import { useT } from "@/lib/i18n/client";
import { kits } from "@/lib/i18n/en/client/kits";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { kits };

export type KitItem = KitFacts & { node: ReactNode };

/**
 * The kits with the filters a buyer cares about: one store only, aisle, and the saving after delivery, as an amount
 * or a share. The cards render on the server; this only picks and orders them, so the list stays fast.
 * With no filter and the default order, the kits stay grouped by aisle.
 */
export function KitFilters({ items, aisles, sub }: { items: KitItem[]; aisles: { slug: string; name: string }[]; /** Under a section heading of its own, so aisles are h3. */ sub: boolean }) {
  const t = useT(TEXT);
  const [aisle, setAisle] = useState("all");
  const [oneStore, setOneStore] = useState(false);
  const [sort, setSort] = useState<KitSort>("recommended");
  const present = aisles.filter((a) => items.some((i) => i.aisle === a.slug));
  const activeAisle = present.some((a) => a.slug === aisle) ? aisle : "all";
  const shown = filterKits(items, { aisle: activeAisle, oneStore, sort });
  const oneStoreCount = filterKits(items, { aisle: activeAisle, oneStore: true, sort }).length;
  const grouped = activeAisle === "all" && sort === "recommended";

  const grid = (list: KitItem[]) => (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
      {list.map((i) => (
        <div key={i.slug} className="min-w-0">
          {i.node}
        </div>
      ))}
    </div>
  );

  return (
    <div className="container-page pt-4">
      <div role="group" aria-label={t("kits.filterSort")} className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
        <label
          className={`col-span-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-tile border px-3 text-sm font-semibold md:col-span-1 ${oneStore ? "border-ink bg-paper" : "border-line-strong bg-paper"}`}
        >
          <input type="checkbox" checked={oneStore} onChange={(e) => setOneStore(e.target.checked)} className="h-4 w-4 accent-ink" />
          {t("kits.oneStoreOnly")} <span className="num font-medium text-muted">{oneStoreCount}</span>
        </label>
        {present.length > 1 && (
          <Select label={t("kits.aisle")} value={activeAisle} onChange={setAisle}>
            <option value="all">{t("kits.allAisles")}</option>
            {present.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
        <Select label={t("kits.sortKits")} value={sort} onChange={(v) => setSort(v as KitSort)}>
          {KIT_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(`kits.sorts.${s.value}`)}
            </option>
          ))}
        </Select>
        <p className="col-span-2 text-sm text-ink-2 md:ml-auto" aria-live="polite">
          {t("kits.count", shown.length)}
        </p>
      </div>

      {shown.length === 0 && (
        <p className="mt-4 text-[15px] text-ink-2">
          {t("kits.noOneStore")}{" "}
          <button type="button" onClick={() => setOneStore(false)} className="font-semibold text-cobalt underline underline-offset-2">
            {t("kits.showEvery")}
          </button>
        </p>
      )}

      {grouped
        ? present.map((a) => {
            const list = shown.filter((i) => i.aisle === a.slug);
            if (!list.length) return null;
            return (
              <section key={a.slug} id={a.slug} className="scroll-mt-24 pt-6">
                {sub ? <h3 className="mb-3 text-lg">{a.name}</h3> : <h2 className="display mb-3 text-xl md:text-2xl">{a.name}</h2>}
                {grid(list)}
              </section>
            );
          })
        : <div className="pt-5">{grid(shown)}</div>}
    </div>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full cursor-pointer appearance-none rounded-tile border border-line-strong bg-paper pr-8 pl-3 text-sm font-semibold text-ink"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </span>
    </label>
  );
}
