"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { setSavedList, toggleSaved, useSavedList } from "@/lib/client/savedList";
import { setBuyingOften, useBuyingOften } from "@/lib/client/buyingOften";
import { useLocal } from "@/lib/client/country";
import type { Currency } from "@/lib/format";
import {
  frequencyFor,
  frequencyLabel,
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
  const perRestock = totalText(list.map((i) => ({ amount: i.savings, currency: i.currency })), local);

  if (!list.length) {
    return (
      <div className="mt-4 max-w-[62ch]">
        <p className="text-[15px] text-ink-2">
          Nothing saved yet. Press <span className="font-medium text-ink">Add to my savings list</span> on a swap or kit, or save a whole
          basket, and this page adds up what switching saves.
        </p>
        <p className="mt-4 flex flex-wrap gap-2">
          <Link href="/bundles" className="btn btn-primary">
            See the baskets
          </Link>
          <Link href="/biggest-savings" className="btn btn-ghost">
            See the biggest savings
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
    const url = `${window.location.origin}/my-list?items=${list.map((i) => i.slug).join(",")}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <>
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
                    {i.kind === "kit" ? "Kit: " : ""}
                    {i.detail}
                  </p>
                </div>
                <div className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1 md:text-right">
                  <LineFigure line={line} />
                </div>
                {line.how === "yearly" && (
                  <div className="col-span-2 col-start-2 row-start-3 flex flex-wrap items-center gap-x-2 gap-y-1 md:col-span-3 md:col-start-2 md:row-start-2">
                    <span className="text-[13px] font-medium text-ink-2">You buy it</span>
                    <FrequencySelect
                      value={line.often}
                      onChange={(next) => setBuyingOften(i.slug, next)}
                      label={`How often you buy ${i.from}`}
                    />
                    <span className={`text-[13px] text-muted ${line.chosen ? "invisible" : ""}`} aria-hidden={line.chosen || undefined}>
                      Assumed
                    </span>
                  </div>
                )}
                {!viewingShared && (
                  <button
                    type="button"
                    onClick={() => toggleSaved(i.slug)}
                    aria-label={`Remove ${i.from} from my list`}
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
              Restocking {list.length === 1 ? "this one" : `all ${list.length}`} once
            </p>
            <Ticket size="lg" className="mt-2 whitespace-normal!">
              Save {perRestock}
            </Ticket>
            <p className="mt-3 text-[13px] leading-snug text-ink-2">
              Per brand-name pack for a swap and per kit for a kit, at the dated prices on each page.
            </p>
          </div>
          {viewingShared ? (
            <button type="button" onClick={() => setSavedList([...saved, ...shared])} className="btn btn-primary w-full">
              Save these to my list
            </button>
          ) : (
            <button type="button" onClick={copyLink} className="btn btn-ghost w-full">
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? "Link copied" : "Copy a link to this list"}
            </button>
          )}
          <p className="text-xs text-muted">Your list and how often you buy each thing stay in this browser. We don&apos;t store them.</p>
        </aside>
      </div>
    </>
  );
}

/** The line's own figure: what it saves in a year, once, or per wash. */
function LineFigure({ line }: { line: Counted }) {
  const i = line.item;
  if (line.how === "yearly") {
    return (
      <p>
        <span className="price text-[1.375rem] text-ink tabular-nums">
          <Money n={line.amount} from={i.currency} />
        </span>
        <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">a year, {Math.round(i.savingsPct)}% less</span>
      </p>
    );
  }
  if (line.how === "once") {
    return (
      <p>
        <span className="price text-[1.375rem] text-ink">
          <Money n={line.amount} from={i.currency} />
        </span>
        <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">once, {Math.round(i.savingsPct)}% less</span>
      </p>
    );
  }
  return (
    <p>
      <span className="price text-[1.375rem] text-ink">
        <Money n={i.savings} from={i.currency} />
      </span>
      <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">
        {line.per}, {Math.round(i.savingsPct)}% less
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
  const assumed = yearly.filter((l) => !l.chosen);
  const onceText = once.length ? totalText(amounts(once), local) : null;
  const notes: string[] = [];

  if (yearly.length && assumed.length) {
    const label = frequencyLabel(assumed[0].often);
    const which =
      assumed.length === yearly.length
        ? yearly.length === 1
          ? "This assumes you buy the brand-name pack"
          : "This assumes you buy each brand-name pack"
        : `For ${assumed.length} of the ${yearly.length} swaps, this assumes you buy the brand-name pack`;
    notes.push(`${which} ${label}. We can't know, so set how often below.`);
  } else if (yearly.length) {
    notes.push("At how often you said you buy each brand-name pack, at the dated prices on each page.");
  }
  if (onceText && yearly.length) notes.push(`Plus ${onceText} once, from ${onceWhat(once)}.`);
  if (perAmount) notes.push(`${perAmount === 1 ? "One swap is" : `${perAmount} swaps are`} priced per wash or per amount, with no pack to count, so ${perAmount === 1 ? "it isn't" : "they aren't"} in it.`);

  return (
    <div className="card mt-4 p-4 md:mt-6 md:p-5">
      {yearly.length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
          Your list saves
          <Ticket size="lg" className="whitespace-normal!">
            {totalText(amounts(yearly), local)} a year
          </Ticket>
        </p>
      ) : onceText ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg font-semibold md:text-xl">
          Your list saves
          <Ticket size="lg" className="whitespace-normal!">
            {onceText} once
          </Ticket>
        </p>
      ) : (
        <p className="text-lg font-semibold md:text-xl">Nothing on your list has a pack to count over a year.</p>
      )}
      {notes.length > 0 && <p className="mt-3 max-w-[70ch] text-[13px] leading-snug text-ink-2 md:text-sm">{notes.join(" ")}</p>}
    </div>
  );
}

function onceWhat(once: Counted[]) {
  const kits = once.filter((l) => l.item.kind === "kit").length;
  const things = once.length - kits;
  const parts = [
    kits ? (kits === 1 ? "a kit" : `${kits} kits`) : null,
    things ? (things === 1 ? "a thing you buy once" : `${things} things you buy once`) : null,
  ].filter(Boolean);
  return parts.join(" and ");
}
