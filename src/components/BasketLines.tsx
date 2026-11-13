"use client";

import Link from "@/components/CountryLink";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { tillLine, type Checkout, type TillLine } from "@/lib/delivery";
import { basketCheckoutFor } from "@/lib/delivery-abroad";
import { setSavedList, useSavedList } from "@/lib/client/savedList";
import type { Currency } from "@/lib/format";
import type { MarketCode } from "@/lib/markets";
import type { CategorySlug } from "@/lib/types";
import { CheckoutCard } from "./CheckoutCard";
import { packSize } from "@/lib/unit-format";
import { ProductThumb } from "./ProductThumb";
import { PctTicket, SaveTicket } from "./Ticket";
import { ToArrow, UnitPrice } from "./UnitPrice";
import { Money } from "./Money";

export type BasketLineView = {
  /** The swap's slug. */
  slug: string;
  /** How many brand-name packs the basket starts with. */
  qty: number;
  note?: string;
  subcategory: string;
  category?: CategorySlug;
  brandName: string;
  brandProduct: string;
  altName: string;
  altProduct: string;
  brandPhoto: string | null;
  altPhoto: string | null;
  /** The store the cheaper side is priced at. */
  altStore: string;
  /** Cost of qty brand packs. */
  brandCost: number;
  /** Cost of the same amount of the cheaper product. */
  altCost: number;
  savingsPct: number;
  unit: string;
  brandPpu: number;
  altPpu: number;
  /** The brand pack the quantity counts, such as "415 g". */
  pack: string | null;
  /** Set when the price is per wash or per 100 ml, so the quantity counts that amount and not packs. */
  measure: { size: number; unit: string } | null;
  /** The line's store and real pack, so the till counts whole packs at any quantity. */
  till: TillLine;
  /** The cheaper product's own pack, such as "1 kg". Null when it's priced per amount. */
  altPack: string | null;
};

const MAX_QTY = 99;

type BasketState = {
  lines: BasketLineView[];
  currency: Currency;
  qty: number[];
  setQty: (index: number, value: number) => void;
  reset: () => void;
  changed: boolean;
  items: number;
  brandTotal: number;
  altTotal: number;
  savings: number;
  pct: number;
  /** Whole packs at the till, one order per store with its delivery. The store split and the checkout both read this. */
  checkout: Checkout;
  /** Each seller's name as the lines show it. */
  storeNames: Record<string, string>;
};

const BasketContext = createContext<BasketState | null>(null);

function useBasket() {
  const state = useContext(BasketContext);
  if (!state) throw new Error("Basket parts need a BasketProvider");
  return state;
}

/** Scales both sides of a line, from its catalogue cost. A changed quantity buys more of both. */
function scaled(line: BasketLineView, n: number) {
  const k = n / line.qty;
  return { brand: line.brandCost * k, alt: line.altCost * k };
}

/** Holds the quantities, so the header's totals and the list's totals always agree. */
export function BasketProvider({
  lines,
  currency,
  market,
  country = null,
  children,
}: {
  lines: BasketLineView[];
  currency: Currency;
  market: MarketCode;
  /** Where the shopper is, when we know: delivery is counted to there. */
  country?: string | null;
  children: ReactNode;
}) {
  const start = useMemo(() => lines.map((l) => l.qty), [lines]);
  const [qty, setQuantities] = useState(start);
  const state = useMemo<BasketState>(() => {
    let brandTotal = 0;
    let altTotal = 0;
    lines.forEach((line, i) => {
      const cost = scaled(line, qty[i]);
      brandTotal += cost.brand;
      altTotal += cost.alt;
    });
    const savings = brandTotal - altTotal;
    const storeNames: Record<string, string> = {};
    for (const l of lines) storeNames[l.till.seller] ??= l.altStore;
    return {
      lines,
      currency,
      qty,
      setQty: (index, value) => setQuantities((q) => q.map((n, i) => (i === index ? value : n))),
      reset: () => setQuantities(start),
      changed: qty.some((n, i) => n !== start[i]),
      items: qty.filter((n) => n > 0).length,
      brandTotal,
      altTotal,
      savings,
      pct: brandTotal > 0 ? (savings / brandTotal) * 100 : 0,
      checkout: basketCheckoutFor(
        lines.map((l) => l.till),
        qty,
        market,
        country,
      ),
      storeNames,
    };
  }, [lines, currency, market, country, qty, start]);
  return <BasketContext.Provider value={state}>{children}</BasketContext.Provider>;
}

