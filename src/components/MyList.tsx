"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { setSavedList, toggleSaved, useSavedList } from "@/lib/client/savedList";
import { useLocal } from "@/lib/client/country";
import { money, type Currency } from "@/lib/format";
import type { Local } from "@/lib/localize";
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
};

/**
 * One figure in the shopper's currency, marked as approximate if any line had to be converted. With no country there's
 * no currency to convert into, so each currency keeps its own total rather than adding pounds to euros.
 */
function restockText(list: ListItem[], local: Local) {
  if (!local.known) {
    const totals = new Map<Currency, number>();
    for (const i of list) totals.set(i.currency, (totals.get(i.currency) ?? 0) + i.savings);
    return [...totals].map(([currency, total]) => money(total, currency)).join(" + ");
  }
  const total = money(list.reduce((sum, i) => sum + local.amount(i.savings, i.currency), 0), local.currency);
  return list.some((i) => local.converts(i.currency)) ? `about ${total}` : total;
}

export function MyList({ items }: { items: ListItem[] }) {
  const params = useSearchParams();
  const saved = useSavedList();
  const [copied, setCopied] = useState(false);
  const shared = (params.get("items") ?? "").split(",").filter(Boolean);
  const viewingShared = shared.length > 0;
  const slugs = viewingShared ? shared : saved;
  const byslug = new Map(items.map((i) => [i.slug, i]));
  const list = slugs.map((s) => byslug.get(s)).filter((x): x is ListItem => Boolean(x));
  const local = useLocal();
  const perRestock = restockText(list, local);

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

  const copyLink = () => {
    const url = `${window.location.origin}/my-list?items=${list.map((i) => i.slug).join(",")}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <div className="mt-4 grid gap-4 md:mt-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <ul className="card divide-y divide-line">
        {list.map((i) => (
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
            <p className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 md:text-right">
              <span className="price text-[1.375rem] text-ink"><Money n={i.savings} from={i.currency} /></span>
              <span className="ml-1.5 text-xs font-medium text-ink-2 md:ml-0 md:block">{Math.round(i.savingsPct)}% less</span>
            </p>
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
        ))}
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
        <p className="text-xs text-muted">Your list stays in this browser. We don&apos;t store it.</p>
      </aside>
    </div>
  );
}
