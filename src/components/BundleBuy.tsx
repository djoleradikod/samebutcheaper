import { ArrowDown, ExternalLink, ShoppingCart, TriangleAlert } from "lucide-react";
import { packSize } from "@/lib/basket-view";
import { groupByStore, kitCaution, type BuyStore, type KitCaution } from "@/lib/buy-list";
import { productUrl } from "@/lib/affiliate";
import { cartSide, cartUrl } from "@/lib/cart";
import { shortMonth, type Local } from "@/lib/localize";
import { getT, type Lang } from "@/lib/i18n";
import { monthDe } from "@/lib/i18n/format";
import { SITE } from "@/lib/site";
import type { Bundle } from "@/lib/types";
import { BundleBuyList } from "./BundleBuyList";
import { kitStoreNames, kitToday } from "./BundleCheckout";
import { BundleStickyBar } from "./BundleStickyBar";
import { Money } from "./Money";


function withBrand(brand: string, product: string) {
  return product.toLowerCase().startsWith(brand.toLowerCase()) ? product : `${brand} ${product}`;
}

/** The kit's pieces, store by store in checkout order, each with its counted link and the store's cart where one works. */
export function buyStores(b: Bundle, local: Local): BuyStore[] {
  const names = kitStoreNames(b, local);
  const pieces = b.components.map((c, index) => ({ ...c, index }));
  return groupByStore(b.checkout, pieces).map(({ seller, pieces: mine }) => {
    const sold = mine.every((c) => local.sells(c.retailer, b.market));
    return {
      seller,
      name: names[seller] ?? seller,
      cartHref: sold && cartUrl(seller, mine, b.market) ? `/go/${b.slug}/${cartSide(seller)}` : null,
      pieces: mine.map((c) => ({
        index: c.index,
        name: withBrand(c.brand, c.product),
        pack: packSize(c.size, c.unit, local.lang),
        price: c.price,
        replaces: b.bundle.items[c.replaces].name,
        href: local.sells(c.retailer, b.market) ? `/go/${b.slug}/item-${c.index}` : null,
      })),
    };
  });
}

/** The one thing to do first: put a whole store's share in its cart, or open the first store's first piece. */
function primaryAction(stores: BuyStore[], lang: Lang) {
  const t = getT(lang);
  const first = stores[0];
  if (!first) return null;
  if (first.cartHref) return { href: first.cartHref, label: t("pageCheckout.addAll", first.pieces.length, first.name), cart: true, outbound: true };
  const piece = first.pieces.find((p) => p.href);
  if (piece) return { href: piece.href!, label: t("kitPage.startWith", first.name), cart: false, outbound: true };
  return { href: "#buy-list", label: t("kitPage.seeList"), cart: false, outbound: false };
}

const row = "flex flex-wrap items-baseline justify-between gap-x-3";

/**
 * The top of the kit's box: what the kit costs, what the rebuild costs delivered, the saving after that delivery,
 * how many orders it takes, and the one action that starts buying.
 */
