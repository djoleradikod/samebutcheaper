import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { sameSecret } from "@/lib/admin-auth";
import { log } from "@/lib/log";
import { flatten, formFields, parsePostback } from "@/lib/postback";
import { isLimited, LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/visitor";

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
 * or JSON; Awin's JSON-in-a-form-field works as is). A repeat for the same
 * network + order updates the row, so status changes (pending -> approved or
 * reversed) come through.
 */
const MAX_BODY = 64 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  return handle(request, Object.fromEntries(new URL(request.url).searchParams));
}

export async function POST(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const type = request.headers.get("content-type") ?? "";
  if (Number(request.headers.get("content-length")) > MAX_BODY) return new Response("Body too large", { status: 413, headers: NO_STORE });
  let body: Record<string, string> = {};
  try {
    if (type.includes("json")) body = flatten(await request.json());
    else if (type.includes("form")) body = formFields((await request.formData()).entries());
  } catch {
    return new Response("Bad body", { status: 400, headers: NO_STORE });
  }
  // Our own names in the URL win over the network's in the body.
  return handle(request, { ...body, ...query });
}

async function handle(request: Request, all: Record<string, string>) {
  const who = clientIp(request.headers) || "unknown";
  if (isLimited("authFailures", who, LIMITS.authFailures)) {
    return new Response("Too many attempts", { status: 429, headers: { ...NO_STORE, "Retry-After": "900" } });
  }
  const secret = process.env.POSTBACK_SECRET;
  const key = all.key ?? request.headers.get("x-postback-key") ?? "";
  if (!secret || !sameSecret(key, secret)) {
    rateLimit("authFailures", who, LIMITS.authFailures);
    return new Response("Forbidden", { status: 403, headers: NO_STORE });
  }
  const db = getDb();
  if (!db) return new Response("No database", { status: 503, headers: NO_STORE });

  const parsed = parsePostback(all);
  if (!parsed.ok) {
    log.warn("postback.rejected", { network: all.network ?? null, reason: parsed.error, fields: Object.keys(all).filter((k) => k !== "key").slice(0, 40) });
    return new Response(parsed.error, { status: 400, headers: NO_STORE });
  }
  const { network, orderId, clickId, commission, sale, currency, status, raw } = parsed.value;

  try {
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
          sale: sql`coalesce(excluded.sale, ${schema.conversions.sale})`,
          status,
          raw,
          clickId: sql`coalesce(excluded.click_id, ${schema.conversions.clickId})`,
          program: sql`coalesce(excluded.program, ${schema.conversions.program})`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    // A 5xx makes the network try again later, so a database hiccup doesn't lose the sale.
    log.error("postback.failed", { err, network });
    return new Response("Try again later", { status: 503, headers: NO_STORE });
  }
  log.info("postback.recorded", { network, status, matched: clickId !== null });
  return new Response("ok", { headers: NO_STORE });
}
