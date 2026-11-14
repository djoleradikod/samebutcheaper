import { NextResponse, type NextRequest } from "next/server";
import { isKnownCountry } from "@/lib/markets";
import knownSlugs from "@/generated/known-slugs.json";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { isLimited, LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIp, isBotAgent } from "@/lib/visitor";
import { log } from "@/lib/log";
import { INTERNAL_ROOT, internalPath, isPrefixable, readPath } from "@/lib/country-url";

const COUNTRY_COOKIE = "sbc_country";
/** Read by src/lib/server-country.ts. */
const COUNTRY_HEADER = "x-sbc-country";
/** The prefixed URL's country, read by src/lib/server-country.ts. */
const PATH_COUNTRY_HEADER = "x-sbc-path-country";
/** Marks this proxy's own rewrite to src/app/country, with a value no visitor can know, so a direct request there stays a 404. */
const INTERNAL_HEADER = "x-sbc-internal";
const INTERNAL_TOKEN = crypto.randomUUID();

const isInternalPath = (pathname: string) => pathname === INTERNAL_ROOT || pathname.startsWith(`${INTERNAL_ROOT}/`);

/**
 * 1. HTTP Basic auth for /admin and everything under it (ADMIN_PASSWORD; the user name is "admin").
 * 2. Remembers the shopper's country in a cookie the first time we see them. Parts of a page render per request
 *    for the selected country (see CountryPart), so this also hands the detected country to that
 *    first render, when the cookie isn't on the request yet.
 * 3. Country URLs: /de/compare/x is rewritten to the prefixed pages in src/app/country/[country], and the URL's country
 *    is handed on, so the root layout's band says the same as the page (see countryRoute below).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminAuth(request);
  // The rewrite below comes back through here with its internal path (seen on Next 16.4). Only that one gets through, unchanged.
  if (request.headers.get(INTERNAL_HEADER) === INTERNAL_TOKEN && isInternalPath(pathname)) return NextResponse.next();
  const route = countryRoute(pathname);
  if (route === "missing" || isMissingPage(pathname)) {
    // These pages stream, so they can't set a 404 themselves once rendering starts.
    if (pathname === "/de" || pathname.startsWith("/de/")) return germanNotFound(request);
    return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  }

  // Only this proxy may say what it detected, or which country the URL is for: a visitor's own copy of either header goes no further.
  const forward = new Headers(request.headers);
  forward.delete(COUNTRY_HEADER);
  forward.delete(PATH_COUNTRY_HEADER);
  forward.delete(INTERNAL_HEADER);
  // A crawler gets no country: it reads each record in its own market's currency and every swap lists (docs/seo-audit.md).
  const crawler = isBotAgent(request.headers.get("user-agent") ?? "");
  const detected = request.cookies.has(COUNTRY_COOKIE) || crawler ? null : detectCountry(request.headers);
  if (detected) forward.set(COUNTRY_HEADER, detected);
  let response: NextResponse;
  if (route) {
    // /de/compare/x is served by src/app/country/[country]/compare/[slug]. The URL's country is the view, for crawlers too.
    forward.set(PATH_COUNTRY_HEADER, route.country);
    forward.set(INTERNAL_HEADER, INTERNAL_TOKEN);
    const target = new URL(request.url);
    target.pathname = route.internal;
    response = NextResponse.rewrite(target, { request: { headers: forward } });
  } else {
    response = NextResponse.next({ request: { headers: forward } });
  }
  if (detected) {
    response.cookies.set(COUNTRY_COOKIE, detected, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: servedOverHttps(request) });
  }
  // sbc_src, the old 30-day source cookie, is retired (src/lib/traffic-source.ts): a browser that still has one loses it.
  if (request.cookies.has(RETIRED_SOURCE_COOKIE)) response.cookies.set(RETIRED_SOURCE_COOKIE, "", { path: "/", maxAge: 0, secure: servedOverHttps(request) });

  // A prefixed page is a static file any cache may keep (Next marks it s-maxage), but not with this visitor's cookie on it:
  // a shared cache would hand one shopper's detected country to the next. Next keeps a Cache-Control set here.
  if (response.cookies.getAll().length) response.headers.set("Cache-Control", "private, no-cache");
  return response;
}

const RETIRED_SOURCE_COOKIE = "sbc_src";

/**
 * Whether the visitor reached the site over https: the request itself, the reverse proxy's X-Forwarded-Proto (Caddy
 * sets it), or a site built for an https address (which sends HSTS, so browsers don't use plain http). Cookies then
 * carry Secure and are never sent over plain http.
 */