/** Totals on both sides and the saving as a large ticket. Follows the stepper. */
export function BasketTotals() {
  const { brandTotal, altTotal, savings, pct, currency, items } = useBasket();
  if (!items) {
    return <p className="text-[15px] text-ink-2">Nothing in the basket. Add an item below to see the totals.</p>;
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <p>
          <span className="block text-[13px] font-medium text-ink-2">Brand names</span>
          <span className="price mt-1 block text-[1.75rem] font-semibold text-muted md:text-[2rem]"><Money n={brandTotal} from={currency} /></span>
        </p>
        <span className="pb-1 text-xl text-muted">
          <ToArrow />
        </span>
        <p>
          <span className="block text-[13px] font-medium text-ink-2">Cheaper swaps</span>
          <span className="price mt-1 block text-[2.5rem] text-ink md:text-[3rem]"><Money n={altTotal} from={currency} /></span>
        </p>
      </div>
      <SaveTicket
        size="lg"
        amount={savings}
        currency={currency}
        sub={`${Math.round(pct)}% less for the same amount`}
        className="md:text-[2.25rem]"
      />
    </div>
  );
}

/**
 * The cheaper total is rarely one trip, so this says which stores it takes, in whole packs at the till, before
 * anyone reads it as one receipt. The same figures as the checkout further down. Follows the stepper.
 */
