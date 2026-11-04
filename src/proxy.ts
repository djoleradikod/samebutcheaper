import { NextResponse, type NextRequest } from "next/server";
import { isKnownCountry } from "@/lib/markets";
import knownSlugs from "@/generated/known-slugs.json";

const COUNTRY_COOKIE = "sbc_country";

/**
 * 1. HTTP Basic auth for /admin (ADMIN_PASSWORD; the user name is "admin").
 * 2. Remembers the shopper's country in a cookie the first time we see them,
 *    so pages can show stores that deliver there. Pages stay static; the
 *    client reads the cookie.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminAuth(request);
  if (isMissingPage(pathname)) {
    // These pages stream, so they can't set a 404 themselves once rendering starts.
    return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  }

  const response = NextResponse.next();
  if (!request.cookies.has(COUNTRY_COOKIE)) {
    const country = detectCountry(request.headers);
    if (country) {
      response.cookies.set(COUNTRY_COOKIE, country, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
  }
  return response;
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
  dupe: new Set(knownSlugs.dupe),
};

/** True for /compare/x, /bundle/x and /dupe/x when x isn't in the catalog. */
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
