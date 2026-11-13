/**
 * What it costs to get a basket delivered: each store's free-delivery threshold, fee and membership rules,
 * from data/sellers/delivery.json. Pure, for the catalogue build, server and client.
 *
 * A kit is one checkout. Rebuilding it can mean two or three, each with its own minimum, so a rebuild's real
 * cost is its packs plus every store's delivery. We only add a fee we have a source for: an unknown rule
 * makes the delivery total unknown, and the page says so instead of guessing.
 */
import { z } from "zod";
import raw from "../../data/sellers/delivery.json";
import { MARKET_CODES, type MarketCode } from "./markets";

const rule = z.object({
  fee: z.number().min(0).nullable(),
  free_over: z.number().min(0).nullable(),
  pickup: z.boolean().optional(),
  confidence: z.enum(["official", "secondary"]),
  note: z.string().optional(),
  membership: z
    .object({
      name: z.string().min(1),
      price: z.number().positive(),
      per: z.enum(["year", "month"]),
      nonmember_surcharge_pct: z.number().min(0).optional(),
    })
    .optional(),
  sources: z.array(z.string().url()).min(1),
});

export const deliveryFileSchema = z.object({
  checked: z.string().min(4),
  method: z.string().min(10),
  sellers: z.record(z.string(), z.partialRecord(z.enum(MARKET_CODES), rule)),
});

export type DeliveryRule = z.infer<typeof rule>;

const file = deliveryFileSchema.parse(raw);

export const DELIVERY_CHECKED = file.checked;

export function deliveryRule(seller: string, market: MarketCode): DeliveryRule | null {
  return file.sellers[seller]?.[market] ?? null;
}

/** One store's part of a basket. */
export type StoreOrder = {
  seller: string;
  /** What the packs from this store cost together. */
  subtotal: number;
  /** Home delivery for this order: 0 when free, null when we don't know. */
  delivery: number | null;
  /** How much more to add to reach free delivery, when the order falls short and the rule is known. */
  toFree: number | null;
  freeOver: number | null;
  /** True when a source says this store has free pickup, so delivery can be avoided. */
  pickup: boolean;
  /** A membership the store asks for, with the non-member surcharge when that's the alternative. */
  membership: DeliveryRule["membership"] | null;
  /** The surcharge a non-member pays on this order, when the store allows non-members at a price. */
  surcharge: number;
  note: string | null;
  sources: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The order at one store: its delivery charge against its threshold, and any membership cost. */
export function storeOrder(seller: string, market: MarketCode, subtotal: number): StoreOrder {
  const r = deliveryRule(seller, market);
  let delivery: number | null = null;
  let toFree: number | null = null;
  if (r) {
    if (r.free_over !== null && subtotal >= r.free_over) delivery = 0;
    else if (r.fee === 0) delivery = 0;
    else if (r.fee !== null) delivery = r.fee;
    if (r.free_over !== null && subtotal < r.free_over) toFree = round2(r.free_over - subtotal);
  }
  const surcharge = r?.membership?.nonmember_surcharge_pct ? round2((subtotal * r.membership.nonmember_surcharge_pct) / 100) : 0;
  return {
    seller,
    subtotal: round2(subtotal),
    delivery,
    toFree,
    freeOver: r?.free_over ?? null,
    pickup: r?.pickup ?? false,
    membership: r?.membership ?? null,
    surcharge,
    note: r?.note ?? null,
    sources: r?.sources ?? [],
  };
}

/** Everything a basket costs at checkout, store by store. */
export type Checkout = {
  stores: StoreOrder[];
  /** Sum of every store's delivery, or null when any store's rule is unknown. */
  delivery: number | null;
  /** Non-member surcharges, where a store charges one instead of a membership. */
  surcharge: number;
  /** Packs plus known delivery and surcharges. */
  payToday: number;
};

export function checkout(lines: { seller: string; price: number }[], market: MarketCode): Checkout {
  const bySeller = new Map<string, number>();
  for (const l of lines) bySeller.set(l.seller, (bySeller.get(l.seller) ?? 0) + l.price);
  const stores = [...bySeller].map(([seller, subtotal]) => storeOrder(seller, market, subtotal));
  const known = stores.every((s) => s.delivery !== null);
  const delivery = known ? round2(stores.reduce((s, o) => s + (o.delivery ?? 0), 0)) : null;
  const surcharge = round2(stores.reduce((s, o) => s + o.surcharge, 0));
  const packs = lines.reduce((s, l) => s + l.price, 0);
  return { stores, delivery, surcharge, payToday: round2(packs + (delivery ?? 0) + surcharge) };
}

/** The stores in a checkout whose delivery we haven't checked, so a page can say so once. */
export function uncheckedStores(c: Pick<Checkout, "stores">): string[] {
  return c.stores.filter((s) => s.delivery === null).map((s) => s.seller);
}

/**
 * Whole packs of the cheaper product that cover `need` packs' worth. A pack that falls short by a tenth or less
 * counts as enough: nobody buys a second 15 oz can because the brand's is 15.5 oz.
 */
export function wholePacks(need: number): number {
  if (!(need > 0)) return 0;
  return Math.max(1, Math.ceil(need - 0.1 - 1e-9));
}

/** What one basket line needs to price its till cost at any quantity. */
export type TillLine = {
  seller: string;
  /** Cost of the same amount as `qty` brand packs, at the cheaper product's unit price. */
  altCost: number;
  qty: number;
  /** The cheaper product's real pack, and how many of them one brand pack's amount takes. Null when its price is per amount (per 100 ml), not a pack. */
  pack: { price: number; per: number } | null;
};

/** A line at quantity n: whole packs at the till, or the same-amount cost where there's no pack to count. */
export function tillLine(line: TillLine, n: number): { packs: number | null; cost: number } {
  if (n <= 0) return { packs: 0, cost: 0 };
  if (!line.pack) return { packs: null, cost: round2((line.altCost / line.qty) * n) };
  const packs = wholePacks(n * line.pack.per);
  return { packs, cost: round2(packs * line.pack.price) };
}

/** A basket's checkout at these quantities: each line in whole packs, one order per store. */
export function basketCheckout(lines: readonly TillLine[], qty: readonly number[], market: MarketCode): Checkout {
  const priced = lines
    .map((l, i) => ({ seller: l.seller, price: tillLine(l, qty[i] ?? l.qty).cost }))
    .filter((l) => l.price > 0);
  return checkout(priced, market);
}
