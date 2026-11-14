/**
 * Product photos from the Open Facts databases, served through our own server (src/app/api/product-image/route.ts),
 * so a visitor's browser never contacts those image servers and they never see the visitor's IP address.
 *
 * Not an open proxy: only https addresses on the Open Facts image hosts, under their product image paths, as JPEG,
 * PNG or WebP, at most MAX_BYTES, are fetched, and each visitor may ask for a limited number a minute.
 */

/** The image hosts of Open Food, Beauty, Pet Food and Products Facts. */
export const OPEN_FACTS_IMAGE_HOSTS = [
  "images.openfoodfacts.org",
  "images.openbeautyfacts.org",
  "images.openpetfoodfacts.org",
  "images.openproductsfacts.org",
  "static.openfoodfacts.org",
] as const;

/** Product photos only: /images/products/<barcode path>/<name>.<ext>, nothing else on those hosts. */
const PATH = /^\/images\/products\/[0-9/]+\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Small front photos are 5 to 40 KB; anything over this is not what we asked for. */
export const MAX_BYTES = 1_000_000;

export const IMAGE_ROUTE = "/api/product-image";

/** The source address if it is one we fetch, else null. */
export function allowedImage(raw: string | null | undefined): URL | null {
  if (!raw || raw.length > 300) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
  if (!(OPEN_FACTS_IMAGE_HOSTS as readonly string[]).includes(url.hostname)) return null;
  if (!PATH.test(url.pathname) || url.pathname.includes("..")) return null;
  return url;
}

/** Where a page loads the photo from: our own route, or nothing when we wouldn't fetch it. */
export function proxiedImage(raw: string | null | undefined): string | null {
  const url = allowedImage(raw);
  return url ? `${IMAGE_ROUTE}?u=${encodeURIComponent(url.toString())}` : null;
}
