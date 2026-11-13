"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, ShoppingCart } from "lucide-react";
import { buyListText, namesPack, type BuyStore } from "@/lib/buy-list";
import type { Checkout } from "@/lib/delivery";
import type { Currency } from "@/lib/format";
import { useLocal } from "@/lib/client/country";
import { DeliveryLine } from "./CheckoutCard";
import { Money } from "./Money";

/* Ticks live on this device only, one list per kit. */
const EVENT = "sbc:kit-ticks";
const keyFor = (slug: string) => `sbc:kit-ticks:${slug}`;
const cache = new Map<string, { raw: string | null; value: number[] }>();
const NONE: number[] = [];

function readTicks(slug: string): number[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(keyFor(slug));
  } catch {
    /* storage blocked */
  }
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.value;
  let value: number[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    value = Array.isArray(parsed) ? parsed.filter((x): x is number => Number.isInteger(x)) : [];
  } catch {
    value = [];
  }
  cache.set(slug, { raw, value });
  return value;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function writeTicks(slug: string, ticks: number[]) {
  try {
    if (ticks.length) window.localStorage.setItem(keyFor(slug), JSON.stringify([...new Set(ticks)].sort((a, b) => a - b)));
    else window.localStorage.removeItem(keyFor(slug));
  } catch {
    /* storage blocked: the ticks last until the page closes */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The kit's buying list: one block per store in checkout order, each piece a counted link with a tick box the
 * shopper sets once it's in their basket there, the store's subtotal and delivery, and a plain-text copy of it all.
 */
export function BundleBuyList({
  slug,
  title,
  url,
  currency,
  checkout,
  stores,
  checked,
}: {
  slug: string;
  title: string;
  url: string;
  currency: Currency;
  checkout: Checkout;
  stores: BuyStore[];
  checked: string;
}) {
  const local = useLocal();
  const ticks = useSyncExternalStore(subscribe, () => readTicks(slug), () => NONE);
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const total = stores.reduce((n, s) => n + s.pieces.length, 0);
  const done = stores.reduce((n, s) => n + s.pieces.filter((p) => ticks.includes(p.index)).length, 0);

  const toggle = (index: number) => writeTicks(slug, ticks.includes(index) ? ticks.filter((t) => t !== index) : [...ticks, index]);

  const copy = async () => {
    const text = buyListText({ title, url, stores, checkout, money: (n) => local.money(n, currency), checked });
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
    window.setTimeout(() => setCopied(null), 4000);
  };

  return (
    <section id="buy-list" aria-labelledby="buy-list-title" className="card scroll-mt-20">
      <div className="border-b border-line px-4 pt-3 pb-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="buy-list-title" className="text-base">
            Buying list
          </h2>
          <p className="text-[13px] font-medium text-ink-2" aria-live="polite">
            {done === total ? `All ${total} in your basket` : `${done} of ${total} in your basket`}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full rounded-full bg-same transition-[width]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>

      <ol className="divide-y divide-line">
        {stores.map((store, n) => {
          const order = checkout.stores.find((s) => s.seller === store.seller);
          const storeDone = store.pieces.every((p) => ticks.includes(p.index));
          return (
            <li key={store.seller} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {stores.length > 1 && <span className="text-muted">{n + 1}. </span>}
                  {store.name}
                  {storeDone && <span className="sr-only">, done</span>}
                </h3>
                {order && (
                  <p className="price text-sm">
                    <Money n={order.subtotal} from={currency} />
                  </p>
                )}
              </div>
              {order && (order.delivery !== null || order.freeOver !== null || order.pickup) && (
                <p className="mt-0.5 text-xs text-ink-2">
                  <DeliveryLine s={order} currency={currency} />
                </p>
              )}
              {store.cartHref && (
                <a href={store.cartHref} target="_blank" rel="sponsored nofollow noopener" className="btn btn-primary mt-2 w-full text-sm">
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Add all {store.pieces.length} to your {store.name} basket
                </a>
              )}
              <ul className="mt-1.5 space-y-0.5">
                {store.pieces.map((p) => {
                  const on = ticks.includes(p.index);
                  const id = `tick-${slug}-${p.index}`.slice(0, 120);
                  return (
                    <li key={p.index} className="flex items-start gap-1">
                      {/* The whole 44px square toggles the box. */}
                      <label className="-ml-3 grid h-11 w-11 shrink-0 cursor-pointer place-items-center">
                        <input
                          id={id}
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(p.index)}
                          className="h-5 w-5 cursor-pointer accent-same"
                          aria-label={`${p.name}: in my ${store.name} basket`}
                        />
                      </label>
                      <div className="min-w-0 flex-1 py-2.5">
                        {p.href ? (
                          <a
                            href={p.href}
                            target="_blank"
                            rel="sponsored nofollow noopener"
                            className={`group inline-flex min-h-6 items-start gap-1 text-sm leading-snug font-medium hover:underline ${on ? "text-muted line-through" : ""}`}
                          >
                            <span>{p.name}</span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cobalt" aria-hidden="true" />
                          </a>
                        ) : (
                          <label htmlFor={id} className={`text-sm leading-snug font-medium ${on ? "text-muted line-through" : ""}`}>
                            {p.name}
                          </label>
                        )}
                        <p className="mt-0.5 text-xs text-muted">
                          {!namesPack(p.name, p.pack) && `${p.pack}, `}
                          <span className="num"><Money n={p.price} from={currency} /></span>
                          <span className="sr-only">, instead of {p.replaces}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="rounded-b-card border-t border-line-strong bg-canvas px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{checkout.delivery === null ? "Total, before unchecked delivery" : "Total, delivered"}</p>
          <p className="price text-lg">
            <Money n={checkout.payToday} from={currency} />
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={copy} className="btn btn-ghost text-sm">
            {copied === "yes" ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied === "yes" ? "Copied" : "Copy the list"}
          </button>
          {done > 0 && (
            <button
              type="button"
              onClick={() => writeTicks(slug, [])}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-cobalt underline underline-offset-2"
            >
              Clear ticks
            </button>
          )}
          <span className="sr-only" aria-live="polite">
            {copied === "yes" ? "The list is copied." : copied === "no" ? "Your browser didn't let us copy. Select the list and copy it instead." : ""}
          </span>
        </div>
        {copied === "no" && <p className="mt-1 text-xs text-different">Your browser didn&apos;t let us copy. Try again, or use the store links above.</p>}
        <p className="mt-1 text-xs text-muted">Ticks stay on this device only.</p>
      </div>
    </section>
  );
}
