/**
 * The service worker's routing decisions (public/sw.js), loaded the way a browser would but with no `caches` or
 * event listeners, so only its pure functions run:  npx tsx --test scripts/tests/service-worker.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

type Req = { method: string; url: string; mode: string; headers: { get(name: string): string | null } };
type Api = {
  VERSION: string;
  SHELL_CACHE: string;
  STATIC_CACHE: string;
  decide(req: Req, origin: string): "pass" | "page" | "my-list" | "static" | "shell";
  cacheable(res: { status: number; type: string; redirected: boolean } | null): boolean;
  staticUrlsIn(html: string): string[];
};

const root = join(import.meta.dirname, "..", "..");
const source = readFileSync(join(root, "public", "sw.js"), "utf8");
const self: { __sbcSw?: Api } = {};
runInNewContext(source, { self, URL });
const sw = self.__sbcSw!;
const ORIGIN = "https://samebutcheaper.com";

function req(path: string, init: { method?: string; mode?: string; headers?: Record<string, string>; origin?: string } = {}): Req {
  const h = new Map(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method: init.method ?? "GET",
    url: (init.origin ?? ORIGIN) + path,
    mode: init.mode ?? "no-cors",
    headers: { get: (n) => h.get(n.toLowerCase()) ?? null },
  };
}
const nav = (path: string, headers?: Record<string, string>) => sw.decide(req(path, { mode: "navigate", headers }), ORIGIN);

test("pages come from the network with the offline page behind them; only My list keeps a copy", () => {
  assert.equal(nav("/"), "page");
  assert.equal(nav("/compare/claritin-vs-equate-loratadine-10mg"), "page");
  assert.equal(nav("/search?q=ibuprofen"), "page");
  assert.equal(nav("/my-list"), "my-list");
  assert.equal(nav("/my-list/"), "my-list");
  assert.equal(nav("/my-list?from=home"), "my-list");
  assert.equal(nav("/my-listing"), "page");
  assert.equal(nav("/de/my-list"), "my-list", "the German My list opens offline too");
  assert.equal(nav("/de/my-list/"), "my-list");
  assert.equal(nav("/uk/my-list"), "page");
});

test("redirects, admin, API routes and the worker files are never answered, even as a navigation", () => {
  for (const path of ["/go/advil-vs-x", "/go/advil-vs-x?to=brand", "/go", "/out?s=amazon-us&c=US&q=x", "/out", "/admin", "/admin/reports", "/api/health", "/api/newsletter/confirm?t=1", "/sw.js", "/sw-register.js"]) {
    assert.equal(nav(path), "pass", path);
    assert.equal(sw.decide(req(path), ORIGIN), "pass", path);
  }
  // Prefixes only match whole path segments.
  assert.equal(nav("/outdoor"), "page");
  assert.equal(nav("/gopher"), "page");
  assert.equal(nav("/apiary"), "page");
});

test("server actions and router requests pass through", () => {
  assert.equal(sw.decide(req("/my-list", { method: "POST", mode: "navigate" }), ORIGIN), "pass");
  assert.equal(sw.decide(req("/compare/x", { method: "POST", headers: { "Next-Action": "abc123" } }), ORIGIN), "pass");
  assert.equal(sw.decide(req("/compare/x", { headers: { RSC: "1" } }), ORIGIN), "pass");
  assert.equal(sw.decide(req("/compare/x", { headers: { "Next-Router-Prefetch": "1" } }), ORIGIN), "pass");
  assert.equal(sw.decide(req("/my-list?_rsc=1x2y"), ORIGIN), "pass");
  assert.equal(nav("/my-list", { RSC: "1" }), "pass");
  for (const method of ["PUT", "DELETE", "PATCH", "HEAD"]) assert.equal(sw.decide(req("/", { method, mode: "navigate" }), ORIGIN), "pass");
});

test("only static files, the install shell and product photos are cached; nothing with a price", () => {
  assert.equal(sw.decide(req("/_next/static/chunks/app-abc123.js"), ORIGIN), "static");
  assert.equal(sw.decide(req("/_next/static/media/archivo-latin.woff2"), ORIGIN), "static");
  assert.equal(sw.decide(req("/_next/static/css/1a2b.css"), ORIGIN), "static");
  assert.equal(sw.decide(req("/offline.html"), ORIGIN), "shell");
  assert.equal(sw.decide(req("/icons/icon-192.png"), ORIGIN), "shell");
  assert.equal(sw.decide(req("/_next/image?url=%2Fproducts%2Fa.webp&w=640&q=75"), ORIGIN), "image");
  assert.equal(sw.decide(req("/products/advil.webp"), ORIGIN), "image");
  // Opening a photo on its own is a page visit, not a cached image.
  assert.equal(nav("/products/advil.webp"), "page");
  for (const path of ["/_next/imagex", "/compare/x/opengraph-image", "/feed.xml", "/manifest.webmanifest", "/sitemap.xml", "/icons/maskable-512.png", "/compare/x", "/my-list", "/llms.txt"]) {
    assert.equal(sw.decide(req(path), ORIGIN), "pass", path);
  }
});

test("other origins pass, including a look-alike", () => {
  assert.equal(sw.decide(req("/_next/static/chunks/a.js", { origin: "https://cdn.example.com" }), ORIGIN), "pass");
  assert.equal(sw.decide(req("/", { mode: "navigate", origin: "https://samebutcheaper.com.evil.test" }), ORIGIN), "pass");
  assert.equal(sw.decide({ ...req("/"), url: "not a url" }, ORIGIN), "pass");
});

test("only a plain same-origin 200 is kept", () => {
  assert.equal(sw.cacheable({ status: 200, type: "basic", redirected: false }), true);
  assert.equal(sw.cacheable({ status: 200, type: "opaque", redirected: false }), false);
  assert.equal(sw.cacheable({ status: 200, type: "basic", redirected: true }), false);
  assert.equal(sw.cacheable({ status: 404, type: "basic", redirected: false }), false);
  assert.equal(sw.cacheable({ status: 500, type: "basic", redirected: false }), false);
  assert.equal(sw.cacheable(null), false);
});

test("My list's static files are found in its HTML, once each", () => {
  const html = `<link rel="stylesheet" href="/_next/static/css/a1.css"><script src="/_next/static/chunks/main-9f.js" async></script>
    <link rel="preload" href="/_next/static/media/font.woff2" as="font"><script src="/_next/static/chunks/main-9f.js"></script>
    <img src="/_next/image?url=x"><script>self.__next_f.push([1,"\\"/_next/static/chunks/page-77.js\\""])</script>`;
  // Spread: the array comes from the worker's own realm.
  assert.deepEqual([...sw.staticUrlsIn(html)], ["/_next/static/css/a1.css", "/_next/static/chunks/main-9f.js", "/_next/static/media/font.woff2", "/_next/static/chunks/page-77.js"]);
});

test("caches are versioned under one prefix, so an update can delete the old ones", () => {
  assert.match(sw.SHELL_CACHE, /^sbc-shell-v\d+$/);
  assert.match(sw.STATIC_CACHE, /^sbc-static-v\d+$/);
  assert.ok(sw.SHELL_CACHE.endsWith(sw.VERSION) && sw.STATIC_CACHE.endsWith(sw.VERSION));
});
