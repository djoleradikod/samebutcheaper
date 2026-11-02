import type { ProductSide } from "./types";

/**
 * Builds the outbound (affiliate) URL for a product. Configure tags with env:
 *   AMAZON_ASSOCIATE_TAG=yourtag-20
 *   WALMART_AFFILIATE_TEMPLATE=https://goto.walmart.com/c/XXXX/YYYY/ZZZZ?u={url}
 *   TARGET_AFFILIATE_TEMPLATE=https://goto.target.com/c/XXXX/YYYY/ZZZZ?u={url}
 * Without a tag/template the plain product URL is used, so links always work.
 */
export function affiliateUrl(p: Pick<ProductSide, "retailer" | "asin" | "url">): string {
  const env = process.env;
  if (p.retailer === "amazon") {
    const tag = env.AMAZON_ASSOCIATE_TAG;
    const base = p.asin ? `https://www.amazon.com/dp/${p.asin}` : p.url;
    if (!tag) return base;
    try {
      const u = new URL(base);
      u.searchParams.set("tag", tag);
      return u.toString();
    } catch {
      return base;
    }
  }
  const template =
    p.retailer === "walmart"
      ? env.WALMART_AFFILIATE_TEMPLATE
      : p.retailer === "target"
        ? env.TARGET_AFFILIATE_TEMPLATE
        : undefined;
  if (template?.includes("{url}")) return template.replace("{url}", encodeURIComponent(p.url));
  return p.url;
}

export const RETAILER_LABEL: Record<string, string> = {
  amazon: "Amazon",
  walmart: "Walmart",
  target: "Target",
  costco: "Costco",
  other: "retailer",
};