export function BasketStoreSplit() {
  const { checkout, storeNames, currency, items } = useBasket();
  const stores = checkout.stores;
  if (!stores.length || !items) return null;
  return (
    <div className="mt-3 max-w-[62ch]">
      <p className="text-sm font-medium text-ink">
        {stores.length === 1 ? (
          <>
            At the till it&apos;s one order at {storeNames[stores[0].seller]}:{" "}
            <span className="num font-semibold">
              <Money n={stores[0].subtotal} from={currency} />
            </span>{" "}
            in whole packs.
          </>
        ) : (
          `At the till it's ${stores.length} orders, in whole packs:`
        )}
      </p>
      {stores.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-2">
          {stores.map((s) => (
            <li key={s.seller}>
              {storeNames[s.seller]}{" "}
              <span className="num font-semibold text-ink">
                <Money n={s.subtotal} from={currency} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <a href="#checkout" className="mt-1 inline-flex min-h-11 items-center text-[13px] font-medium text-cobalt underline underline-offset-2 md:min-h-0">
        {checkout.delivery === null ? (
          "What you pay at checkout"
        ) : (
          <>
            With delivery,&nbsp;
            <Money n={checkout.payToday} from={currency} prose />
          </>
        )}
      </a>
    </div>
  );
}

/** What the cheaper side costs at checkout, at the quantities set above. */
export function BasketCheckout() {
  const { checkout, storeNames, currency, brandTotal, altTotal, items } = useBasket();
  if (!items) return null;
  const packs = checkout.stores.reduce((n, s) => n + s.subtotal, 0);
  const extra = packs - altTotal;
  return (
    <section id="checkout" className="scroll-mt-20">
      <h2 className="display mb-1 text-xl md:text-2xl">What you pay at checkout</h2>
      <p className="mb-3 max-w-[62ch] text-sm text-ink-2 md:text-[15px]">
        {checkout.stores.length === 1
          ? "Everything comes from one store, so it's one order."
          : `The cheaper items come from ${checkout.stores.length} stores, so it's ${checkout.stores.length} orders, each with its own delivery.`}{" "}
        Stores sell whole packs, so this counts the packs you&apos;d buy for the amounts above.
      </p>
      <CheckoutCard checkout={checkout} currency={currency} names={storeNames}>
        <p className="mt-1 text-[13px] text-ink-2">
          {extra > 0.005 && (
            <>
              The packs cost <Money n={extra} from={currency} prose /> more than the same amount at the unit price, because some hold more
              than you need. That extra lasts you longer.{" "}
            </>
          )}
          {extra < -0.005 && (
            <>
              Where a pack holds a little less than the brand&apos;s (a tenth or less), we count one pack, so this comes in under the
              same-amount total.{" "}
            </>
          )}
          The brand names cost <Money n={brandTotal} from={currency} prose /> for the same amount, before their own delivery.
        </p>
      </CheckoutCard>
    </section>
  );
}

/** Saves every swap still in the basket to My List. */
export function SaveAllButton() {
  const { lines, qty } = useBasket();
  const saved = useSavedList();
  const slugs = lines.filter((_, i) => qty[i] > 0).map((l) => l.slug);
  const allSaved = slugs.length > 0 && slugs.every((s) => saved.includes(s));
  const toggle = () => setSavedList(allSaved ? saved.filter((s) => !slugs.includes(s)) : [...saved, ...slugs]);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={toggle}
        disabled={!slugs.length}
        aria-pressed={allSaved}
        className={`btn disabled:opacity-50 ${allSaved ? "btn-ghost" : "btn-primary"}`}
      >
        {allSaved ? `All ${slugs.length} on your list` : `Save all ${slugs.length} to my list`}
      </button>
      {allSaved && (
        <Link
          href="/my-list"
          className="inline-flex min-h-11 items-center text-sm font-medium text-cobalt underline underline-offset-2"
        >
          View my list
        </Link>
      )}
    </div>
  );
}

function Stepper({ value, name, onChange }: { value: number; name: string; onChange: (n: number) => void }) {
  // A catalogue quantity may be fractional: the first press lands on a whole pack.
  const down = Number.isInteger(value) ? value - 1 : Math.floor(value);
  const up = Number.isInteger(value) ? value + 1 : Math.ceil(value);
  const button =
    "grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-canvas disabled:text-line-strong disabled:hover:bg-transparent";
  return (
    <div role="group" aria-label={`How many packs of ${name}`} className="inline-flex rounded-tile border border-line-strong bg-paper">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, down))}
        disabled={value <= 0}
        aria-label={`One pack fewer of ${name}`}
        className={`${button} rounded-l-tile`}
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output className="price grid w-9 place-items-center border-x border-line text-lg">{value}</output>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_QTY, up))}
        disabled={value >= MAX_QTY}
        aria-label={`One pack more of ${name}`}
        className={`${button} rounded-r-tile`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Line({ line, index }: { line: BasketLineView; index: number }) {
  const { qty, setQty, currency } = useBasket();
  const n = qty[index];
  const cost = scaled(line, n);
  const href = `/compare/${line.slug}`;
  const kind = line.subcategory.replace(/\s+-\s+/g, ": ");
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2.5 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto_11rem] md:items-center md:gap-x-5 md:p-4">
      <Link href={href} tabIndex={-1} className={`flex items-start gap-1 ${n === 0 ? "opacity-50" : ""}`}>
        <ProductThumb
          size="sm"
          image={line.brandPhoto}
          brand={line.brandName}
          alt={line.brandProduct}
          category={line.category}
          unit={line.unit}
          sizes="(min-width: 768px) 80px, 64px"
          className="md:h-20 md:w-20"
        />
        <ProductThumb
          size="sm"
          image={line.altPhoto}
          brand={line.altName}
          alt={line.altProduct}
          category={line.category}
          unit={line.unit}
          sizes="(min-width: 768px) 80px, 64px"
          className="md:h-20 md:w-20"
        />
      </Link>

      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{kind}</p>
        <p className="text-[15px] leading-snug font-semibold">
          <Link href={href} className="hover:underline">
            {line.brandName}
            <ToArrow />
            {line.altName}
          </Link>
        </p>
        {line.note && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{line.note}</p>}
        <UnitPrice unit={line.unit} alt={line.altPpu} brand={line.brandPpu} currency={currency} size="sm" className="mt-1.5" />
        <Link
          href={href}
          className="inline-flex min-h-11 items-center text-[13px] font-medium text-cobalt underline underline-offset-2 md:mt-1 md:min-h-0"
        >
          Prices and evidence
        </Link>
      </div>

      {/* A row of its own on a phone; two columns of the line from tablet up. */}
      <div className="col-span-2 flex items-start justify-between gap-3 md:contents">
        <div>
          <Stepper value={n} name={line.altName} onChange={(v) => setQty(index, v)} />
          {line.measure ? (
            <p className="mt-1 text-xs leading-tight text-muted">{packSize(n * line.measure.size, line.measure.unit)} in all</p>
          ) : (
            line.pack && <p className="mt-1 text-xs leading-tight text-muted">{n === 1 ? "pack" : "packs"} of {line.pack}</p>
          )}
        </div>
        <div className="min-w-0 text-right">
          {n > 0 ? (
            <>
              <p className="flex flex-wrap items-baseline justify-end gap-x-1 leading-none">
                <span className="sr-only">Brand name </span>
                <span className="price text-sm font-semibold text-muted"><Money n={cost.brand} from={currency} /></span>
                <ToArrow className="text-muted" />
                <span className="price text-[1.375rem] text-ink"><Money n={cost.alt} from={currency} /></span>
              </p>
              <p className="mt-1.5 flex items-center justify-end gap-2 text-xs font-medium text-ink-2">
                <span>Saves <Money n={cost.brand - cost.alt} from={currency} /></span>
                <PctTicket pct={line.savingsPct} size="sm" />
              </p>
              <TillNote line={line} n={n} />
            </>
          ) : (
            <p className="text-[13px] font-medium text-muted">Left out of the total</p>
          )}
        </div>
      </div>
    </li>
  );
}

