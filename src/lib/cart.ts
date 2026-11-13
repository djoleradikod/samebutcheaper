/**
 * One link that puts every piece from one store into that store's basket, where the store documents a way to do it.
 * Pure, for the server, the client and tests.
 *
 * Only Amazon so far. Its Associates "Add to Cart form" (Product Advertising API documentation, read 13 Nov 2026:
 * webservices.amazon.co.jp/paapi5/documentation/add-to-cart-form.html and the older developer guide page
 * images-na.ssl-images-amazon.com/images/G/09/associates/paapi/dg/AddToCartForm.html) takes a GET to
 * https://www.<storefront>/gp/aws/cart/add.html with ASIN.n and Quantity.n for each item and AssociateTag for credit.
 * The guide lists these storefronts: amazon.com, .co.uk, .de, .fr, .ca and .co.jp. We use it only there and only when
 * every piece at Amazon carries an ASIN, because a cart missing a piece would be worse than no cart button.
 *
 * Other stores have no documented multi-item link we can rely on, so they get none: no guessed URLs.
 */
import { amazonTag, type Env } from "./affiliate-links";
import { MARKETS, type MarketCode } from "./markets";

/** Storefronts the Add to Cart form documentation names. amazon.ie isn't one of them, so Irish kits get no cart. */
export const AMAZON_CART_DOMAINS: ReadonlySet<string> = new Set(["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.ca", "amazon.co.jp"]);

/** An ASIN is ten letters and digits. Anything else would make a cart Amazon rejects. */
const ASIN = /^[A-Z0-9]{10}$/;

export type CartPiece = { seller: string; asin?: string | null; qty?: number };

/** The stores we can build a cart link for. */
export const CART_SELLERS: readonly string[] = ["amazon"];

/**
 * The add-to-cart URL for the pieces a kit buys at one store, or null when we can't put all of them in one cart.
 * Needs at least two pieces: for one, the product's own link does the same job.
 */
export function cartUrl(seller: string, pieces: readonly CartPiece[], market: MarketCode, env?: Env): string | null {
  if (seller !== "amazon") return null;
  const mine = pieces.filter((p) => p.seller === seller);
  if (mine.length < 2) return null;
  if (!mine.every((p) => p.asin && ASIN.test(p.asin))) return null;
  const domain = MARKETS[market].amazon;
  if (!AMAZON_CART_DOMAINS.has(domain)) return null;
  // The same ASIN twice adds up its quantity, so a cart says "2" instead of listing the pack twice.
  const counts = new Map<string, number>();
  for (const p of mine) counts.set(p.asin!, (counts.get(p.asin!) ?? 0) + Math.max(1, Math.round(p.qty ?? 1)));
  const params = new URLSearchParams();
  [...counts].forEach(([asin, qty], i) => {
    params.set(`ASIN.${i + 1}`, asin);
    params.set(`Quantity.${i + 1}`, String(qty));
  });
  const tag = env ? amazonTag(domain, env) : amazonTag(domain);
  if (tag) params.set("AssociateTag", tag);
  return `https://www.${domain}/gp/aws/cart/add.html?${params.toString()}`;
}

/** The /go side that logs a cart click and redirects to the cart: "cart-amazon". */
export function cartSide(seller: string) {
  return `cart-${seller}`;
}

/** The seller in a "cart-<seller>" side, or null. */
export function sellerOfCartSide(side: string) {
  const m = /^cart-([a-z0-9-]{1,40})$/.exec(side);
  return m ? m[1] : null;
}
