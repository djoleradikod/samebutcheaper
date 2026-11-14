/**
 * Which feed rows are which catalogue record sides. A wrong match is worse than a miss, so in this order and no
 * further:
 *
 *   1. barcode: the row's GTIN, EAN or UPC equals the side's (the record's `gtin`), compared as GTIN-14;
 *   2. store number: the number in the side's product URL (ids.ts), or the side's German PZN, equals the row's
 *      merchant SKU or product id, or the number in the row's own product URL. A row whose barcode contradicts
 *      the side's is never used;
 *   3. name: same brand, every word of the side's product name in the row's name, and the same pack, and only
 *      when exactly one row in the whole feed fits. These always go to review, never straight onto the site.
 *
 * Only sides at the feed's own retailer in the feed's own market are considered, never a side priced per wash or per
 * day (it names no pack a row could be), and a side two different rows
 * claim at different prices is left alone (reported as ambiguous). Rows are streamed in one at a time; only
 * the few that hit a side are kept.
 */
import { fold } from "../chains";
import type { PricedRecord, PricedSide } from "../records";
import { isPzn } from "../../../src/lib/gtin";
import { isSearchUrl, needsVariant, storeIdOf } from "./ids";
import { parsePack, type FeedRow, type Pack } from "./row";

export type MatchBy = "gtin" | "id" | "name";
export type FeedMatch = { record: PricedRecord; side: PricedSide; row: FeedRow; by: MatchBy };
export type SideRef = { record: PricedRecord; side: PricedSide };

