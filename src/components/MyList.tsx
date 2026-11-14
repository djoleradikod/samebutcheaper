"use client";

import Link from "@/components/CountryLink";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { setSavedList, toggleSaved, useSavedList } from "@/lib/client/savedList";
import { setBuyingOften, useBuyingOften } from "@/lib/client/buyingOften";
import { useLocal } from "@/lib/client/country";
import type { Currency } from "@/lib/format";
import {
  frequencyFor,
  totalText,
  yearlySaving,
  type FrequencyId,
  type OftenChoices,
  type SavingKind,
  type SwapPrices,
} from "@/lib/yearly";
import { FrequencySelect } from "./FrequencySelect";
import { Money } from "./Money";
import type { CategorySlug } from "@/lib/types";
import { ProductThumb } from "./ProductThumb";
import { Ticket } from "./Ticket";
import { ToArrow } from "./UnitPrice";
import { offlineDate, savedAt } from "@/lib/offline";
import { useLang, useT } from "@/lib/i18n/client";
import type { ClientT } from "@/lib/i18n/client-dict";
import { myList } from "@/lib/i18n/en/client/myList";
import { yearly as yearlyText } from "@/lib/i18n/en/client/yearly";
import { pageMyList } from "@/lib/i18n/en/pages/myList";
import { rich } from "@/lib/i18n/rich";

/** The English this component reads (src/lib/i18n/client-dict.ts); the page section's German loads on German pages only. */
const TEXT = { myList, yearly: yearlyText, pageMyList };
const german = () => import("@/lib/i18n/de/pages/myList");
const useListT = (): ClientT<typeof TEXT> => useT(TEXT, german);

export type ListItem = {
  slug: string;
  href: string;
  kind: "swap" | "kit";
  from: string;
  to: string;
  detail: string;
  savingsPct: number;
  savings: number;
  currency: Currency;
  category: CategorySlug;
  unit?: string;
  fromPhoto: string | null;
  fromAlt: string;
  toPhoto: string | null;
  toAlt: string;
  /** What the yearly figure needs (see src/lib/yearly.ts). Null for a kit, which counts once. */
  yearly: { kind: SavingKind; prices: SwapPrices; pack: string; per: string } | null;
};

/** One line as the totals count it: a year of it, a one-off, or a record priced per wash with no pack to count. */
type Counted =
  | { item: ListItem; how: "yearly"; amount: number; often: FrequencyId; chosen: boolean }
  | { item: ListItem; how: "once"; amount: number }
  | { item: ListItem; how: "per-amount"; per: string };

function counted(item: ListItem, choices: OftenChoices): Counted {
  const y = item.yearly;
  if (!y || y.kind === "once") return { item, how: "once", amount: item.savings };
  if (y.kind === "per-amount") return { item, how: "per-amount", per: y.per };
  const { often, chosen } = frequencyFor(choices, item.slug);
  return { item, how: "yearly", amount: yearlySaving(y.prices, often), often, chosen };
}

const amounts = (lines: { amount: number; item: ListItem }[]) => lines.map((l) => ({ amount: l.amount, currency: l.item.currency }));

