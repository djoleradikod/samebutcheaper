/**
 * A kit's buying list, store by store, as the page shows it and as plain text a shopper can paste into a note.
 * Pure, for server, client and tests.
 */
import type { Checkout } from "./delivery";

export type BuyPiece = {
  /** The piece's index in the kit, which is also its /go/<slug>/item-N link. */
  index: number;
  name: string;
  /** "16 oz". */
  pack: string;
  price: number;
  /** What it stands in for in the kit. */
  replaces: string;
  /** The /go link, or null when we can't name the store for this shopper. */
  href: string | null;
};

export type BuyStore = {
  seller: string;
  name: string;
  pieces: BuyPiece[];
  /** One link that puts every piece in this store's basket, or null when the store has none we trust. */
  cartHref: string | null;
};

/** Under this share of the kit's price, a saving after delivery is too thin to lead with. */
export const THIN_SAVING = 0.05;

export type KitCaution = {
  /** How much more the rebuild costs at the till today than the kit, delivered; 0 when it costs no more. */
  moreToday: number;
  /** The saving after delivery is under THIN_SAVING of the kit's price. */
  thin: boolean;
};

type CautionFacts = {
  bundle: { price: number };
  netSavings: number;
  checkout?: { payToday?: number };
  kitCheckout?: { delivery: number | null; surcharge: number };
};

/**
 * What a kit page has to say first, from the build's own numbers: the rebuild costs more today than the kit, or
 * saves under 5% of its price after delivery. Null when neither holds, or when the record lacks the checkout
 * (the search index's slim copy), so nothing is claimed that can't be shown.
 */
export function kitCaution(b: CautionFacts): KitCaution | null {
  if (b.checkout?.payToday === undefined || !b.kitCheckout) return null;
  const kit = b.bundle.price + (b.kitCheckout.delivery ?? 0) + b.kitCheckout.surcharge;
  const more = Math.round((b.checkout.payToday - kit) * 100) / 100;
  const moreToday = more > 0.005 ? more : 0;
  const thin = b.netSavings < THIN_SAVING * b.bundle.price;
  return moreToday > 0 || thin ? { moreToday, thin } : null;
}

/** Whether a product name already says its pack size ("Cetaphil Cleanser, 16.0 oz" says "16 oz"), so a list doesn't say it twice. */
export function namesPack(name: string, pack: string) {
  const norm = (s: string) => s.toLowerCase().replace(/(\d)\.0\b/g, "$1").replace(/\s+/g, " ");
  return norm(name).includes(norm(pack));
}

/** "name, pack" or just the name when it already says the pack. */
export function pieceLabel(p: Pick<BuyPiece, "name" | "pack">) {
  return namesPack(p.name, p.pack) ? p.name : `${p.name}, ${p.pack}`;
}

/** Pieces grouped by store, in the checkout's store order and the kit's piece order within each store. */
export function groupByStore<T extends { seller: string }>(checkout: Pick<Checkout, "stores">, pieces: readonly T[]): { seller: string; pieces: T[] }[] {
  return checkout.stores.map((s) => ({ seller: s.seller, pieces: pieces.filter((p) => p.seller === s.seller) }));
}

/**
 * The list as plain text: a heading, each store with its pieces, sizes and prices, the total and the page link.
 * `money` formats an amount in the shopper's currency, so the text matches what the page shows.
 */
/** The words of the plain-text list, in the page's language (src/lib/i18n/en/pages/checkout.ts, `text`). */
export type BuyListWords = {
  free: string;
  fee: (fee: string) => string;
  notChecked: string;
  total: (unchecked: boolean, amount: string) => string;
  checked: (when: string) => string;
};

const ENGLISH: BuyListWords = {
  free: "free delivery",
  fee: (fee) => `delivery ${fee}`,
  notChecked: "delivery not checked",
  total: (unchecked, amount) => `Total ${unchecked ? "before unchecked delivery" : "with delivery"}: ${amount}`,
  checked: (when) => `Prices checked ${when}. Check them before you buy.`,
};

export function buyListText({
  title,
  url,
  stores,
  checkout,
  money,
  checked,
  words = ENGLISH,
}: {
  title: string;
  url: string;
  stores: BuyStore[];
  checkout: Checkout;
  money: (n: number) => string;
  /** "Nov 2026", when the prices were checked. */
  checked?: string;
  words?: BuyListWords;
}): string {
  const lines: string[] = [title, ""];
  for (const store of stores) {
    const order = checkout.stores.find((s) => s.seller === store.seller);
    const delivery = order?.delivery === 0 ? words.free : order?.delivery ? words.fee(money(order.delivery)) : words.notChecked;
    lines.push(`${store.name}${order ? ` (${money(order.subtotal)}, ${delivery})` : ""}`);
    for (const p of store.pieces) lines.push(`- ${pieceLabel(p)}: ${money(p.price)}`);
    lines.push("");
  }
  lines.push(words.total(checkout.delivery === null, money(checkout.payToday)));
  if (checked) lines.push(words.checked(checked));
  lines.push(url);
  return lines.join("\n");
}
