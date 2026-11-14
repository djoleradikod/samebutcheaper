/**
 * How pages are served under load (docs/deploy.md, "Load test"):
 * - every unprefixed section draws the shopper's country band from its own layout, and the prefixed pages from theirs,
 *   so no root-level code reads the request and the prefixed pages stay static files (src/components/CountryBand.tsx);
 * - a response that sets a cookie is never one a shared cache may keep, so no shopper is handed another's country;
 * - the remembered program and programme-terms answers change as soon as the settings they come from change.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";
import { livePrograms } from "../../src/lib/affiliate-links";
import { termsOff } from "../../src/lib/programme-terms";
import { readView } from "../../src/components/LateBand";

const APP = join(import.meta.dirname, "..", "..", "src", "app");

/** Folders whose pages draw no band of their own: the prefixed pages (their layout does) and private files. */
const NOT_SECTIONS = new Set(["country"]);

function hasPage(dir: string): boolean {
  return readdirSync(dir, { withFileTypes: true }).some((e) => (e.isDirectory() ? hasPage(join(dir, e.name)) : e.name === "page.tsx"));
}

test("every unprefixed section draws the shopper's band in its layout", () => {
  const sections = readdirSync(APP, { withFileTypes: true }).filter((e) => e.isDirectory() && !NOT_SECTIONS.has(e.name) && !/^[(@_]/.test(e.name));
  const withPages = sections.filter((e) => hasPage(join(APP, e.name)));
  assert.ok(withPages.length > 20, "found the sections");
  for (const s of withPages) {
    const layout = join(APP, s.name, "layout.tsx");
    assert.ok(existsSync(layout), `src/app/${s.name} has pages but no layout.tsx with the country band (src/components/CountryBand.tsx)`);
    assert.match(readFileSync(layout, "utf8"), /<ShopBand>/, `src/app/${s.name}/layout.tsx draws ShopBand`);
  }
});

test("the home page, the prefixed layout and the 404 draw theirs, and the root layout reads nothing per request", () => {
  assert.match(readFileSync(join(APP, "page.tsx"), "utf8"), /!getPathCountry\(\) && <ShopperBand \/>/);
  // The band's code ships with the root layout's, once, though the root layout draws no band (src/components/BandCode.tsx).
  assert.match(readFileSync(join(APP, "layout.tsx"), "utf8"), /<BandCode \/>/);
  assert.match(readFileSync(join(APP, "country", "[country]", "layout.tsx"), "utf8"), /<FixedBand /);
  assert.match(readFileSync(join(APP, "not-found.tsx"), "utf8"), /<NotFoundBand \/>/);
  const root = readFileSync(join(APP, "layout.tsx"), "utf8");
  assert.doesNotMatch(root, /server-country|cookies\(|headers\(|<Suspense/, "the root layout stays static: it is part of every page");
});

test("the 404's band at a prefixed address is the URL's and asks nothing of the server, so the page can't reload itself", () => {
  // A cookie-following band on /de/gone used to refresh, get the 404 document back and reload the page in a loop.
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  const saved = { window: g.window, document: g.document };
  try {
    g.document = { cookie: "sbc_country=HR; sbc_others=1" };
    g.window = { location: { pathname: "/de/gone" } };
    assert.equal(readView(), "DE|0|1");
    g.window = { location: { pathname: "/us/compare/gone" } };
    assert.equal(readView(), "US|0|1");
    g.window = { location: { pathname: "/compare/gone" } };
    assert.equal(readView(), "HR|1");
    g.document = { cookie: "" };
    assert.equal(readView(), "|0");
  } finally {
    g.window = saved.window;
    g.document = saved.document;
  }
  const late = readFileSync(join(process.cwd(), "src", "components", "LateBand.tsx"), "utf8");
  assert.match(late, /\{!fixed && <FollowCountry /, "a fixed 404 band never asks the server again");
  assert.match(late, /if \(inFixed\) return null/, "inside /de's layout the layout's own band is the only one");
});

const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

function visit(path: string, headers: Record<string, string>) {
  return proxy(new NextRequest(`http://localhost${path}`, { headers: { "user-agent": BROWSER, ...headers } })) as Response;
}

test("a response that sets the country cookie is private; one that doesn't keeps the page's own caching", () => {
  for (const path of ["/de/compare/aspirin-vs-ass-500-1a-pharma-de", "/compare/aspirin-vs-ass-500-1a-pharma-de", "/"]) {
    const first = visit(path, { "accept-language": "en-GB,en;q=0.8" });
    assert.match(first.headers.get("set-cookie") ?? "", /sbc_country=GB/, path);
    assert.equal(first.headers.get("cache-control"), "private, no-cache", `${path}: a shared cache must not keep a cookie for the next shopper`);

    const again = visit(path, { "accept-language": "en-GB,en;q=0.8", cookie: "sbc_country=GB" });
    assert.equal(again.headers.get("set-cookie"), null, path);
    assert.equal(again.headers.get("cache-control"), null, `${path}: Next's own Cache-Control applies`);
  }
  const retired = visit("/de", { cookie: "sbc_country=DE; sbc_src=old" });
  assert.match(retired.headers.get("set-cookie") ?? "", /sbc_src=;/);
  assert.equal(retired.headers.get("cache-control"), "private, no-cache");
});

test("remembered program answers follow the settings", () => {
  const env: Record<string, string | undefined> = {};
  assert.equal(livePrograms(env).length, 0);
  assert.equal(termsOff(env) === termsOff(env), true, "asked twice, answered once");
  const offBefore = termsOff(env) as Set<string>;
  assert.ok(offBefore.has("walmart"));

  env.AFF_WALMART_US = "https://goto.walmart.com/c/1/2/3";
  assert.ok(livePrograms(env).some((p) => p.id === "walmart-us"), "a setting changed in place is seen");
  assert.ok(!(termsOff(env) as Set<string>).has("walmart"), "joining switches the programme's rules on at once");

  env.PROGRAMME_TERMS_OFF = "walmart";
  assert.ok((termsOff(env) as Set<string>).has("walmart"));
  delete env.AFF_WALMART_US;
  delete env.PROGRAMME_TERMS_OFF;
  assert.equal(livePrograms(env).length, 0);
  assert.ok((termsOff(env) as Set<string>).has("walmart"));
  assert.equal(livePrograms({ AMAZON_ASSOCIATE_TAG: "x-20" }).some((p) => p.network === "amazon"), true, "another settings object");
});
