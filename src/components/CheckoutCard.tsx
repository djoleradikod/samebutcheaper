"use client";

import type { ReactNode } from "react";
import { Store, Truck } from "lucide-react";
import type { Checkout, StoreOrder } from "@/lib/delivery";
import type { Currency } from "@/lib/format";
import { useT } from "@/lib/i18n/client";
import type { ClientT } from "@/lib/i18n/client-dict";
import { pageCheckout } from "@/lib/i18n/en/pages/checkout";
import { rich } from "@/lib/i18n/rich";
import { Money } from "./Money";

/** The English this component reads (src/lib/i18n/client-dict.ts); the German loads on German pages only. */
const TEXT = { pageCheckout };
export const checkoutGerman = () => import("@/lib/i18n/de/pages/checkout");
type T = ClientT<typeof TEXT>;

/** The checkout's words in the page's language, for this file's parts and the buying list. */
export function useCheckoutT(): T {
  return useT(TEXT, checkoutGerman);
}

/** "A, B and C". */
export function listNames(names: string[], and = "and") {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/** One store's delivery in a sentence. Nothing when the rule is unknown: the card says that once, under the stores. */
export function DeliveryLine({ s, currency }: { s: StoreOrder; currency: Currency }) {
  const t = useCheckoutT();
  const money = (n: number) => <Money n={n} from={currency} prose />;
  const pickup = s.pickup ? t("pageCheckout.orPickUp") : "";
  if (s.delivery === 0) return <>{t("pageCheckout.freeDelivery")}</>;
  if (s.delivery !== null && s.delivery > 0) {
    const more = s.toFree !== null && s.freeOver !== null ? rich(t("pageCheckout.freeOverAdd"), { over: money(s.freeOver), add: money(s.toFree), pickup }) : null;
    return <>{rich(t("pageCheckout.delivery"), { fee: money(s.delivery), more })}</>;
  }
  if (s.freeOver !== null && s.toFree !== null) return <>{rich(t("pageCheckout.freeOver"), { over: money(s.freeOver), pickup })}</>;
  if (s.pickup) return <>{t("pageCheckout.freePickup")}</>;
  return null;
}

/** The sentence for stores whose delivery we haven't checked, or null when every one is known. */
export function uncheckedNote(stores: StoreOrder[], names: Record<string, string>, t: T) {
  const open = stores.filter((s) => s.delivery === null).map((s) => names[s.seller] ?? s.seller);
  if (!open.length) return null;
  return open.length === stores.length && stores.length > 1
    ? t("pageCheckout.noneChecked")
    : t("pageCheckout.someUnchecked", listNames(open, t("pageCheckout.and")), open.length);
}

/**
 * What a list of pieces costs at the till: one order per store, each store's delivery against its free-delivery
 * line, and any membership. Shared by kits and baskets; the caller adds the comparison underneath as children.
 */
export function CheckoutCard({
  checkout,
  currency,
  names,
  children,
}: {
  checkout: Checkout;
  currency: Currency;
  /** Each seller's display name. */
  names: Record<string, string>;
  children?: ReactNode;
}) {
  const t = useCheckoutT();
  const unchecked = uncheckedNote(checkout.stores, names, t);
  return (
    <div className="card">
      <ul className="divide-y divide-line">
        {checkout.stores.map((s) => (
          <li key={s.seller} className="p-3 text-sm md:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                <Store className="mr-1.5 inline h-4 w-4 align-[-2px] text-muted" aria-hidden="true" />
                {names[s.seller] ?? s.seller}
              </p>
              <p className="price text-base">
                <Money n={s.subtotal} from={currency} />
              </p>
            </div>
            {(s.delivery !== null || s.freeOver !== null || s.pickup) && (
              <p className="mt-1 text-[13px] text-ink-2">
                <Truck className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-muted" aria-hidden="true" />
                <DeliveryLine s={s} currency={currency} />
              </p>
            )}
            {s.membership && (
              <p className="mt-1 text-[13px] text-different">
                {rich(t("pageCheckout.membership", s.membership.name, s.membership.per), { price: <Money n={s.membership.price} from={currency} prose /> })}
                {s.membership.nonmember_surcharge_pct ? t("pageCheckout.surcharge", s.membership.nonmember_surcharge_pct) : "."}
              </p>
            )}
            {s.note && !s.membership && <p className="mt-1 text-xs text-muted">{s.note}</p>}
          </li>
        ))}
      </ul>
      <div className="rounded-b-card border-t border-line-strong bg-canvas px-3 py-3 md:px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm font-medium">{t("pageCheckout.payToday", checkout.delivery === null)}</p>
          <p className="price text-[1.375rem] text-ink">
            <Money n={checkout.payToday} from={currency} />
          </p>
        </div>
        {unchecked && <p className="mt-1 text-[13px] font-medium text-ink">{unchecked}</p>}
        {children}
      </div>
    </div>
  );
}
