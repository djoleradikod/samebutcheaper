/**
 * Open Prices (https://prices.openfoodfacts.org), the Open Food Facts project's crowd-sourced price log.
 * Data is ODbL 1.0: we may reuse it with credit, which every observation carries in `attribution`.
 * API: GET /api/v1/prices?product_code=<GTIN>, documented at
 * https://openfoodfacts.github.io/documentation/docs/Open-prices/prices/prices_list/
 *
 * A price counts only when it's for the record's own pack (by barcode), in the record's market and currency,
 * seen recently (OPEN_PRICES_MAX_AGE_DAYS, default 60), at a physical store of the same chain when the record
 * names one, at full price (not a promotion), with a proof photo or receipt, and not marked a duplicate.
 */
import { z } from "zod";
import { isChain } from "../chains";
import type { PricedRecord, PricedSide } from "../records";
import { addDays, type AdapterContext, type AdapterResult, type Candidate, type PriceAdapter } from "./types";

export const OPEN_PRICES_API = "https://prices.openfoodfacts.org/api/v1/prices";
export const OPEN_PRICES_ATTRIBUTION = "Open Prices, by Open Food Facts contributors, ODbL 1.0 (https://prices.openfoodfacts.org)";
/** Open Food Facts asks API users to name their app in the User-Agent. */
const USER_AGENT = "SameButCheaper-PriceWatch/1.0";

const item = z.object({
  id: z.number(),
  type: z.string(),
  product_code: z.string().nullable(),
  price: z.number(),
  price_is_discounted: z.boolean().nullable().optional(),
  price_per: z.string().nullable().optional(),
  currency: z.string(),
  date: z.string(),
  proof_id: z.number().nullable().optional(),
  duplicate_of: z.number().nullable().optional(),
  location: z
    .object({
      type: z.string().nullable().optional(),
      osm_name: z.string().nullable().optional(),
      osm_brand: z.string().nullable().optional(),
      osm_address_city: z.string().nullable().optional(),
      osm_address_country_code: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  product: z
    .object({
      product_quantity: z.number().nullable().optional(),
      product_quantity_unit: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export const openPricesPage = z.object({ items: z.array(item), total: z.number().optional(), pages: z.number().optional() });
export type OpenPricesItem = z.infer<typeof item>;

export type OpenPricesOptions = { maxAgeDays: number };

/** Why an item can't update this side, or null when it can. Pure, and the heart of the tests. */
export function rejectReason(it: OpenPricesItem, record: PricedRecord, side: PricedSide, today: string, opts: OpenPricesOptions): string | null {
  if (it.type !== "PRODUCT") return "not a product price";
  if (it.product_code !== side.gtin) return "another barcode";
  if (it.currency !== record.currency) return `in ${it.currency}, not ${record.currency}`;
  if (it.location?.type !== "OSM") return "not a physical store";
  if (it.location.osm_address_country_code?.toUpperCase() !== record.market) return `in ${it.location.osm_address_country_code ?? "an unknown country"}, not ${record.market}`;
  if (it.date > today) return "dated in the future";
  if (it.date < addDays(today, -opts.maxAgeDays)) return `older than ${opts.maxAgeDays} days`;
  if (it.price_is_discounted) return "a promotion price";
  if (it.price_per && it.price_per !== "UNIT") return `priced per ${it.price_per.toLowerCase()}`;
  if (it.proof_id == null) return "no proof";
  if (it.duplicate_of != null) return "marked a duplicate";
  if (side.retailer !== "other" && !isChain(it.location.osm_brand, side.retailer) && !isChain(it.location.osm_name, side.retailer))
    return `at ${it.location.osm_brand ?? it.location.osm_name ?? "another store"}, not ${side.retailer}`;
  if (!(it.price > 0)) return "no price";
  return null;
}

/**
 * The latest accepted item. Stores in one chain can price differently by region, so when several were
 * seen on that latest day the median price stands for them (the lower middle one for an even count).
 */
export function pickItem(items: OpenPricesItem[]): OpenPricesItem | null {
  if (!items.length) return null;
  const latest = items.reduce((d, it) => (it.date > d ? it.date : d), "");
  const sameDay = items.filter((it) => it.date === latest).sort((a, b) => a.price - b.price || a.id - b.id);
  return sameDay[Math.floor((sameDay.length - 1) / 2)];
}

export function toCandidate(it: OpenPricesItem, record: PricedRecord, side: PricedSide): Candidate {
  const where = [it.location?.osm_name, it.location?.osm_address_city].filter(Boolean).join(", ");
  const q = it.product?.product_quantity;
  const unit = it.product?.product_quantity_unit;
  return {
    record: record.slug,
    side: side.side,
    price: it.price,
    currency: it.currency,
    seen: it.date,
    source: "open-prices",
    url: `https://prices.openfoodfacts.org/prices/${it.id}`,
    method: "open-prices",
    attribution: OPEN_PRICES_ATTRIBUTION,
    note: where ? `Seen at ${where}` : undefined,
    // Open Food Facts stores a missing quantity as a huge negative number.
    pack: q && q > 0 && unit ? { size: q, unit } : null,
  };
}

export function openPricesUrl(gtin: string, today: string, opts: OpenPricesOptions) {
  const q = new URLSearchParams({ product_code: gtin, date__gte: addDays(today, -opts.maxAgeDays), order_by: "-date", size: "100" });
  return `${OPEN_PRICES_API}?${q}`;
}

export const openPricesAdapter: PriceAdapter = {
  id: "open-prices",
  licence: "Open Prices API (Open Food Facts), ODbL 1.0, credited on every observation",
  async collect(records: PricedRecord[], ctx: AdapterContext): Promise<AdapterResult> {
    const opts: OpenPricesOptions = { maxAgeDays: Number(ctx.env.OPEN_PRICES_MAX_AGE_DAYS) || 60 };
    const delay = ctx.env.OPEN_PRICES_DELAY_MS === undefined ? 1000 : Number(ctx.env.OPEN_PRICES_DELAY_MS);
    const byGtin = new Map<string, { record: PricedRecord; side: PricedSide }[]>();
    for (const record of records)
      for (const side of record.sides) if (side.gtin) byGtin.set(side.gtin, [...(byGtin.get(side.gtin) ?? []), { record, side }]);
    const candidates: Candidate[] = [];
    const notes: string[] = [];
    let asked = 0;
    let failed = 0;
    for (const [gtin, targets] of byGtin) {
      if (asked++) await ctx.sleep(delay);
      let items: OpenPricesItem[];
      try {
        const res = await ctx.fetch(openPricesUrl(gtin, ctx.today, opts), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        items = openPricesPage.parse(JSON.parse(Buffer.from(await res.arrayBuffer()).toString("utf8"))).items;
      } catch (err) {
        failed++;
        if (failed <= 3) notes.push(`open-prices: ${gtin} failed (${err instanceof Error ? err.message : String(err)})`);
        continue;
      }
      for (const { record, side } of targets) {
        const accepted = items.filter((it) => rejectReason(it, record, side, ctx.today, opts) === null);
        const pick = pickItem(accepted);
        if (pick) candidates.push(toCandidate(pick, record, side));
      }
    }
    notes.unshift(`open-prices: asked about ${byGtin.size} barcode(s), ${candidates.length} usable price(s)${failed ? `, ${failed} request(s) failed` : ""}`);
    return { candidates, notes };
  },
};
