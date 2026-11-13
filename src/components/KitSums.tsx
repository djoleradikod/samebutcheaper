import type { Bundle } from "@/lib/types";
import { getT, type Lang } from "@/lib/i18n";
import { Money } from "./Money";

const row = "flex flex-wrap items-baseline justify-between gap-x-3";

/**
 * The kit's sums in its buy box, as rows that add up: the kit, the same amount rebuilt (the figure the hero shows and the
 * saving is worked out from), any extra delivery the rebuild's orders add, and the saving. What the shopper pays at the
 * till comes after, labelled as that, because the cheaper packs can hold more than the kit does. Before, the box showed the
 * till figure as "Rebuilt" beside a saving worked out from the other one, so the two prices a few centimetres apart
 * disagreed with nothing saying why.
 *
 * Renders rows for a `<dl>`.
 */
export function KitSums({
  b,
  lang = "en",
}: {
  b: Pick<Bundle, "bundle" | "currency" | "equivalentTotal" | "upfrontTotal" | "extraDelivery" | "netSavings" | "checkout">;
  lang?: Lang;
}) {
  const t = getT(lang);
  const unknownDelivery = b.checkout.delivery === null;
  const extra = b.extraDelivery ?? 0;
  const morePacked = b.upfrontTotal > b.equivalentTotal + 0.005;
  return (
    <>
      <div className={row}>
        <dt className="text-ink-2">{t("kitPage.sumKit")}</dt>
        <dd className="price text-base text-muted">
          <Money n={b.bundle.price} from={b.currency} />
        </dd>
      </div>
      <div className={row}>
        <dt className="text-ink-2">{t("kitPage.sumRebuilt")}</dt>
        <dd className="price text-base">
          <Money n={b.equivalentTotal} from={b.currency} />
        </dd>
      </div>
      {extra > 0 && (
        <div className={row}>
          <dt className="text-ink-2">{t("kitPage.sumExtraDelivery")}</dt>
          <dd className="price text-base">
            −<Money n={extra} from={b.currency} />
          </dd>
        </div>
      )}
      <div className={row}>
        <dt className="font-medium text-ink">{t("kitPage.sumSaving", unknownDelivery, extra > 0)}</dt>
        <dd className="price text-lg text-same">
          <Money n={b.netSavings} from={b.currency} />
        </dd>
      </div>
      <div className={`${row} border-t border-line pt-1.5`}>
        <dt className="text-ink-2">
          {t("kitPage.sumCheckout", unknownDelivery)}
          {morePacked && <span className="block text-[13px] text-muted">{t("kitPage.sumHoldsMore")}</span>}
        </dt>
        <dd className="price text-base">
          <Money n={b.checkout.payToday} from={b.currency} />
        </dd>
      </div>
    </>
  );
}
