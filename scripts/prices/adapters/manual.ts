/**
 * Hand checks from a CSV, for prices a person read at a store (or a shopper reported and someone confirmed).
 *
 *   npx tsx scripts/prices/refresh.ts --manual checks.csv
 *
 * Columns: record, side, price, seen, url, and optionally currency (defaults to the record's), method
 * (hand or shopper-report, default hand), source (default the side's retailer) and note.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseCsv } from "./feed";
import type { PricedRecord } from "../records";
import type { AdapterContext, AdapterResult, Candidate, PriceAdapter } from "./types";

export function manualCandidates(rows: Record<string, string>[], records: PricedRecord[], today: string): AdapterResult {
  const bySlug = new Map(records.map((r) => [r.slug, r]));
  const candidates: Candidate[] = [];
  const notes: string[] = [];
  rows.forEach((row, i) => {
    const line = `manual line ${i + 2}`;
    const record = bySlug.get(row.record);
    const side = record?.sides.find((s) => s.side === row.side);
    const price = Number(row.price);
    const method = row.method || "hand";
    const currency = (row.currency || record?.currency || "").toUpperCase();
    const problem = !record
      ? `no record ${row.record}`
      : !side
        ? `${row.record} has no side ${row.side}`
        : !(price > 0)
          ? `price ${row.price} isn't a price`
          : !/^\d{4}-\d{2}-\d{2}$/.test(row.seen ?? "") || row.seen > today
            ? `seen ${row.seen} isn't a past ISO day`
            : currency !== record.currency
              ? `in ${currency}, but ${row.record} is priced in ${record.currency}`
              : method !== "hand" && method !== "shopper-report"
                ? `method ${method} isn't hand or shopper-report`
                : !/^https?:\/\//.test(row.url ?? "")
                  ? "needs the url where the price was read"
                  : null;
    if (problem) {
      notes.push(`${line}: ${problem}, skipped`);
      return;
    }
    candidates.push({
      record: record!.slug,
      side: side!.side,
      price,
      currency,
      seen: row.seen,
      source: row.source || side!.retailer,
      url: row.url,
      method: method as Candidate["method"],
      note: row.note || undefined,
    });
  });
  notes.unshift(`manual: ${rows.length} line(s), ${candidates.length} usable`);
  return { candidates, notes };
}

export function manualAdapter(path: string): PriceAdapter {
  return {
    id: "manual",
    licence: "Our own hand checks",
    async collect(records: PricedRecord[], ctx: AdapterContext) {
      if (!existsSync(path)) return { candidates: [], notes: [`manual: ${path} not found`] };
      return manualCandidates(parseCsv(readFileSync(path, "utf8")), records, ctx.today);
    },
  };
}
