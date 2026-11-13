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
export function buyListText({
  title,
  url,
  stores,
  checkout,
  money,
  checked,
}: {
  title: string;
  url: string;
  stores: BuyStore[];
  checkout: Checkout;
  money: (n: number) => string;
  /** "Nov 2026", when the prices were checked. */
  checked?: string;
}): string {
  const lines: string[] = [title, ""];
  for (const store of stores) {
    const order = checkout.stores.find((s) => s.seller === store.seller);
    const delivery =
      order?.delivery === 0 ? "free delivery" : order?.delivery ? `delivery ${money(order.delivery)}` : "delivery not checked";
    lines.push(`${store.name}${order ? ` (${money(order.subtotal)}, ${delivery})` : ""}`);
    for (const p of store.pieces) lines.push(`- ${pieceLabel(p)}: ${money(p.price)}`);
    lines.push("");
  }
  lines.push(`Total ${checkout.delivery === null ? "before unchecked delivery" : "with delivery"}: ${money(checkout.payToday)}`);
  if (checked) lines.push(`Prices checked ${checked}. Check them before you buy.`);
  lines.push(url);
  return lines.join("\n");
}