/** What the line comes to at the till, in whole packs of the cheaper product. */
function TillNote({ line, n }: { line: BasketLineView; n: number }) {
  const { currency } = useBasket();
  const till = tillLine(line.till, n);
  if (till.packs === null || !line.altPack) {
    return (
      <p className="mt-1 text-xs text-muted">
        At the till: <span className="num"><Money n={till.cost} from={currency} /></span> for this amount. It&apos;s priced per amount, so
        the pack you buy may cost more.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-muted">
      At the till: {till.packs} × {line.altPack}, <span className="num"><Money n={till.cost} from={currency} /></span>
    </p>
  );
}

/** The basket's lines, each with a stepper, and a running total that stays in view. */
export function BasketLines() {
  const { lines, currency, brandTotal, altTotal, savings, items, changed, reset } = useBasket();
  return (
    <div className="card">
      <ul className="divide-y divide-line">
        {lines.map((line, i) => (
          <Line key={line.slug} line={line} index={i} />
        ))}
      </ul>
      <div
        aria-live="polite"
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-b-card border-t border-line-strong bg-paper p-3 md:px-4"
      >
        <div>
          <p className="text-[13px] leading-tight font-medium text-ink-2">
            Total for these amounts, {items} item{items === 1 ? "" : "s"}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1 leading-none">
            <span className="price text-base font-semibold text-muted"><Money n={brandTotal} from={currency} /></span>
            <ToArrow className="text-muted" />
            <span className="price text-[1.375rem] text-ink"><Money n={altTotal} from={currency} /></span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {changed && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center text-[13px] font-medium text-cobalt underline underline-offset-2"
            >
              Reset quantities
            </button>
          )}
          {items > 0 && <SaveTicket size="md" amount={savings} currency={currency} />}
        </div>
      </div>
    </div>
  );
}
