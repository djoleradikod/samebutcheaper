import { NextResponse, type NextRequest } from "next/server";
import { isKnownCountry } from "@/lib/markets";
import knownSlugs from "@/generated/known-slugs.json";

const COUNTRY_COOKIE = "sbc_country";
/** Read by src/lib/server-country.ts. */
const COUNTRY_HEADER = "x-sbc-country";

/**
 * 1. HTTP Basic auth for /admin (ADMIN_PASSWORD; the user name is "admin").
 * 2. Remembers the shopper's country in a cookie the first time we see them. Parts of a page render per request
 *    for the selected country (see CountryPart), so this also hands the detected country to that
 *    first render, when the cookie isn't on the request yet.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminAuth(request);
  if (isMissingPage(pathname)) {
    // These pages stream, so they can't set a 404 themselves once rendering starts.
    return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  }

  // Only this proxy may say what it detected: a visitor's own copy of the header goes no further.
  const forward = new Headers(request.headers);
  forward.delete(COUNTRY_HEADER);
  const detected = request.cookies.has(COUNTRY_COOKIE) ? null : detectCountry(request.headers);
  if (detected) forward.set(COUNTRY_HEADER, detected);
  const response = NextResponse.next({ request: { headers: forward } });
  if (detected) {
    response.cookies.set(COUNTRY_COOKIE, detected, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  if (!request.cookies.has(SOURCE_COOKIE)) {
    const source = trafficSource(request.nextUrl.searchParams, request.headers.get("referer"), request.nextUrl.host);
    if (source) response.cookies.set(SOURCE_COOKIE, source, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  }
  return response;
}

/** First-touch traffic source, so /admin can show which channel's visitors go on to buy. Read by src/lib/outbound.ts. */
const SOURCE_COOKIE = "sbc_src";

/**
 * Where a visitor came from: the campaign tag when a link carries one (utm_source, or "ref"), else the referring
 * site's host. Our own pages and direct visits give nothing, so the first real source sticks for 30 days.
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

/**
 * Country from a CDN geo header when one sits in front of the site
 * (Cloudflare, Vercel, CloudFront, or a custom X-Country-Code from Caddy),
 * otherwise from the browser's language region (en-GB, de-DE, sr-RS...).
 */
export function detectCountry(headers: Headers): string | null {
  for (const h of ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country", "x-country-code"]) {
    const v = headers.get(h)?.trim().toUpperCase();
    if (v && isKnownCountry(v)) return v;
  }
  const lang = headers.get("accept-language") ?? "";
  for (const part of lang.split(",")) {
    const tag = part.split(";")[0].trim();
    const region = tag.split("-")[1]?.toUpperCase();
    if (region && isKnownCountry(region)) return region;
  }
  return null;
}

const KNOWN: Record<string, Set<string>> = {
  compare: new Set(knownSlugs.compare),
  bundle: new Set(knownSlugs.bundle),
  basket: new Set(knownSlugs.basket),
  dupe: new Set(knownSlugs.dupe),
  brand: new Set(knownSlugs.brand),
  ingredient: new Set(knownSlugs.ingredient),
  category: new Set(knownSlugs.category),
};

/** True for a catalogue page (/compare/x, /brand/x and the rest of KNOWN) when x isn't in the catalogue. */
export function isMissingPage(pathname: string) {
  const [, section, slug, extra] = pathname.split("/");
  const known = KNOWN[section];
  return Boolean(known && slug && !extra && !known.has(slug));
}

function adminAuth(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD.", { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === "admin" && pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SameButCheaper admin"' },
  });
}

export const config = {
  // Pages only: skip Next internals, API routes, redirects and files with an extension.
  matcher: ["/((?!_next/|api/|go/|out|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