export function BundleBuyBox({ b, local }: { b: Bundle; local: Local }) {
  const stores = buyStores(b, local);
  const t = getT(local.lang);
  const action = primaryAction(stores, local.lang);
  const caution = kitCaution(b);
  const n = b.checkout.stores.length;
  return (
    <div>
      {caution && <KitCautionNote b={b} caution={caution} local={local} />}
      <dl className="space-y-1.5 text-sm">
        <div className={row}>
          <dt className="text-ink-2">{t("kitPage.kitDelivered", b.kitCheckout.delivery !== null)}</dt>
          <dd className="price text-base text-muted">
            <Money n={kitToday(b)} from={b.currency} />
          </dd>
        </div>
        <div className={row}>
          <dt className="text-ink-2">{t("kitPage.rebuilt", b.checkout.delivery === null)}</dt>
          <dd className="price text-base">
            <Money n={b.checkout.payToday} from={b.currency} />
          </dd>
        </div>
        <div className={row}>
          <dt className="font-medium text-ink">{t("kitPage.saving", b.checkout.delivery === null)}</dt>
          <dd className="price text-lg text-same">
            <Money n={b.netSavings} from={b.currency} />
          </dd>
        </div>
        <div className={row}>
          <dt className="text-ink-2">{t("kitPage.orders")}</dt>
          <dd className="text-[13px] font-medium">{n === 1 ? t("kitPage.oneAt", stores[0]?.name ?? null) : t("kitPage.stores", n)}</dd>
        </div>
      </dl>
      {action && (
        <div className="mt-3">
          <a
            href={action.href}
            {...(action.outbound ? { target: "_blank", rel: "sponsored nofollow noopener" } : {})}
            className="btn btn-primary w-full"
          >
            {action.cart && <ShoppingCart className="h-4 w-4" aria-hidden="true" />}
            {action.label}
            {action.outbound && !action.cart && <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
          </a>
          {action.outbound && (
            <a href="#buy-list" className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-cobalt underline underline-offset-2">
              {n > 1 || stores[0]?.pieces.length > 1 ? t("kitPage.thenTick") : t("kitPage.seeList")}
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The first thing on a kit page whose rebuild costs more at the till than the kit, or saves under 5% after delivery.
 * Worded so it can't be missed or read as a saving: a heading, the amount, and what the saving rests on.
 */
function KitCautionNote({ b, caution, local }: { b: Bundle; caution: KitCaution; local: Local }) {
  const money = (n: number) => local.money(n, b.currency);
  const t = getT(local.lang);
  const pct = Math.round((b.netSavings / b.bundle.price) * 1000) / 10;
  return (
    <div role="note" aria-labelledby={`caution-${b.slug}`} className="mb-3 rounded-tile border-2 border-different bg-paper p-3">
      <p id={`caution-${b.slug}`} className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TriangleAlert className="h-4 w-4 shrink-0 text-different" aria-hidden="true" />
        {caution.moreToday > 0 ? t("kitPage.costsMore", money(caution.moreToday)) : t("kitPage.smallSaving")}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-ink-2">
        {caution.moreToday > 0 && t("kitPage.payMore", money(caution.moreToday), b.kitCheckout.delivery !== null)}
        {b.netSavings > 0 ? t("kitPage.savingIs", money(b.netSavings), caution.thin ? pct : null, caution.moreToday > 0) : t("kitPage.noSaving")}
        {caution.thin && t("kitPage.simpler")}
      </p>
    </div>
  );
}

/** The buying list, with what it needs from the record. */
export function BundleBuySection({ b, local }: { b: Bundle; local: Local }) {
  return (
    <BundleBuyList
      slug={b.slug}
      title={getT(local.lang)("kitPage.rebuildTitle", b.bundle.brand, b.bundle.name)}
      url={`${SITE.url}${local.lang === "de" ? "/de" : ""}/bundle/${b.slug}`}
      currency={b.currency}
      checkout={b.checkout}
      stores={buyStores(b, local)}
      checked={local.lang === "de" ? monthDe(b.price_checked) : shortMonth(b.price_checked)}
    />
  );
}

/** The phone bar that jumps to the buying list once the hero has gone. */
export function BundleStickyBuy({ b, lang = "en" }: { b: Bundle; lang?: Lang }) {
  const n = b.checkout.stores.length;
  return (
    <BundleStickyBar hero="kit-hero" list="buy-list">
      <a href="#buy-list" className="btn btn-primary w-full">
        <span className="min-w-0 truncate">
          {getT(lang)("kitPage.sticky", b.components.length, n)}{" "}
          <span className="price">
            <Money n={b.checkout.payToday} from={b.currency} />
          </span>
        </span>
      </a>
    </BundleStickyBar>
  );
}

/** ItemList structured data for the pieces, each with the store page it's priced at. */
export function piecesJsonLd(b: Bundle, lang: Lang = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: getT(lang)("kitPage.piecesName", b.bundle.name),
    numberOfItems: b.components.length,
    itemListElement: b.components.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: withBrand(c.brand, c.product),
      url: productUrl(c, b.market),
    })),
  };
}
