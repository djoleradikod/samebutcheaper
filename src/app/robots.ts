import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Everything a visitor can read is open to every crawler, AI assistants' included: search and AI answers are the
 * site's only free way to be found. Closed: outbound redirects (/go, /out), admin, the API, the newsletter's one-time
 * links, the 404 page, and query forms of pages whose plain form is already open. Noindex pages (/search, /my-list)
 * stay crawlable so crawlers can read their noindex and follow their links.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/go/", "/out", "/admin", "/api/", "/newsletter/", "/page-not-found", "/check?", "/my-list?"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
