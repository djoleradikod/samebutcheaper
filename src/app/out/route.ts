import { after } from "next/server";
import { isKnownCountry, storeSearchUrl, storesFor } from "@/lib/markets";
import { tagUrl } from "@/lib/affiliate";
import { getDb, schema } from "@/db";
import { visitorFrom } from "@/lib/visitor";

/**
 * Store search redirect for shoppers outside a listing's market:
 *   /out?s=<store id>&c=<country>&q=<what to look for>&from=<pair or bundle slug>
 * Only stores listed for that country are allowed, so this is not an open redirect.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const country = (params.get("c") ?? "").toUpperCase();
  const storeId = params.get("s") ?? "";
  const q = (params.get("q") ?? "").trim().slice(0, 140);
  const from = params.get("from") ?? "";
  if (!isKnownCountry(country) || q.length < 2) return new Response("Bad request", { status: 400 });
  const store = storesFor(country).find((s) => s.id === storeId);
  if (!store) return new Response("Unknown store", { status: 404 });

  const visitor = visitorFrom(request.headers);
  after(async () => {
    const db = getDb();
    if (!db || visitor.isBot) return;
    try {
      await db.insert(schema.clicks).values({
        pairSlug: /^[a-z0-9-]{1,160}$/.test(from) ? from : "lookup",
        side: "search",
        retailer: `${store.id}:${country}`.slice(0, 32),
        referrer: request.headers.get("referer")?.slice(0, 500) ?? null,
        visitorHash: visitor.hash,
      });
    } catch (err) {
      console.error("search click log failed", err);
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: tagUrl(storeSearchUrl(store, q)),
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
