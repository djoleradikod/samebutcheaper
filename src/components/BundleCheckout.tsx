import { RETAILER_LABEL, storeName } from "@/lib/affiliate";
import type { Bundle } from "@/lib/types";
import { MARKET_ADJECTIVE, type Local } from "@/lib/localize";
import { countryInSentence } from "@/lib/markets";
import { CheckoutCard } from "./CheckoutCard";
import { Money } from "./Money";

/** Each seller's name, from the first piece bought there. A store that doesn't sell in the shopper's country goes unnamed. */
export function kitStoreNames(b: Bundle, local: Local): Record<string, string> {
  const names: Record<string, string> = {};
  let unnamed = 0;
  const unnamedCount = b.checkout.stores.filter((s) => !b.components.some((c) => c.seller === s.seller && local.sells(c.retailer, b.market))).length;
  for (const s of b.checkout.stores) {
    const c = b.components.find((x) => x.seller === s.seller);
    if (c && !local.sells(c.retailer, b.market)) {
      unnamed++;
      names[s.seller] = `A ${MARKET_ADJECTIVE[b.market]} store${unnamedCount > 1 ? ` (${unnamed})` : ""}`;
    } else names[s.seller] = RETAILER_LABEL[s.seller] ?? (c ? storeName(c.retailer, c.url) : s.seller);
  }
  return names;
}

/** What the kit costs at its one checkout, delivery and surcharge included. */
export function kitToday(b: Bundle) {
  return b.bundle.price + (b.kitCheckout.delivery ?? 0) + b.kitCheckout.surcharge;
}

/**
 * What rebuilding the kit costs at the till: one order per store, each store's delivery against its free-delivery
 * threshold, and any membership. Kits are one checkout; a rebuild can be several, so this is where the saving is
 * either confirmed or cut down. Unknown rules say so once instead of guessing.
 */
export function BundleCheckout({ b, local }: { b: Bundle; local: Local }) {
  const { checkout, kitCheckout } = b;
  const moreToday = checkout.payToday - kitToday(b);
  const one = checkout.stores.length === 1;
  const kitStore = kitCheckout.stores[0];
  const abroad = local.known && local.country !== b.market ? countryInSentence(local.country) : null;
  return (
    <section id="checkout" className="scroll-mt-20">
      <h2 className="display mb-1 text-xl md:text-2xl">What you pay at checkout</h2>
      <p className="mb-3 max-w-[68ch] text-[15px] text-ink-2">
        {one
          ? `Everything comes from one store, so it's one order, like the kit.`
          : `The pieces come from ${checkout.stores.length} stores, so it's ${checkout.stores.length} orders where the kit is one. Each store's delivery is counted below.`}
        {abroad && ` Delivery is counted to ${abroad}, and only where the store's own page gives a price for it.`}
      </p>
      <CheckoutCard checkout={checkout} currency={b.currency} names={kitStoreNames(b, local)}>
        <p className="mt-1 text-[13px] text-ink-2">
          The kit: <Money n={b.bundle.price} from={b.currency} prose />
          {kitCheckout.delivery !== null && kitCheckout.delivery > 0 && (
            <>
              {" "}plus <Money n={kitCheckout.delivery} from={b.currency} prose /> delivery
            </>
          )}
          {kitCheckout.delivery === 0 && kitStore?.freeOver !== null && " with free delivery"}
          {kitCheckout.delivery === null && ", and we haven't checked its delivery"}
          .{" "}
          {moreToday > 0.005 ? (
            <>
              You pay {local.money(moreToday, b.currency)} more today, because the packs hold more than the kit. For the same amount you
              still save {local.money(b.netSavings, b.currency)}.
            </>
          ) : (
            <>You keep {local.money(-moreToday, b.currency)} today{checkout.delivery === null ? ", before delivery we haven't checked" : ""}{b.upfrontTotal > b.bundle.price ? ", and the packs hold more than the kit" : ""}.</>
          )}
        </p>
        {b.extraDelivery !== null && b.extraDelivery > 0 && (
          <p className="mt-1 text-xs text-muted">
            The saving at the top already takes off the {local.money(b.extraDelivery, b.currency)} of extra delivery.
          </p>
        )}
      </CheckoutCard>
    </section>
  );
}
