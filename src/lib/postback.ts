/**
 * Reads a sale report from an affiliate network into one shape. Networks disagree on field names and on how the
 * report is packed, so this accepts the common spellings (case-insensitive); our own names (click, order,
 * commission, sale, currency, status) always win.
 */
export type Postback = {
  network: string;
  orderId: string;
  clickId: string | null;
  commission: string;
  sale: string | null;
  currency: string;
  status: "pending" | "approved" | "reversed";
  /** The report as received, minus the key and anything personal, kept for troubleshooting. */
  raw: Record<string, string>;
};

const ALIASES: Record<string, string[]> = {
  click: ["click", "subid1", "subid", "clickref", "clickref1", "u1", "sid", "xcust", "cuid", "pubref", "fobs"],
  order: ["order", "orderid", "order_id", "transactionid", "transaction_id", "actionid", "action_id", "id"],
  commission: ["commission", "payout", "commissionamount", "commissionamount.amount", "commission_amount", "earnings"],
  sale: ["sale", "saleamount", "saleamount.amount", "sale_amount", "transactionamount", "amount", "ordervalue"],
  currency: ["currency", "transactioncurrency", "commissionamount.currency", "saleamount.currency"],
  status: ["status", "actionstatus", "commissionstatus", "state"],
};

const STATUS: Record<string, Postback["status"]> = {
  pending: "pending",
  approved: "approved",
  locked: "approved",
  paid: "approved",
  confirmed: "approved",
  declined: "reversed",
  reversed: "reversed",
  rejected: "reversed",
  cancelled: "reversed",
  canceled: "reversed",
};

/** Fields a network may send about the shopper or their basket. We never keep them. */
const PERSONAL = /^products(\.|$)|(^|[._])(ip|ipaddress|ip_address|email|phone|customer\w*|name|address|useragent|user_agent|url|phrase)$/i;

/** {commissionAmount: {amount: 1}} -> {"commissionAmount.amount": "1"}, so nested JSON reports work too. */
export function flatten(o: unknown, prefix = "", out: Record<string, string> = {}, depth = 0): Record<string, string> {
  if (depth > 3 || !o || typeof o !== "object") return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = String(v);
    else flatten(v, key, out, depth + 1);
  }
  return out;
}

/**
 * Form fields from a POST. A field that holds a JSON object is unpacked in place: Awin posts its whole report as
 * JSON inside one form field, "AwinTransactionPush".
 */
export function formFields(entries: Iterable<[string, unknown]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v !== "string") continue;
    const text = v.trim();
    if (text.startsWith("{") && text.endsWith("}")) {
      try {
        flatten(JSON.parse(text), "", out);
        continue;
      } catch {
        // Not JSON after all: keep it as a plain value.
      }
    }
    out[k] = v;
  }
  return out;
}

function money(v: string | undefined): string | null {
  if (v == null || v === "") return null;
  const digits = String(v).replace(/[^0-9.-]/g, "");
  // "abc" has no number in it; Number("") would call that zero.
  if (!/\d/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) && Math.abs(n) < 1e10 ? n.toFixed(2) : null;
}

export function parsePostback(all: Record<string, string>): { ok: true; value: Postback } | { ok: false; error: string } {
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), v]));
  const pick = (field: string) => ALIASES[field].map((n) => lower[n]).find((v) => v != null && v !== "");

  const network = (all.network ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  const orderId = (pick("order") ?? "").slice(0, 120);
  const commission = money(pick("commission"));
  if (!network || !orderId || commission === null) return { ok: false, error: "network, order and commission are required" };

  const click = pick("click") ?? "";
  const currency = pick("currency") ?? "";
  const raw = Object.fromEntries(
    Object.entries(all)
      .filter(([k]) => k !== "key" && !PERSONAL.test(k))
      .slice(0, 80)
      .map(([k, v]) => [k.slice(0, 80), v.slice(0, 500)]),
  );
  return {
    ok: true,
    value: {
      network,
      orderId,
      clickId: /^[a-z0-9]{6,24}$/.test(click) ? click : null,
      commission,
      sale: money(pick("sale")),
      currency: /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD",
      status: STATUS[(pick("status") ?? "pending").toLowerCase()] ?? "pending",
      raw,
    },
  };
}