export function MyList({ items }: { items: ListItem[] }) {
  const params = useSearchParams();
  const saved = useSavedList();
  const choices = useBuyingOften();
  const [copied, setCopied] = useState(false);
  const shared = (params.get("items") ?? "").split(",").filter(Boolean);
  const viewingShared = shared.length > 0;
  const slugs = viewingShared ? shared : saved;
  const byslug = new Map(items.map((i) => [i.slug, i]));
  const list = slugs.map((s) => byslug.get(s)).filter((x): x is ListItem => Boolean(x));
  const local = useLocal();
  const t = useListT();
  const lang = useLang();
  const perRestock = totalText(list.map((i) => ({ amount: i.savings, currency: i.currency })), local);

  if (!list.length) {
    return (
      <div className="mt-4 max-w-[62ch]">
        <p className="text-[15px] text-ink-2">
          {rich(t("pageMyList.nothingSaved"), { button: <span className="font-medium text-ink">{t("pageMyList.addButton")}</span> })}
        </p>
        <p className="mt-4 flex flex-wrap gap-2">
          <Link href="/bundles" className="btn btn-primary">
            {t("pageMyList.seeBaskets")}
          </Link>
          <Link href="/biggest-savings" className="btn btn-ghost">
            {t("pageMyList.seeBiggest")}
          </Link>
        </p>
      </div>
    );
  }

  const lines = list.map((i) => counted(i, choices));
  const yearly = lines.filter((l) => l.how === "yearly");
  const once = lines.filter((l) => l.how === "once");
  const perAmount = lines.filter((l) => l.how === "per-amount");

  const copyLink = () => {
    const url = `${window.location.origin}${lang === "de" ? "/de" : ""}/my-list?items=${list.map((i) => i.slug).join(",")}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <>
      <OfflineNote />
      <Lead yearly={yearly} once={once} perAmount={perAmount.length} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <ul className="card divide-y divide-line">
          {lines.map((line) => {
            const i = line.item;
            return (
              <li
                key={i.slug}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto] md:items-center md:gap-x-4"
              >
                <div className="flex gap-1">
                  <ProductThumb size="xs" image={i.fromPhoto} brand={i.from} alt={i.fromAlt} category={i.category} unit={i.unit} className="md:h-16 md:w-16" sizes="(min-width: 768px) 64px, 44px" />
                  <ProductThumb size="xs" image={i.toPhoto} brand={i.to} alt={i.toAlt} category={i.category} unit={i.unit} className="md:h-16 md:w-16" sizes="(min-width: 768px) 64px, 44px" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] leading-snug font-semibold">
                    <Link href={i.href} className="hover:underline">
                      {i.from}
                      <ToArrow />
                      {i.to}
                    </Link>
                  </p>
                  <p className="text-[13px] leading-snug text-ink-2">
                    {i.kind === "kit" ? t("pageMyList.kit") : ""}
                    {i.detail}
                  </p>
                </div>
                <div className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1 md:text-right">
                  <LineFigure line={line} />
                </div>
                {line.how === "yearly" && (
                  <div className="col-span-2 col-start-2 row-start-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:col-span-3 md:col-start-2 md:row-start-2">
                    <span className="text-[13px] font-medium text-ink-2">{t("pageMyList.youBuyIt")}</span>
                    <FrequencySelect
                      value={line.often}
                      onChange={(next) => setBuyingOften(i.slug, next)}
                      label={t("pageMyList.howOften", i.from)}
                    />
                    <span className={`text-[13px] text-muted ${line.chosen ? "invisible" : ""}`} aria-hidden={line.chosen || undefined}>
                      {t("pageMyList.assumed")}
                    </span>
                  </div>
                )}
                {!viewingShared && (
                  <button
                    type="button"
                    onClick={() => toggleSaved(i.slug)}
                    aria-label={t("pageMyList.remove", i.from)}
                    className="col-start-3 row-start-1 grid h-11 w-11 place-items-center rounded-tile text-muted transition-colors hover:bg-canvas hover:text-ink md:col-start-4"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4">
            <p className="text-sm font-medium text-ink-2">
              {t("pageMyList.restocking", list.length)}
            </p>
            <Ticket size="lg" className="mt-2 whitespace-normal!">
              {t("pageMyList.saveAmount", perRestock)}
            </Ticket>
            <p className="mt-3 text-[13px] leading-snug text-ink-2">{t("pageMyList.perPackNote")}</p>
          </div>
          {viewingShared ? (
            <button type="button" onClick={() => setSavedList([...saved, ...shared])} className="btn btn-primary w-full">
              {t("pageMyList.saveThese")}
            </button>
          ) : (
            <button type="button" onClick={copyLink} className="btn btn-ghost w-full">
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? t("pageMyList.linkCopied") : t("pageMyList.copyList")}
            </button>
          )}
          <p className="text-xs text-muted">{t("pageMyList.staysHere")}</p>
        </aside>
      </div>
    </>
  );
}

/** The line's own figure: what it saves in a year, once, or per wash. */
function LineFigure({ line }: { line: Counted }) {
  const i = line.item;
  const t = useListT();
  if (line.how === "yearly") {
    return (
      <p>
        <span className="price text-[1.375rem] text-ink tabular-nums">
          <Money n={line.amount} from={i.currency} />
        </span>
        <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">{t("pageMyList.yearLess", i.savingsPct)}</span>
      </p>
    );
  }
  if (line.how === "once") {
    return (
      <p>
        <span className="price text-[1.375rem] text-ink">
          <Money n={line.amount} from={i.currency} />
        </span>
        <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">{t("pageMyList.onceLess", i.savingsPct)}</span>
      </p>
    );
  }
  return (
    <p>
      <span className="price text-[1.375rem] text-ink">
        <Money n={i.savings} from={i.currency} />
      </span>
      <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">
        {t("pageMyList.perLess", line.per, i.savingsPct)}
      </span>
    </p>
  );
}

/** What the page leads with: the year, built only from lines with a pack to count, and the one-offs beside it, never added in. */
function Lead({
  yearly,
  once,
  perAmount,
}: {
  yearly: Extract<Counted, { how: "yearly" }>[];
  once: Extract<Counted, { how: "once" }>[];
  perAmount: number;
}) {
  const local = useLocal();
  const t = useListT();
  const assumed = yearly.filter((l) => !l.chosen);
  const onceText = once.length ? totalText(amounts(once), local) : null;
  const notes: string[] = [];

  if (yearly.length && assumed.length) {
    notes.push(t("pageMyList.assumes", assumed.length, yearly.length, t(`yearly.frequencies.${assumed[0].often}`)));
  } else if (yearly.length) {
    notes.push(t("pageMyList.chosen"));
  }
  if (onceText && yearly.length) {
    const kits = once.filter((l) => l.item.kind === "kit").length;
    notes.push(t("pageMyList.plusOnce", onceText, kits, once.length - kits));
  }
  if (perAmount) notes.push(t("pageMyList.perAmount", perAmount));

  return (
    <div className="card mt-4 p-4 md:mt-6 md:p-5">
      {yearly.length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
          {t("pageMyList.listSaves")}
          <Ticket size="lg" className="whitespace-normal!">
            {t("pageMyList.perYear", totalText(amounts(yearly), local))}
          </Ticket>
        </p>
      ) : onceText ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
          {t("pageMyList.listSaves")}
          <Ticket size="lg" className="whitespace-normal!">
            {t("pageMyList.onceAmount", onceText)}
          </Ticket>
        </p>
      ) : (
        <p className="text-lg font-semibold md:text-xl">{t("pageMyList.nothingToCount")}</p>
      )}
      {notes.length > 0 && <p className="mt-3 max-w-[70ch] text-[13px] leading-snug text-ink-2 md:text-sm">{notes.join(" ")}</p>}
    </div>
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Offline, the service worker serves the last copy of this page (public/sw.js), so its prices are from then: say so,
 * with the date the copy was kept. Nothing while online.
 */
function OfflineNote() {
  const t = useListT();
  const lang = useLang();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [kept, setKept] = useState<string | null>(null);
  useEffect(() => {
    if (online || typeof caches === "undefined") return;
    let live = true;
    caches
      .match("/my-list")
      .then((res) => {
        const at = res ? savedAt(res.headers) : null;
        if (live && at) setKept(offlineDate(at, lang));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [online, lang]);
  if (online) return null;
  return (
    <p role="status" className="mt-4 rounded-card border border-line-strong bg-canvas px-4 py-3 text-sm font-medium text-ink-2">
      {t("myList.offline", kept)}
    </p>
  );
}
