/**
 * Delivery for a shopper outside the record's market. Pure, for server and client.
 *
 * delivery.ts prices delivery in the record's own market. A German pharmacy's free-over-EUR-29.99 rule says nothing about
 * sending the same order to Austria, so for a shopper elsewhere we use the store's rule for their country when the data file
 * has one (`abroad` under the market's rule, see data/README.md), and otherwise say delivery there isn't checked. We never
 * pass the home market's rule off as theirs.
 *
 * How the kit and basket checkout should call it: wherever they call checkout(lines, market), call
 * checkoutFor(lines, market, local.known ? local.country : null) instead. It returns checkout()'s own answer, unchanged, for the
 * market's own shoppers and for a shopper we can't place. Elsewhere every store order carries `abroad: true` and `destination`,
 * a store with no rule for that country has delivery null (so the total is null and the page says "not checked"), and
 * `unchecked` names those stores. Render `destination` in the heading ("Delivery to Austria"). Amounts stay in the market's
 * currency; convert them with local.money as every other price.
 */
import { z } from "zod";
import raw from "../../data/sellers/delivery.json";
import { checkout, storeOrder, type Checkout, type StoreOrder } from "./delivery";
import type { Currency } from "./format";
import type { Local } from "./localize";
import { countryInSentence, type MarketCode } from "./markets";
import { deliversTo } from "./sellers";

const abroadRule = z.object({
  fee: z.number().min(0).nullable(),
  free_over: z.number().min(0).nullable(),
  /** A lower fee from an order size, for stores that charge less above a line instead of nothing. */
  fee_over: z.object({ from: z.number().positive(), fee: z.number().min(0) }).optional(),
  confidence: z.enum(["official", "secondary"]),
  note: z.string().optional(),
  sources: z.array(z.string().url()).min(1),
});

export type AbroadRule = z.infer<typeof abroadRule>;

/** Only the part this file reads: seller, then market, then the destination countries under `abroad`. */
const abroadFile = z.object({
  sellers: z.record(z.string(), z.record(z.string(), z.object({ abroad: z.record(z.string(), abroadRule).optional() }).passthrough())),
});

const ABROAD = abroadFile.parse(raw).sellers;

export function abroadRuleFor(seller: string, market: MarketCode, country: string): AbroadRule | null {
  return ABROAD[seller]?.[market]?.abroad?.[country] ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A store order for a shopper in another country: the same shape as storeOrder's, under that country's rule, or unknown. */
export type AbroadOrder = StoreOrder & { abroad: true; destination: string };

export function storeOrderTo(seller: string, market: MarketCode, country: string | null, subtotal: number): StoreOrder | AbroadOrder {
  if (!country || country === market) return storeOrder(seller, market, subtotal);
  const r = abroadRuleFor(seller, market, country);
  let delivery: number | null = null;
  let toFree: number | null = null;
  if (r) {
    if (r.free_over !== null && subtotal >= r.free_over) delivery = 0;
    else if (r.fee_over && subtotal >= r.fee_over.from) delivery = r.fee_over.fee;
    else delivery = r.fee;
    if (r.free_over !== null && subtotal < r.free_over) toFree = round2(r.free_over - subtotal);
  }
  return {
    seller,
    subtotal: round2(subtotal),
    delivery,
    toFree,
    freeOver: r?.free_over ?? null,
    // Store pickup and memberships are the home market's; neither helps someone in another country.
    pickup: false,
    membership: null,
    surcharge: 0,
    note: r?.note ?? null,
    sources: r?.sources ?? [],
    abroad: true,
    destination: country,
  };
}

export type CheckoutFor = Checkout & {
  /** The shopper's country when it isn't the market's, else null. */
  destination: string | null;
  /** Stores with no checked rule for delivery to that country. */
  unchecked: string[];
};

/** checkout() for a shopper in `country`. The market's own answer for its own shoppers and for an unknown country. */
export function checkoutFor(lines: { seller: string; price: number }[], market: MarketCode, country: string | null): CheckoutFor {
  if (!country || country === market) return { ...checkout(lines, market), destination: null, unchecked: [] };
  const bySeller = new Map<string, number>();
  for (const l of lines) bySeller.set(l.seller, (bySeller.get(l.seller) ?? 0) + l.price);
  const stores = [...bySeller].map(([seller, subtotal]) => storeOrderTo(seller, market, country, subtotal));
  const unchecked = stores.filter((s) => s.delivery === null).map((s) => s.seller);
  const delivery = unchecked.length ? null : round2(stores.reduce((s, o) => s + (o.delivery ?? 0), 0));
  const packs = lines.reduce((s, l) => s + l.price, 0);
  return { stores, delivery, surcharge: 0, payToday: round2(packs + (delivery ?? 0)), destination: country, unchecked };
}

/**
 * The line under a store's price on a swap page, or undefined for nothing to say. For the market's own shoppers it's the
 * home rule as before: only when a pack on its own falls under the free-delivery line. For a shopper elsewhere it's their
 * country's rule, or a plain "not checked", never the home market's rule.
 */
export function deliveryNote(seller: string, market: MarketCode, price: number, currency: Currency, local: Local): string | undefined {
  const country = local.known ? local.country : null;
  if (!country || country === market) {
    const order = storeOrder(seller, market, price);
    if (!order.delivery || order.freeOver === null) return undefined;
    return `Delivery ${local.money(order.delivery, currency)} on its own, free over ${local.money(order.freeOver, currency)}${order.pickup ? ", or free store pickup" : ""}`;
  }
  const where = countryInSentence(country);
  if (deliversTo(seller, market, country) === "no") return undefined;
  const order = storeOrderTo(seller, market, country, price);
  if (order.delivery === null) return `Delivery to ${where} not checked`;
  if (order.delivery === 0) return `Delivery to ${where} free on this order`;
  const free = order.freeOver !== null ? `, free over ${local.money(order.freeOver, currency)}` : "";
  return `Delivery to ${where} ${local.money(order.delivery, currency)} on its own${free}`;
}
