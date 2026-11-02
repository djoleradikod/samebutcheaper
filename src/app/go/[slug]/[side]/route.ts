import { after } from "next/server";
import { getBundle, getPair } from "@/lib/catalog";
import { affiliateUrl } from "@/lib/affiliate";
import { getDb, schema } from "@/db";
import { visitorFrom } from "@/lib/visitor";

/**
 * Outbound redirect:
 *   /go/<pair-slug>/<alternative|brand>
 *   /go/<bundle-slug>/<brand|item-N>
 * Logs the click (after the response is sent) and 302s to the affiliate URL.
 */
export async function GET(request: Request, ctx: RouteContext<"/go/[slug]/[side]">) {
  const { slug, side } = await ctx.params;
  const target = resolve(slug, side);
  if (!target) return new Response("Not found", { status: 404 });

  const referrer = request.headers.get("referer");
  const visitor = visitorFrom(request.headers);

  after(async () => {
    const db = getDb();
    if (!db || visitor.isBot) return;
    const visitorHash = visitor.hash;
    try {
      await db.insert(schema.clicks).values({
        pairSlug: slug,
        side,
        retailer: target.retailer,
        referrer: referrer?.slice(0, 500) ?? null,
        visitorHash,
      });
    } catch (err) {
      console.error("click log failed", err);
    }
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: target.url,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  });
}

function resolve(slug: string, side: string): { url: string; retailer: string } | null {
  const pair = getPair(slug);
  if (pair) {
    if (side !== "alternative" && side !== "brand") return null;
    const p = side === "brand" ? pair.brand : pair.alternative;
    return { url: affiliateUrl(p, pair.market), retailer: p.retailer };
  }
  const bundle = getBundle(slug);
  if (!bundle) return null;
  if (side === "brand")
    return { url: affiliateUrl(bundle.bundle, bundle.market), retailer: bundle.bundle.retailer };
  const m = /^item-(\d+)$/.exec(side);
  const c = m ? bundle.components[Number(m[1])] : undefined;
  return c ? { url: affiliateUrl(c, bundle.market), retailer: c.retailer } : null;
}
