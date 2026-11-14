/**
 * Where a visitor first came from (a campaign tag or the referring site), for /admin and the revenue report, which
 * show which channels bring shoppers who go on to buy. Stored only with an outbound click (clicks.source).
 *
 * It used to sit in a 30-day cookie, `sbc_src`. That is not strictly necessary, so in the EU and the UK it would need
 * consent. Now nothing is stored on the device: the page works it out in the browser from the address it was opened
 * with and the referring page, keeps it in memory while the visitor moves through the site, and adds it to a store
 * link (`?src=`) at the moment that link is followed (src/components/SourceCarrier.tsx). /go and /out read it from
 * there (src/lib/outbound.ts). It is gone when the tab closes or the page is reloaded from another address.
 *
 * Pure, and shared by server and client code.
 */

/** The marker on a store link that carries the source. */
export const SOURCE_PARAM = "src";

/** A source as stored: lower case letters, digits, dots, dashes and underscores, at most 40 characters. */
const SOURCE = /^[a-z0-9._-]{1,40}$/;

export function isSource(v: unknown): v is string {
  return typeof v === "string" && SOURCE.test(v);
}

/**
 * Where a visitor came from: the campaign tag when the address carries one (utm_source, or "ref"), else the referring
 * site's host. Our own pages and direct visits give nothing.
 */
export function trafficSource(params: URLSearchParams, referer: string | null, ownHost: string): string | null {
  const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(0, 40) || null;
  const tag = params.get("utm_source") ?? params.get("ref");
  if (tag) {
    const medium = params.get("utm_medium");
    return clean(medium ? `${tag}.${medium}` : tag);
  }
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.replace(/^(www|m|l|lm|out)\./, "");
    if (!host || host === ownHost.replace(/:\d+$/, "").replace(/^www\./, "")) return null;
    return clean(host);
  } catch {
    return null;
  }
}

/** The source a click on /go or /out carries: its `src` marker, else another site that linked straight to it. */
export function clickSource(requestUrl: string, referer: string | null, ownHosts: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  const marked = url.searchParams.get(SOURCE_PARAM);
  if (isSource(marked)) return marked;
  if (!referer) return null;
  try {
    const host = new URL(referer).host;
    if (host === url.host || ownHosts.includes(host)) return null;
  } catch {
    return null;
  }
  return trafficSource(new URLSearchParams(), referer, url.host);
}

/** A store link (/go/..., /out?...) with the source added, unless it has one or there is none to add. */
export function withSource(href: string, source: string | null, origin: string): string {
  if (!isSource(source)) return href;
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return href;
  }
  if (url.origin !== origin || !isStoreLinkPath(url.pathname) || url.searchParams.has(SOURCE_PARAM)) return href;
  url.searchParams.set(SOURCE_PARAM, source);
  return url.toString();
}

/** Our redirects to stores. */
export function isStoreLinkPath(path: string): boolean {
  return path.startsWith("/go/") || path === "/out" || path.startsWith("/out/");
}
