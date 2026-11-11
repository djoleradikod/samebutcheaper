import { Store, Truck } from "lucide-react";
import { RETAILER_LABEL, storeName } from "@/lib/affiliate";
import type { Bundle } from "@/lib/types";
import type { Local } from "@/lib/localize";
import { Money } from "./Money";

/** A store's name from the first piece bought there. */
function nameOf(b: Bundle, seller: string) {
  const c = b.components.find((x) => x.seller === seller);
  return RETAILER_LABEL[seller] ?? (c ? storeName(c.retailer, c.url) : seller);
}

/**
 * What rebuilding the kit costs at the till: one order per store, each store's delivery against its free-delivery
 * threshold, and any membership. Kits are one checkout; a rebuild can be several, so this is where the saving is
 * either confirmed or cut down. Unknown rules say so instead of guessing.
 */
export function BundleCheckout({ b, local }: { b: Bundle; local: Local }) {
  const { checkout, kitCheckout } = b;
  const kitToday = b.bundle.price + (kitCheckout.delivery ?? 0) + kitCheckout.surcharge;
  const moreToday = checkout.payToday - kitToday;
  const one = checkout.stores.length === 1;
  const kitStore = kitCheckout.stores[0];
  return (
    <section>
      <h2 className="display mb-1 text-xl md:text-2xl">What you pay at checkout</h2>
      <p className="mb-3 max-w-[68ch] text-[15px] text-ink-2">
        {one
          ? `Everything comes from one store, so it's one order, like the kit.`
          : `The pieces come from ${checkout.stores.length} stores, so it's ${checkout.stores.length} orders where the kit is one. Each store's delivery is counted below.`}
      </p>
      <div className="card">
        <ul className="divide-y divide-line">
          {checkout.stores.map((s) => (
            <li key={s.seller} className="p-3 text-sm md:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold">
                  <Store className="mr-1.5 inline h-4 w-4 align-[-2px] text-muted" aria-hidden="true" />
                  {nameOf(b, s.seller)}
                </p>
                <p className="price text-base">
                  <Money n={s.subtotal} from={b.currency} />
                </p>
              </div>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-[13px] text-ink-2">
                <Truck className="mr-0.5 inline h-3.5 w-3.5 align-[-2px] text-muted" aria-hidden="true" />
                {s.delivery === 0 && "Free delivery."}
                {s.delivery !== null && s.delivery > 0 && (
                  <span>
                    Delivery <Money n={s.delivery} from={b.currency} prose />
                    {s.toFree !== null && s.freeOver !== null && (
                      <>
                        {" "}
                        (free over <Money n={s.freeOver} from={b.currency} prose />: add <Money n={s.toFree} from={b.currency} prose /> of anything you need
                        {s.pickup ? ", or pick up in store for free" : ""})
                      </>
                    )}
                    .
                  </span>
                )}
                {s.delivery === null && (
                  <span>
                    {s.freeOver !== null && s.toFree !== null ? (
                      <>
                        Free delivery over <Money n={s.freeOver} from={b.currency} prose />; below that we haven&apos;t checked the fee.
                      </>
                    ) : (
                      "We haven't checked this store's delivery cost yet."
                    )}
                  </span>
                )}
              </p>
              {s.membership && (
                <p className="mt-1 text-[13px] text-different">
                  Needs a {s.membership.name} (<Money n={s.membership.price} from={b.currency} prose /> a {s.membership.per})
                  {s.membership.nonmember_surcharge_pct
                    ? `, or pay ${s.membership.nonmember_surcharge_pct}% more online without one. We've counted the surcharge.`
                    : "."}
                </p>
              )}
              {s.note && !s.membership && <p className="mt-1 text-xs text-muted">{s.note}</p>}
            </li>
          ))}
        </ul>
        <div className="rounded-b-card border-t border-line-strong bg-canvas px-3 py-3 md:px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-medium">
              You pay today{checkout.delivery === null ? ", before any unchecked delivery" : ", delivered"}
            </p>
            <p className="price text-[1.375rem] text-ink">
              <Money n={checkout.payToday} from={b.currency} />
            </p>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">
            The kit: <Money n={b.bundle.price} from={b.currency} prose />
            {kitCheckout.delivery !== null && kitCheckout.delivery > 0 && (
              <>
                {" "}plus <Money n={kitCheckout.delivery} from={b.currency} prose /> delivery
              </>
            )}
            {kitCheckout.delivery === 0 && kitStore?.freeOver !== null && " with free delivery"}
            .{" "}
            {moreToday > 0.005 ? (
              <>
                You pay {local.money(moreToday, b.currency)} more today, because the packs hold more than the kit.
                Per use you still save {local.money(b.netSavings, b.currency)}.
              </>
            ) : (
              <>You keep {local.money(-moreToday, b.currency)} today{b.upfrontTotal > b.bundle.price ? ", and the packs hold more than the kit" : ""}.</>
            )}
          </p>
          {b.extraDelivery !== null && b.extraDelivery > 0 && (
            <p className="mt-1 text-xs text-muted">
              The saving at the top already takes off the {local.money(b.extraDelivery, b.currency)} of extra delivery.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
