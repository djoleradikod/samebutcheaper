import { log } from "@/lib/log";
import { allowedImage, IMAGE_TYPES, MAX_BYTES } from "@/lib/product-image";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";
import { visitorFrom } from "@/lib/visitor";

/**
 * GET /api/product-image?u=<Open Facts image address>: the photo, fetched by our server, so the visitor's browser
 * never contacts the image host (src/lib/product-image.ts says what is allowed). Answers 404 for anything not on
 * the allow-list, 429 past the visitor's limit, 502 when the host fails or sends something other than a small image.
 *
 * Kept in memory (the last CACHE_BYTES of photos) and in the browser for a week: a product's photo address changes
 * when the photo does.
 */
const CACHE_BYTES = 24_000_000;
const WEEK = 7 * 24 * 3600;
const UA = `SameButCheaper/0.2 (${SITE.contactEmail})`;

type Entry = { body: Uint8Array<ArrayBuffer>; type: string };
const g = globalThis as unknown as { __sbcImages?: Map<string, Entry> };
const cache = (g.__sbcImages ??= new Map());
let held = [...cache.values()].reduce((n, e) => n + e.body.byteLength, 0);

function keep(key: string, entry: Entry) {
  cache.set(key, entry);
  held += entry.body.byteLength;
  // A Map keeps insertion order, so the first keys are the least recently used (a hit is moved to the end).
  for (const [k, e] of cache) {
    if (held <= CACHE_BYTES) break;
    cache.delete(k);
    held -= e.body.byteLength;
  }
}

const HEADERS = {
  "Cache-Control": `public, max-age=${WEEK}, immutable`,
  // An image and nothing else, even if a host sent something odd under an image type.
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex",
};

const fail = (status: number, extra: Record<string, string> = {}) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...extra } });

/** Reads at most `max` bytes; null when the body is longer. */
async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(new ArrayBuffer(size));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

export async function GET(request: Request) {
  const url = allowedImage(new URL(request.url).searchParams.get("u"));
  if (!url) return fail(404);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return new Response(hit.body, { headers: { ...HEADERS, "Content-Type": hit.type } });
  }
  const verdict = rateLimit("images", visitorFrom(request.headers).key, LIMITS.images);
  if (!verdict.ok) return fail(429, { "Retry-After": String(verdict.retryAfter) });
  try {
    // Nothing of the visitor's goes along: no cookies, no referrer, our own name as the agent, as Open Facts asks.
    const res = await fetch(key, { headers: { "user-agent": UA, accept: IMAGE_TYPES.join(", ") }, redirect: "error", signal: AbortSignal.timeout(6_000), cache: "no-store" });
    const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    const length = Number(res.headers.get("content-length") ?? 0);
    if (!res.ok || !res.body || !(IMAGE_TYPES as readonly string[]).includes(type) || length > MAX_BYTES) {
      await res.body?.cancel().catch(() => {});
      log.warn("product_image.refused", { host: url.hostname, status: res.status, type, length });
      return fail(502);
    }
    const body = await readCapped(res.body, MAX_BYTES);
    if (!body) {
      log.warn("product_image.too_big", { host: url.hostname });
      return fail(502);
    }
    keep(key, { body, type });
    return new Response(body, { headers: { ...HEADERS, "Content-Type": type } });
  } catch (err) {
    log.warn("product_image.failed", { host: url.hostname, err });
    return fail(502);
  }
}
