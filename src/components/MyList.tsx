"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";
import { setSavedList, toggleSaved, useSavedList } from "@/lib/client/savedList";
import { money, moneyTotals, type Currency } from "@/lib/format";

export type ListItem = {
  slug: string;
  href: string;
  kind: "swap" | "bundle";
  from: string;
  to: string;
  detail: string;
  savingsPct: number;
  savings: number;
  currency: Currency;
};

export function MyList({ items }: { items: ListItem[] }) {
  const params = useSearchParams();
  const saved = useSavedList();
  const [copied, setCopied] = useState(false);
  const shared = (params.get("items") ?? "").split(",").filter(Boolean);
  const viewingShared = shared.length > 0;
  const slugs = viewingShared ? shared : saved;
  const byslug = new Map(items.map((i) => [i.slug, i]));
  const list = slugs.map((s) => byslug.get(s)).filter((x): x is ListItem => Boolean(x));
  const perRestock = moneyTotals(list.map((i) => ({ amount: i.savings, currency: i.currency })));
  const perYear = moneyTotals(list.map((i) => ({ amount: i.savings * 12, currency: i.currency })));

  if (!list.length) {
    return (
      <div className="card mt-8 p-10 text-center">
        <p className="text-lg font-medium">Your savings list is empty.</p>
        <p className="mt-2 text-muted">
          Press <span className="font-medium text-ink">Add to my savings list</span> on any swap or bundle to
          add up what switching saves you.
        </p>
        <Link href="/biggest-savings" className="btn btn-primary mt-6">Browse the biggest savings</Link>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/my-list?items=${list.map((i) => i.slug).join(",")}`
      : "";

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
      <ul className="card divide-y divide-line">
        {list.map((i) => (
          <li key={i.slug} className="flex items-center gap-4 p-4">
            <Link href={i.href} className="min-w-0 flex-1">
              <p className="text-xs text-muted uppercase">{i.kind}</p>
              <p className="font-medium">
                <span className="text-ink-2">{i.from}</span> <span className="text-muted">→</span>{" "}
                <span className="text-accent">{i.to}</span>
              </p>
              <p className="truncate text-sm text-muted">{i.detail}</p>
            </Link>
            <div className="num text-right">
              <p className="font-semibold">{money(i.savings, i.currency)}</p>
              <p className="text-xs text-muted">{Math.round(i.savingsPct)}% less</p>
            </div>
            {!viewingShared && (
              <button
                type="button"
                onClick={() => toggleSaved(i.slug)}
                aria-label={`Remove ${i.from}`}
                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-warn"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="num rounded-2xl bg-ink p-6 text-paper">
          <p className="text-sm text-paper/70">Every time you restock all {list.length}</p>
          <p className="mt-1 text-4xl font-semibold text-highlight">{perRestock}</p>
          <p className="mt-4 text-sm text-paper/70">If you restock monthly, that&apos;s</p>
          <p className="text-2xl font-semibold">{perYear} a year</p>
        </div>
        {viewingShared ? (
          <button type="button" onClick={() => setSavedList([...saved, ...shared])} className="btn btn-primary w-full">
            Save these to my list
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl).then(() => setCopied(true), () => setCopied(false));
            }}
            className="btn btn-ghost w-full"
          >
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy a link to share this list"}
          </button>
        )}
        <p className="text-xs text-muted">
          Savings are per pack (swaps) or per bundle, at the prices shown on each page. Your list is stored in
          this browser only.
        </p>
      </aside>
    </div>
  );
}
