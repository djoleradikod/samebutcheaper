import { after } from "next/server";
import { createHash } from "node:crypto";
import { getPair } from "@/lib/catalog";
import { affiliateUrl } from "@/lib/affiliate";
import { getDb, schema } from "@/db";

/**
 * Outbound redirect: /go/<slug>/<alternative|brand>
 * Logs the click (after the response is sent) and 302s to the affiliate URL.
 */
export async function GET(request: Request, ctx: RouteContext<"/go/[slug]/[side]">) {
  const { slug, side } = await ctx.params;
  const pair = getPair(slug);
  if (!pair || (side !== "alternative" && side !== "brand")) {
    return new Response("Not found", { status: 404 });
  }
  const product = side === "brand" ? pair.brand : pair.alternative;
  const target = affiliateUrl(product);

  const referrer = request.headers.get("referer");
  const ua = request.headers.get("user-agent") ?? "";
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const isBot = /bot|crawl|spider|slurp|preview|facebookexternalhit/i.test(ua);

  after(async () => {
    const db = getDb();
    if (!db || isBot) return;
    // Daily-rotating, salted hash: lets us count unique clickers without storing IPs.
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.CLICK_HASH_SALT ?? "sbc";
    const visitorHash = createHash("sha256").update(`${salt}:${day}:${ip}:${ua}`).digest("hex");
    try {
      await db.insert(schema.clicks).values({
        pairSlug: pair.slug,
        side,
        retailer: product.retailer,
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
      Location: target,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer-when-downgrade",
    },
  });
}
