import { RETAILER_LABEL, storeName } from "@/lib/affiliate";
import type { Bundle } from "@/lib/types";
import type { Local } from "@/lib/localize";
import { getT } from "@/lib/i18n";
import { rich } from "@/lib/i18n/rich";
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
      names[s.seller] = getT(local.lang)("kitPage.unnamedStore", b.market, unnamedCount > 1 ? unnamed : null);
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
  const abroad = local.known && local.country !== b.market ? local.country : null;
  const t = getT(local.lang);
  const money = (n: number) => <Money n={n} from={b.currency} prose />;
  return (
    <section id="checkout" className="scroll-mt-20">
      <h2 className="display mb-1 text-xl md:text-2xl">{t("kitPage.checkout")}</h2>
      <p className="mb-3 max-w-[68ch] text-[15px] text-ink-2">
        {one ? t("kitPage.oneOrder") : t("kitPage.manyOrders", checkout.stores.length)}
        {abroad && t("kitPage.abroad", abroad)}
      </p>
      <CheckoutCard checkout={checkout} currency={b.currency} names={kitStoreNames(b, local)}>
        <p className="mt-1 text-[13px] text-ink-2">
          {rich(t("kitPage.kitIs"), { price: money(b.bundle.price) })}
          {kitCheckout.delivery !== null && kitCheckout.delivery > 0 && rich(t("kitPage.plusDelivery"), { fee: money(kitCheckout.delivery) })}
          {kitCheckout.delivery === 0 && kitStore?.freeOver !== null && t("kitPage.withFree")}
          {kitCheckout.delivery === null && t("kitPage.kitUnchecked")}
          .{" "}
          {moreToday > 0.005
            ? t("kitPage.moreToday", local.money(moreToday, b.currency), local.money(b.netSavings, b.currency))
            : t("kitPage.keep", local.money(-moreToday, b.currency), checkout.delivery === null, b.upfrontTotal > b.bundle.price)}
        </p>
        {b.extraDelivery !== null && b.extraDelivery > 0 && (
          <p className="mt-1 text-xs text-muted">{t("kitPage.extraTakenOff", local.money(b.extraDelivery, b.currency))}</p>
        )}
      </CheckoutCard>
    </section>
  );
}