export function servedOverHttps(request: Pick<NextRequest, "nextUrl" | "headers">) {
  if (request.nextUrl.protocol === "https:") return true;
  if (request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase() === "https") return true;
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
}

/**
 * A missing /de/... page in German: src/app/country/[country]/page-not-found draws the 404 inside /de's layout. A
 * rewrite there would answer 200 (Next keeps a rewrite's status only when no page matches), so it is fetched from this
 * server and passed on with 404. If that fails, the English 404 still answers 404.
 */
async function germanNotFound(request: NextRequest): Promise<NextResponse> {
  // Always this server over loopback, and none of the visitor's headers: the internal token and cookies must never
  // travel to a host named by the request.
  const headers = new Headers({ [INTERNAL_HEADER]: INTERNAL_TOKEN, "accept-encoding": "identity", accept: "text/html" });
  const self = `http://127.0.0.1:${process.env.PORT || 3000}`;
  try {
    const page = await fetch(`${self}${INTERNAL_ROOT}/de/page-not-found`, { headers, redirect: "manual", cache: "no-store" });
    if (page.ok && page.headers.get("content-type")?.startsWith("text/html")) {
      const out = new Headers(page.headers);
      for (const h of ["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]) out.delete(h);
      return new NextResponse(page.body, { status: 404, headers: out });
    }
    log.warn("german_404_fetch_failed", { status: page.status });
  } catch (err) {
    log.warn("german_404_fetch_failed", { err });
  }
  return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
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

/**
 * Country URLs (see src/lib/country-url.ts and docs/country-urls.md). Null for an unprefixed path, which goes on as before.
 * "missing" for a path that can't be a page: /de/brands has no prefixed form, /de/compare/x needs x in the catalogue, and
 * /country/... is where the prefixed pages live inside the app, so it is never a public URL of its own.
 */
export function countryRoute(pathname: string): { country: string; internal: string } | "missing" | null {
  if (isInternalPath(pathname)) return "missing";
  const { country, rest } = readPath(pathname);
  if (!country) return null;
  if (!isPrefixable(rest, country) || isMissingPage(rest)) return "missing";
  return { country, internal: internalPath(pathname)! };
}

/** True for a catalogue page (/compare/x, /brand/x and the rest of KNOWN) when x isn't in the catalogue. */
export function isMissingPage(pathname: string) {
  const [, section, slug, extra] = pathname.split("/");
  const known = KNOWN[section];
  return Boolean(known && slug && !extra && !known.has(slug));
}

function adminAuth(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin is disabled. Set ADMIN_PASSWORD.", { status: 404 });

  // Ten wrong passwords from one address locks that address out for a quarter of an hour.
  const who = clientIp(request.headers) || "unknown";
  if (isLimited("authFailures", who, LIMITS.authFailures)) {
    return new NextResponse("Too many attempts. Try again later.", { status: 429, headers: { "Retry-After": "900" } });
  }
  const header = request.headers.get("authorization");
  if (isAdminAuthorized(header, password)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (header) rateLimit("authFailures", who, LIMITS.authFailures);
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SameButCheaper admin", charset="UTF-8"', "Cache-Control": "no-store" },
  });
}

export const config = {
  // Pages only: skip Next internals, API routes, redirects and files with an extension.
  matcher: ["/((?!_next/|api/|go/|out|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
