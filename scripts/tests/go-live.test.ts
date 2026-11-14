/**
 * The go-live half of `npm run preflight` (scripts/go-live.ts) against two stand-in sites on 127.0.0.1: one set up
 * right, one with the mistakes it is there to catch. The real site is checked by scripts/ci/rehearse-deploy.sh.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { goLiveChecks } from "../go-live";

const SITE = "https://cheaper.example";

function stand(good: boolean): Server {
  return createServer((req, res) => {
    const path = req.url ?? "/";
    const headers: Record<string, string> = good
      ? {
          "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'",
          "X-Frame-Options": "SAMEORIGIN",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        }
      : { "X-Powered-By": "Next.js" };
    if (path === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json", ...headers });
      return res.end(JSON.stringify(good ? { database: "ok", migrations: "8/8", ready: true, blockers: [] } : { database: "down", migrations: null, ready: false, blockers: ["database"] }));
    }
    if (path === "/") {
      res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": good ? "sbc_country=US; Path=/; SameSite=lax" : "sbc_country=US; Path=/", ...headers });
      return res.end(`<html><head><link rel="canonical" href="${good ? SITE : "http://localhost:3000"}"/></head></html>`);
    }
    if (path === "/robots.txt") {
      res.writeHead(200, headers);
      return res.end(`User-Agent: *\nAllow: /\nDisallow: /go/\nDisallow: /admin\n\nSitemap: ${good ? SITE : "http://localhost:3000"}/sitemap.xml\n`);
    }
    if (path === "/sitemap.xml") {
      res.writeHead(200, headers);
      return res.end(`<urlset><url><loc>${SITE}/</loc></url>${good ? "" : "<url><loc>http://localhost:3000/x</loc></url>"}</urlset>`);
    }
    if (path === "/admin") {
      res.writeHead(good ? 401 : 200, headers);
      return res.end();
    }
    if (path.startsWith("/go/%2F%2Fevil")) {
      res.writeHead(good ? 404 : 302, good ? headers : { ...headers, Location: "https://evil.example/" });
      return res.end();
    }
    if (path.startsWith("/go/")) {
      res.writeHead(302, { ...headers, Location: "https://www.amazon.com/dp/B000" });
      return res.end();
    }
    if (path === "/sw.js") {
      res.writeHead(200, { ...headers, "Cache-Control": good ? "no-cache" : "public, max-age=3600" });
      return res.end("");
    }
    res.writeHead(404);
    res.end();
  });
}

const servers: Server[] = [];
let goodBase = "";
let badBase = "";
before(async () => {
  for (const good of [true, false]) {
    const s = stand(good);
    await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
    servers.push(s);
    const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    if (good) goodBase = base;
    else badBase = base;
  }
});
after(() => servers.forEach((s) => s.close()));

test("a site set up right passes every check that applies over http", async () => {
  const checks = await goLiveChecks(goodBase, SITE, { slug: "a-swap" });
  const failed = checks.filter((c) => c.ok === false);
  assert.deepEqual(failed, []);
  // https-only checks are skipped, not passed, when the address is plain http.
  assert.deepEqual(checks.filter((c) => c.ok === null).map((c) => c.label).sort(), ["HSTS", "http:// goes to https://"]);
});

test("the mistakes are caught: database, headers, canonical, robots, sitemap, admin, open redirect, cached worker", async () => {
  const failed = (await goLiveChecks(badBase, SITE, { slug: "a-swap" })).filter((c) => c.ok === false).map((c) => c.label);
  for (const label of [
    "Database",
    "Launch checklist",
    "Content-Security-Policy",
    "Framing refused to other sites",
    "nosniff",
    "No X-Powered-By",
    "Canonical link is the public address",
    "Cookies are SameSite",
    "robots.txt names the sitemap",
    "Sitemap lists only the public address",
    "/admin asks for a password",
    "/go is not an open redirect",
    "Service worker is never cached",
  ]) {
    assert.ok(failed.includes(label), `${label} should fail`);
  }
});

test("a site that doesn't answer says so and stops", async () => {
  const checks = await goLiveChecks("http://127.0.0.1:9", SITE);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].ok, false);
  assert.match(checks[0].fix ?? "", /reverse proxy/);
});
