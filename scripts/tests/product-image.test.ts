/**
 * /check's product photos through our own server (src/lib/product-image.ts, src/app/api/product-image/route.ts):
 * only Open Facts product photos, small images only, rate-limited, cached, and both privacy pages say so. The
 * image hosts are faked: nothing here reaches the network.
 *
 *   npx tsx --test scripts/tests/product-image.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { allowedImage, MAX_BYTES, proxiedImage } from "../../src/lib/product-image";
import { GET } from "../../src/app/api/product-image/route";
import { LIMITS, resetRateLimits } from "../../src/lib/rate-limit";
import { allParagraphs } from "../../src/lib/privacy-facts";
import { policy as en } from "../../src/lib/i18n/en/privacy";
import { policy as de } from "../../src/lib/i18n/de/datenschutz";
import { retention } from "../../src/lib/maintenance";

const PHOTO = "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.200.jpg";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  resetRateLimits();
});

test("only Open Facts product photos are fetched", () => {
  assert.equal(allowedImage(PHOTO)?.hostname, "images.openfoodfacts.org");
  assert.ok(allowedImage("https://images.openbeautyfacts.org/images/products/40/05/80/014/front_de.12.200.png"));
  for (const bad of [
    "http://images.openfoodfacts.org/images/products/301/front_en.1.200.jpg",
    "https://evil.example/images/products/301/front_en.1.200.jpg",
    "https://images.openfoodfacts.org.evil.example/images/products/301/front_en.1.200.jpg",
    "https://images.openfoodfacts.org/images/products/301/front_en.1.200.svg",
    "https://images.openfoodfacts.org/images/products/301/front_en.1.200.jpg?x=1",
    "https://user:pw@images.openfoodfacts.org/images/products/301/front_en.1.200.jpg",
    "https://images.openfoodfacts.org:8443/images/products/301/front_en.1.200.jpg",
    "https://images.openfoodfacts.org/images/products/301/../../../etc/passwd.jpg",
    "https://images.openfoodfacts.org/cgi/search.pl",
    "https://127.0.0.1/images/products/301/front_en.1.200.jpg",
    "javascript:alert(1)",
    "",
    null,
  ]) {
    assert.equal(allowedImage(bad), null, String(bad));
    assert.equal(proxiedImage(bad), null, String(bad));
  }
  assert.equal(proxiedImage(PHOTO), `/api/product-image?u=${encodeURIComponent(PHOTO)}`);
});

const req = (u: string | null, ip = "203.0.113.5") =>
  new Request(`http://127.0.0.1:3000/api/product-image${u === null ? "" : `?u=${encodeURIComponent(u)}`}`, { headers: { "x-forwarded-for": ip, "user-agent": "Mozilla/5.0 Test" } });

function fakeHost(answer: () => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return answer();
  }) as typeof fetch;
  return calls;
}

const jpeg = (bytes = 2048, headers: Record<string, string> = { "content-type": "image/jpeg" }) => new Response(new Uint8Array(bytes).fill(7), { headers });

test("a photo is fetched by our server with nothing of the visitor's, kept, and served as an image only", async () => {
  const calls = fakeHost(() => jpeg());
  const first = await GET(req(PHOTO));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("content-type"), "image/jpeg");
  assert.match(first.headers.get("cache-control") ?? "", /max-age=604800/);
  assert.match(first.headers.get("content-security-policy") ?? "", /sandbox/);
  assert.equal((await first.arrayBuffer()).byteLength, 2048);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, PHOTO);
  const sent = new Headers(calls[0].init?.headers);
  assert.match(sent.get("user-agent") ?? "", /^SameButCheaper\//);
  assert.equal(sent.get("cookie"), null);
  assert.equal(sent.get("x-forwarded-for"), null);
  assert.equal(calls[0].init?.redirect, "error", "a redirect to another host is never followed");
  // The second time comes from memory.
  const again = await GET(req(PHOTO, "198.51.100.9"));
  assert.equal(again.status, 200);
  assert.equal(calls.length, 1);
});

test("anything not allowed, not an image, too big, or failing is refused", async () => {
  fakeHost(() => jpeg());
  assert.equal((await GET(req("https://evil.example/images/products/1/a.jpg"))).status, 404);
  assert.equal((await GET(req(null))).status, 404);
  const other = (n: number) => PHOTO.replace("633", String(n));
  fakeHost(() => new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html" } }));
  assert.equal((await GET(req(other(1)))).status, 502);
  fakeHost(() => new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }));
  assert.equal((await GET(req(other(2)))).status, 502);
  fakeHost(() => jpeg(10, { "content-type": "image/jpeg", "content-length": String(MAX_BYTES + 1) }));
  assert.equal((await GET(req(other(3)))).status, 502);
  // No length given, and longer than allowed: cut off while reading.
  fakeHost(() => jpeg(MAX_BYTES + 10, { "content-type": "image/png" }));
  assert.equal((await GET(req(other(4)))).status, 502);
  fakeHost(() => new Response(null, { status: 404 }));
  assert.equal((await GET(req(other(5)))).status, 502);
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed: redirect");
  }) as typeof fetch;
  assert.equal((await GET(req(other(6)))).status, 502);
});

test("each visitor gets a limited number of photos a minute", async () => {
  fakeHost(() => jpeg(16));
  const perMinute = LIMITS.images[0].limit;
  for (let i = 0; i < perMinute; i++) assert.equal((await GET(req(PHOTO.replace("633", `9${i}`)))).status, 200, `photo ${i}`);
  const over = await GET(req(PHOTO.replace("633", "8888")));
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get("retry-after")) > 0);
  assert.equal((await GET(req(PHOTO.replace("633", "8888"), "198.51.100.77"))).status, 200, "another visitor is unaffected");
});

test("the product check's photos come through our server, and both privacy pages say so", () => {
  assert.match(readFileSync("src/lib/lookup/openfacts.ts", "utf8"), /image: proxiedImage\(/);
  const facts = { keep: retention({}), photos: false, backupDays: 14, notice: null, consentStores: [] };
  const english = allParagraphs(en, facts).join("\n");
  const german = allParagraphs(de, facts).join("\n");
  assert.match(english, /photos in the product check's results come through our server/);
  assert.doesNotMatch(english, /load straight from Open Food Facts/);
  assert.match(german, /Produktfotos in den Ergebnissen der Produktprüfung holt unser Server/);
  assert.doesNotMatch(german, /lädt dein Browser direkt/);
});
