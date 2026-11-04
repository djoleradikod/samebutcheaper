import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Sale postbacks from affiliate networks, so the dashboard shows real
 * earnings per swap (not just clicks):
 *
 *   /api/postback?key=<POSTBACK_SECRET>&network=impact&click=<sub-ID>
 *     &order=<order or action ID>&commission=<payout>&sale=<order total>
 *     &currency=USD&status=pending|approved|reversed
 *
 * Set it up once per network with that network's macros in place of the
 * values (docs/affiliate-playbook.md has the exact URLs). GET or POST (form
 * or JSON). A repeat for the same network + order updates the row, so status
 * changes (pending -> approved or reversed) come through.
 */
export async function GET(request: Request) {
  return handle(request, Object.fromEntries(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const type = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};
  try {
    if (type.includes("json")) body = (await request.json()) as Record<string, unknown>;
    else if (type.includes("form")) body = Object.fromEntries((await request.formData()).entries());
  } catch {
    return new Response("Bad body", { status: 400 });
  }
  const merged: Record<string, string> = { ...query };
  for (const [k, v] of Object.entries(body)) if (typeof v === "string" || typeof v === "number") merged[k] = String(v);
  return handle(request, merged);
}

const STATUS: Record<string, "pending" | "approved" | "reversed"> = {
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

async function handle(_request: Request, p: Record<string, string>) {
  const secret = process.env.POSTBACK_SECRET;
  if (!secret || !safeEqual(p.key ?? "", secret)) return new Response("Forbidden", { status: 403 });
  const db = getDb();
  if (!db) return new Response("No database", { status: 503 });

  const network = (p.network ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  const orderId = (p.order ?? "").slice(0, 120);
  const commission = money(p.commission);
  if (!network || !orderId || commission === null) {
    return new Response("network, order and commission are required", { status: 400 });
  }
  const clickId = /^[a-z0-9]{6,24}$/.test(p.click ?? "") ? p.click : null;
  const sale = money(p.sale);
  const currency = /^[A-Za-z]{3}$/.test(p.currency ?? "") ? p.currency.toUpperCase() : "USD";
  const status = STATUS[(p.status ?? "pending").toLowerCase()] ?? "pending";
  const raw = Object.fromEntries(Object.entries(p).filter(([k]) => k !== "key"));

  let program: string | null = null;
  if (clickId) {
    const [click] = await db
      .select({ program: schema.clicks.program })
      .from(schema.clicks)
      .where(eq(schema.clicks.clickId, clickId))
      .limit(1);
    program = click?.program ?? null;
  }

  await db
    .insert(schema.conversions)
    .values({ network, orderId, clickId, program, sale, commission, currency, status, raw })
    .onConflictDoUpdate({
      target: [schema.conversions.network, schema.conversions.orderId],
      set: {
        commission,
        sale,
        status,
        raw,
        clickId: sql`coalesce(excluded.click_id, ${schema.conversions.clickId})`,
        program: sql`coalesce(excluded.program, ${schema.conversions.program})`,
        updatedAt: new Date(),
      },
    });
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}

function money(v: string | undefined): string | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
