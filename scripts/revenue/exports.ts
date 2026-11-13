/**
 * Commission exports from affiliate networks, dropped as CSV files in a folder (docs/feeds.md, "Revenue report"), read
 * into one shape so the report can join them to our clicks by click ID.
 *
 * NOT TESTED AGAINST A REAL EXPORT: no network account exists yet. Column names come from the networks' public docs,
 * with the spellings their dashboards' CSV downloads are likely to use as aliases:
 *   - Awin, Publisher API "transactions" (help.awin.com/apidocs): transaction id, advertiser, commission and sale amount,
 *     currency, status (pending, approved, declined, deleted), date, `orderRef`, and `clickRef` (our click ID, sent as
 *     `clickref` on the link by src/lib/feed-links.ts and affiliate-links.ts).
 *   - Impact, Partner API "Actions" (integrations.impact.com): `Id`, `CampaignName`, `State`, `Amount`, `Payout`,
 *     `Currency`, `EventDate`, `OrderId`, `AdId`, and `SubId1` (our click ID).
 * Fixtures written from those docs are in scripts/revenue/fixtures. A file whose columns match neither is reported, not
 * guessed at.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "../prices/adapters/feed";
import { parsePrice } from "../prices/feeds/row";

export type Earning = {
  network: string;
  /** The network's id for the sale, unique within the network. */
  orderId: string;
  /** Our click ID from the network's sub-ID field, when it came back. */
  clickId: string | null;
  advertiser: string;
  commission: number;
  sale: number | null;
  currency: string;
  status: "pending" | "approved" | "reversed";
  /** ISO day of the sale. */
  day: string | null;
  file: string;
};

const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The first non-empty value among a row's columns with any of these names (spelling, case and spaces ignored). */
function pick(row: Record<string, string>, ...names: string[]) {
  const wanted = names.map(fold);
  for (const [k, v] of Object.entries(row)) if (wanted.includes(fold(k)) && String(v).trim()) return String(v).trim();
  return null;
}

const has = (headers: string[], ...names: string[]) => names.some((n) => headers.some((h) => fold(h) === fold(n)));

export function formatOf(headers: string[]): "awin" | "impact" | null {
  if (has(headers, "SubId1", "Sub Id 1", "CampaignName", "Campaign") && has(headers, "Payout", "Action Earnings")) return "impact";
  if (has(headers, "clickRef", "Click Ref", "Clickref") && has(headers, "commissionAmount", "Commission Amount", "Commission")) return "awin";
  return null;
}

function statusOf(raw: string | null): Earning["status"] {
  const s = fold(raw ?? "");
  if (["approved", "confirmed", "locked", "cleared", "paid"].includes(s)) return "approved";
  if (["declined", "deleted", "reversed", "rejected", "voided", "cancelled", "canceled"].includes(s)) return "reversed";
  return "pending";
}

function dayOf(raw: string | null) {
  const s = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // Awin's UI exports write 13/11/2026; Impact's 11/13/2026 is told apart only when the day is over 12.
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** One export file's text into earnings, or the reason it couldn't be read. */
export function readExport(text: string, file: string): { earnings: Earning[]; problem: string | null } {
  const rows = parseCsv(text).filter((r) => Object.values(r).some((v) => String(v).trim()));
  if (!rows.length) return { earnings: [], problem: `${file}: no rows` };
  const network = formatOf(Object.keys(rows[0]));
  if (!network) return { earnings: [], problem: `${file}: columns match neither the Awin nor the Impact export (${Object.keys(rows[0]).slice(0, 8).join(", ")})` };
  const earnings: Earning[] = [];
  let skipped = 0;
  for (const r of rows) {
    const commission = network === "impact" ? parseMoney(pick(r, "Payout", "Action Earnings")) : parseMoney(pick(r, "commissionAmount", "Commission Amount", "Commission"));
    const orderId =
      network === "impact"
        ? pick(r, "Id", "Action Id", "ActionId", "OrderId", "Oid")
        : pick(r, "id", "Transaction ID", "TransactionId", "orderRef", "Order Ref");
    if (commission === null || !orderId) {
      skipped++;
      continue;
    }
    earnings.push({
      network,
      orderId,
      clickId: (network === "impact" ? pick(r, "SubId1", "Sub Id 1") : pick(r, "clickRef", "Click Ref", "Clickref"))?.slice(0, 24) ?? null,
      advertiser: (network === "impact" ? pick(r, "CampaignName", "Campaign") : pick(r, "advertiserName", "Advertiser Name", "Advertiser")) ?? "",
      commission,
      sale: parseMoney(network === "impact" ? pick(r, "Amount", "Sale Amount") : pick(r, "saleAmount", "Sale Amount")),
      currency: (pick(r, "Currency", "commissionCurrency", "Commission Currency") ?? "").toUpperCase().slice(0, 3) || "USD",
      status: statusOf(network === "impact" ? pick(r, "State", "Status", "Action Status") : pick(r, "commissionStatus", "Commission Status", "Status")),
      day: dayOf(network === "impact" ? pick(r, "EventDate", "Event Date", "Action Date") : pick(r, "transactionDate", "Transaction Date", "Date")),
      file,
    });
  }
  return { earnings, problem: skipped ? `${file}: ${skipped} row(s) without an order id or commission, left out` : null };
}

/** A commission can be zero (a declined sale), unlike a price. */
function parseMoney(raw: string | null) {
  if (raw == null) return null;
  if (/^-?0+([.,]0+)?$/.test(raw.replace(/[^\d.,-]/g, ""))) return 0;
  const n = parsePrice(raw.replace(/^-/, ""));
  return n === null ? null : raw.trim().startsWith("-") ? -n : n;
}

/** Every .csv in a folder (missing folder: none). */
export function readExportFolder(dir: string): { earnings: Earning[]; problems: string[]; files: number } {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".csv")).sort();
  } catch {
    return { earnings: [], problems: [], files: 0 };
  }
  const earnings: Earning[] = [];
  const problems: string[] = [];
  for (const n of names) {
    const out = readExport(readFileSync(join(dir, n), "utf8"), n);
    earnings.push(...out.earnings);
    if (out.problem) problems.push(out.problem);
  }
  return { earnings, problems, files: names.length };
}
