import { desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isAdminRequest } from "@/lib/server/admin";

/**
 * CSV downloads for the admin: /admin/export/<subscribers|submissions|clicks|conversions|lookups>
 *  - subscribers: confirmed addresses only (the ones that may be emailed), with each one's unsubscribe link token;
 *    add ?all=1 for every status.
 *  - clicks and lookups: the last 90 days, or ?days=N.
 */
const MAX_ROWS = 50_000;

/** A CSV cell: quoted when needed, and never starting a formula when opened in a spreadsheet. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}

export async function GET(request: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  if (!(await isAdminRequest())) return new Response("Authentication required", { status: 401 });
  const db = getDb();
  if (!db) return new Response("No database", { status: 503 });
  const { kind } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const days = Math.min(3650, Math.max(1, Number(params.get("days")) || 90));
  const since = new Date(Date.now() - days * 24 * 3600_000);

  let body: string;
  switch (kind) {
    case "subscribers": {
      const s = schema.subscribers;
      const q = db.select().from(s).orderBy(desc(s.createdAt)).limit(MAX_ROWS);
      const rows = await (params.has("all") ? q : q.where(eq(s.status, "confirmed")));
      body = csv(rows, ["email", "status", "country", "source", "createdAt", "confirmedAt", "unsubscribedAt", "token"]);
      break;
    }
    case "submissions": {
      const rows = await db.select().from(schema.submissions).orderBy(desc(schema.submissions.createdAt)).limit(MAX_ROWS);
      body = csv(rows, ["id", "status", "brandProduct", "alternativeProduct", "reason", "evidenceUrl", "email", "createdAt"]);
      break;
    }
    case "clicks": {
      const c = schema.clicks;
      const rows = await db.select().from(c).where(gte(c.createdAt, since)).orderBy(desc(c.createdAt)).limit(MAX_ROWS);
      body = csv(rows, ["createdAt", "pairSlug", "side", "retailer", "host", "program", "country", "source", "clickId", "referrer"]);
      break;
    }
    case "conversions": {
      const v = schema.conversions;
      const rows = await db.select().from(v).orderBy(desc(v.createdAt)).limit(MAX_ROWS);
      body = csv(rows, ["createdAt", "updatedAt", "network", "program", "orderId", "clickId", "status", "sale", "commission", "currency"]);
      break;
    }
    case "lookups": {
      const l = schema.lookups;
      const rows = await db.select().from(l).where(gte(l.createdAt, since)).orderBy(desc(l.createdAt)).limit(MAX_ROWS);
      body = csv(rows, ["createdAt", "kind", "query", "productName", "source", "sourceId", "verified", "country"]);
      break;
    }
    default:
      return new Response("Unknown export", { status: 404 });
  }
  const name = `samebutcheaper-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
