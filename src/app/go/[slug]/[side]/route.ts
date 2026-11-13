import { getBundle, getPair } from "@/lib/catalog";
import { productUrl } from "@/lib/affiliate";
import { redirectOut } from "@/lib/outbound";

/**
 * Outbound redirect:
 *   /go/<pair-slug>/<alternative|brand|bigger>
 *   /go/<bundle-slug>/<brand|item-N>
 * Tags the store link with our affiliate program, logs the click and 302s.
 */
export async function GET(request: Request, ctx: RouteContext<"/go/[slug]/[side]">) {
  const { slug, side } = await ctx.params;
  const target = resolve(slug, side);
  if (!target) return new Response("Not found", { status: 404 });
  return redirectOut(request, { ...target, slug, side });
}

function resolve(slug: string, side: string): { url: string; retailer: string } | null {
  const pair = getPair(slug);
  if (pair) {
    if (side === "bigger") {
      const big = pair.bulkView.bigger;
      return big ? { url: big.url, retailer: big.retailer } : null;
    }
    if (side !== "alternative" && side !== "brand") return null;
    const p = side === "brand" ? pair.brand : pair.alternative;
    return { url: productUrl(p, pair.market), retailer: p.retailer };
  }
  const bundle = getBundle(slug);
  if (!bundle) return null;
  if (side === "brand") return { url: productUrl(bundle.bundle, bundle.market), retailer: bundle.bundle.retailer };
  const m = /^item-(\d+)$/.exec(side);
  const c = m ? bundle.components[Number(m[1])] : undefined;
  return c ? { url: productUrl(c, bundle.market), retailer: c.retailer } : null;
}
