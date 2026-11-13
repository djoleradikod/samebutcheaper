import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * The web app manifest (/manifest.webmanifest), so the site can be added to a home screen. Icons are made from the
 * favicon by scripts/ci/make-icons.mjs. The site has one, light, colour scheme, so the theme colour is the header's
 * white (--paper) in light and dark alike, matching `viewport.themeColor` in the layout. Offline behaviour is in
 * public/sw.js.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My savings list", url: "/my-list", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Check a product", url: "/check", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
