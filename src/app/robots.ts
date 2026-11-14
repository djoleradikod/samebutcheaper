import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Everything a visitor can read is open to every crawler, AI assistants' included: search and AI answers are the
 * site's only free way to be found. Closed: outbound redirects (/go, /out), admin, the API, the newsletter's one-time
 * links, the 404 page, and query forms of pages whose plain form is already open. Noindex pages (/search, /my-list)
 * stay crawlable so crawlers can read their noindex and follow their links. That includes the country views a country
 * doesn't list (/de/compare/<a US swap>): noindex, but their links lead on. /country/ is the app's internal folder for
 * country URLs; it answers 404 anyway (docs/country-urls.md).
 *
 * `?via=` (src/lib/via.ts) is left open on purpose. Those addresses are the same prerendered page, whose rel=canonical
 * names the plain address, so search engines fold them into it. Google's guidance on duplicate URLs is to use
 * rel=canonical and not robots.txt for this ("Consolidate duplicate URLs": robots.txt shouldn't be used for
 * canonicalization), because a blocked URL is never fetched: its canonical goes unread, and the blocked address can
 * still be indexed from links alone, without a snippet. Blocking it as well would undo the canonical.
 * scripts/tests/robots.test.ts holds both halves.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/go/", "/out", "/admin", "/api/", "/newsletter/", "/de/newsletter/", "/page-not-found", "/check?", "/my-list?", "/country/"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