/** A product URL without tracking: lower-case host without www, no query or fragment, no trailing slash. */
export function normalUrl(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** GTIN-8, UPC-A (12), EAN-13 and GTIN-14 of one product are the same number padded to 14. */
export function gtin14(code: string) {
  return code.replace(/\D/g, "").padStart(14, "0");
}

const STOP = new Set(["the", "and", "with", "for", "of", "a", "an", "x", "pack", "und", "mit", "fur", "fuer", "der", "die", "das", "in", "pk", "ct", "count", "g", "kg", "mg", "mcg", "ml", "l", "cl", "oz", "fl", "lb", "lbs", "st", "stk"]);
const PACK_WORD = /^\d+([.,]\d+)?(g|kg|ml|l|cl|oz|lb|mg|ct|pk|st|stk|x)?$/;

/** The words that name a product: folded, without numbers-with-units, filler words or its brand's words. */
export function nameWords(name: string, brand = "") {
  const brandWords = new Set(fold(brand).split(" "));
  return fold(name)
    .split(" ")
    .filter((w) => w && !STOP.has(w) && !PACK_WORD.test(w) && !brandWords.has(w));
}

const TO_BASE: Record<string, [string, number]> = { g: ["g", 1], kg: ["g", 1000], oz: ["g", 28.3495], lb: ["g", 453.592], ml: ["ml", 1], cl: ["ml", 10], l: ["ml", 1000], "fl oz": ["ml", 29.5735] };
const COUNT_UNITS = new Set(["count", "ct", "tablet", "capsule", "caplet", "softgel", "gelcap", "gummy", "gummie", "lozenge", "wipe", "sheet", "roll", "bag", "pod", "sachet", "cell", "battery", "batterie", "piece", "pack", "stuck", "stück"]);

/** Same pack within 1%: grams with grams, millilitres with millilitres, counts with counts. */
export function samePack(side: Pick<PricedSide, "size" | "unit">, pack: Pack | null) {
  if (!pack) return false;
  const unit = side.unit.toLowerCase();
  if (COUNT_UNITS.has(unit) || COUNT_UNITS.has(unit.replace(/s$/, ""))) return pack.unit === "count" && pack.size === side.size;
  const a = TO_BASE[unit];
  const b = TO_BASE[pack.unit];
  if (!a || !b || a[0] !== b[0]) return false;
  return Math.abs(a[1] * side.size - b[1] * pack.size) / (a[1] * side.size) <= 0.01;
}

type SideState = SideRef & { gtin: FeedRow[]; id: FeedRow[]; name: FeedRow[]; words: string[]; brand: string };

const KEEP = 4;

export class FeedMatcher {
  private sides: SideState[] = [];
  private byGtin = new Map<string, SideState[]>();
  private byId = new Map<string, SideState[]>();
  private byBrandWord = new Map<string, SideState[]>();
  readonly conflicts: string[] = [];
  rows = 0;

  constructor(records: PricedRecord[], feed: { retailer: string; market: string }) {
    for (const record of records) {
      if (record.market !== feed.market) continue;
      for (const side of record.sides) {
        if (side.retailer !== feed.retailer || side.perAmount) continue;
        const brand = fold(side.brand);
        const s: SideState = { record, side, gtin: [], id: [], name: [], words: nameWords(side.name, side.brand), brand };
        this.sides.push(s);
        if (side.gtin) push(this.byGtin, gtin14(side.gtin), s);
        // Pharmacies' feeds carry the PZN as their own product number.
        if (side.pzn) push(this.byId, `pzn:${side.pzn}`, s);
        const sid = storeIdOf(side.url);
        if (sid && (!needsVariant(sid.store) || sid.variant)) push(this.byId, sid.variant ?? sid.id, s);
        // The same product page, for stores without a number pattern. Never a search page, never a variant store.
        const page = normalUrl(side.url);
        if (page && !isSearchUrl(side.url) && !(sid && needsVariant(sid.store))) push(this.byId, `url:${page}`, s);
        if (brand) push(this.byBrandWord, brand.split(" ")[0], s);
      }
    }
  }

  /** How many record sides this feed could price at all. */
  get sideCount() {
    return this.sides.length;
  }

  add(row: FeedRow) {
    this.rows++;
    const hit = new Set<SideState>();
    for (const g of row.gtins) {
      for (const s of this.byGtin.get(gtin14(g)) ?? []) {
        if (s.gtin.length < KEEP) s.gtin.push(row);
        hit.add(s);
      }
    }
    const rowIds = new Set<string>(row.skus);
    for (const sku of row.skus) {
      const digits = sku.replace(/^PZN[\s:-]*/i, "");
      if (/^\d{7,8}$/.test(digits) && isPzn(digits.padStart(8, "0"))) rowIds.add(`pzn:${digits.padStart(8, "0")}`);
    }
    const sid = storeIdOf(row.productUrl);
    if (sid) rowIds.add(sid.variant ?? sid.id);
    const page = row.productUrl ? normalUrl(row.productUrl) : null;
    if (page && !(sid && needsVariant(sid.store))) rowIds.add(`url:${page}`);
    for (const id of rowIds) {
      for (const s of this.byId.get(id) ?? []) {
        if (hit.has(s)) continue;
        // A barcode on both that disagrees: the number means something else in this feed.
        if (s.side.gtin && row.gtins.length && !row.gtins.some((g) => gtin14(g) === gtin14(s.side.gtin!))) {
          if (this.conflicts.length < 20) this.conflicts.push(`${s.record.slug} ${s.side.side}: store number ${id} matched a row with another barcode, not used`);
          continue;
        }
        if (s.id.length < KEEP) s.id.push(row);
        hit.add(s);
      }
    }
    const rowBrand = fold(row.brand ?? "");
    const rowName = fold(row.name);
    const keys = new Set([rowBrand.split(" ")[0], rowName.split(" ")[0]].filter(Boolean));
    for (const k of keys) {
      for (const s of this.byBrandWord.get(k) ?? []) {
        if (hit.has(s) || !s.words.length) continue;
        if (!(rowBrand === s.brand || rowName.startsWith(`${s.brand} `))) continue;
        const words = new Set(nameWords(row.name, row.brand ?? s.side.brand));
        if (!s.words.every((w) => words.has(w))) continue;
        if (!samePack(s.side, parsePack(row.packText) ?? parsePack(row.name))) continue;
        if (s.name.length < KEEP) s.name.push(row);
      }
    }
  }

  /** The matches, strongest kind per side. A side whose rows disagree on price or stock is left out and noted. */
  result(): { matches: FeedMatch[]; ambiguous: string[] } {
    const matches: FeedMatch[] = [];
    const ambiguous: string[] = [];
    for (const s of this.sides) {
      const [by, rows] = s.gtin.length ? (["gtin", s.gtin] as const) : s.id.length ? (["id", s.id] as const) : s.name.length ? (["name", s.name] as const) : [null, []];
      if (!by) continue;
      if (by === "name" && rows.length > 1) {
        ambiguous.push(`${s.record.slug} ${s.side.side}: ${rows.length} rows fit by name, none used`);
        continue;
      }
      const agree = rows.every((r) => r.price === rows[0].price && r.inStock === rows[0].inStock && r.currency === rows[0].currency);
      if (!agree) {
        ambiguous.push(`${s.record.slug} ${s.side.side}: ${rows.length} rows with this ${by === "gtin" ? "barcode" : "store number"} disagree on price or stock, none used`);
        continue;
      }
      matches.push({ record: s.record, side: s.side, row: rows[0], by });
    }
    return { matches, ambiguous };
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
