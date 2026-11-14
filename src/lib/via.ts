/**
 * Where an outbound click came from, recorded with it as `via` (the clicks table) and read by the revenue report
 * (scripts/revenue/report.ts) and /admin.
 *
 * Baskets, the list check, search and our emails link to swap and kit pages, not to stores, so they mark that link
 * with `?via=basket` (and so on). The swap page stays the same prerendered page; when the shopper then clicks out, the
 * browser sends the swap page's address, `?via=` included, as the referrer of /go, and the click is put down to the
 * basket. A click on a page reached any other way is put down to the page it was made on, from the referrer's path, or
 * from the link itself when the browser sent no referrer. Pure.
 */

export const VIAS = ["swap", "kit", "basket", "check", "listcheck", "list", "search", "letter", "email"] as const;
export type Via = (typeof VIAS)[number];
/** A click's page type in the report: a `via`, or "other" for anything else (a store search with no referrer). */
export type PageType = Via | "other";

export function isVia(v: unknown): v is Via {
  return typeof v === "string" && (VIAS as readonly string[]).includes(v);
}

/** The link with `via` set, keeping anything else already in it (a hash, other parameters). */
export function withVia(href: string, via: Via): string {
  const [path, hash = ""] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}via=${via}${hash ? `#${hash}` : ""}`;
}

const COUNTRY_PREFIX = /^\/(?:us|uk|de|ca|ie|country\/[a-z]{2})(?=\/|$)/;

/** The page type of one of our addresses, by its path ("other" for any other page). */
export function viaOfPath(path: string): PageType {
  const p = path.replace(COUNTRY_PREFIX, "") || "/";
  if (/^\/(?:compare|dupe)\//.test(p)) return "swap";
  if (/^\/bundle\//.test(p)) return "kit";
  if (/^\/basket\//.test(p)) return "basket";
  if (/^\/check\/list(\/|$)/.test(p)) return "listcheck";
  if (/^\/check(\/|$)/.test(p)) return "check";
  if (/^\/my-list(\/|$)/.test(p)) return "list";
  if (/^\/search(\/|$)/.test(p)) return "search";
  return "other";
}

/** What the link itself says, when there is no referrer: /go/<swap>/<side> is linked from swap pages, items and carts from kits. */
export function viaOfLink(side: string, isKit: boolean): PageType {
  if (side === "search") return "other";
  if (/^(item-\d+|cart-)/.test(side) || isKit) return "kit";
  if (["alternative", "brand", "bigger"].includes(side)) return "swap";
  return "other";
}

/**
 * Where a click on /go or /out came from: the `via` on the page it was made on (that page's own address, sent as the
 * referrer), else a `via` on the outbound link, else the page type of the referrer's path. Null without a referrer
 * of ours: the report then reads the link itself.
 */
export function viaOfClick(requestUrl: string, referrer: string | null, siteHosts: readonly string[] = []): PageType | null {
  let ref: URL | null = null;
  try {
    if (referrer) ref = new URL(referrer);
  } catch {}
  const ours = ref && (siteHosts.length === 0 || siteHosts.includes(ref.host) || ref.host === safeHost(requestUrl));
  if (ref && ours) {
    const v = ref.searchParams.get("via");
    if (isVia(v)) return v;
  }
  try {
    const own = new URL(requestUrl).searchParams.get("via");
    if (isVia(own)) return own;
  } catch {}
  return ref && ours ? viaOfPath(ref.pathname) : null;
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
