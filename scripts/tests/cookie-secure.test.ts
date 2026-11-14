/**
 * Every cookie the site sets carries Secure when the site is served over https, from the server (src/proxy.ts) and
 * from the browser (document.cookie). Reads the code for every setter, so a new one without it fails here.
 *
 *   npx tsx --test scripts/tests/cookie-secure.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { consentCookie } from "../../src/lib/consent-core";
import { servedOverHttps } from "../../src/proxy";

const ROOT = join(import.meta.dirname, "..", "..");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|js|mjs)$/.test(e.name) ? [join(dir, e.name)] : []));
const CODE = [...files(join(ROOT, "src")), ...files(join(ROOT, "public"))]
  .filter((f) => !f.includes("src/generated/"))
  .map((f) => ({ file: relative(ROOT, f), text: readFileSync(f, "utf8") }));

test("every cookie setter in the code sets Secure over https", () => {
  let setters = 0;
  for (const { file, text } of CODE) {
    for (const line of text.split("\n")) {
      if (/cookies\.set\(/.test(line)) {
        setters++;
        assert.match(line, /secure: servedOverHttps\(request\)/, `${file}: ${line.trim()}`);
      }
      if (/document\.cookie\s*=[^=]/.test(line)) {
        setters++;
        assert.match(line, /secureFlag\(\)|location\.protocol === "https:"/, `${file}: ${line.trim()}`);
      }
    }
    assert.doesNotMatch(text, /["']set-cookie["']/i, `${file} writes a Set-Cookie header by hand`);
  }
  assert.ok(setters >= 5, `found ${setters} cookie setters`);
});

test("the consent cookie and the proxy's choice of Secure", () => {
  assert.doesNotMatch(consentCookie("yes"), /Secure/);
  assert.match(consentCookie("no", true), /; Secure$/);
  const req = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    assert.equal(servedOverHttps(req("http://127.0.0.1:3000/")), false);
    assert.equal(servedOverHttps(req("https://samebutcheaper.example/")), true);
    assert.equal(servedOverHttps(req("http://127.0.0.1:3000/", { "x-forwarded-proto": "https" })), true, "behind the reverse proxy");
    assert.equal(servedOverHttps(req("http://127.0.0.1:3000/", { "x-forwarded-proto": "http" })), false);
    process.env.NEXT_PUBLIC_SITE_URL = "https://samebutcheaper.example";
    assert.equal(servedOverHttps(req("http://127.0.0.1:3000/")), true, "a site built for https sends HSTS");
  } finally {
    if (site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = site;
  }
});
