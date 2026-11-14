/**
 * `?via=` addresses (src/lib/via.ts) are handled one way only: robots.txt leaves them open, and the page they show
 * names its plain address as rel=canonical. Google's guidance is to consolidate duplicate URLs with rel=canonical and
 * not to use robots.txt for it: a blocked URL is never fetched, so its canonical goes unread (src/app/robots.ts).
 *
 * The canonical half reads the prerendered HTML of the last `npm run build`, so it skips without one.
 *
 *   npx tsx --test scripts/tests/robots.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import robots from "../../src/app/robots";
import type { Catalog } from "../../src/lib/types";

const ROOT = join(import.meta.dirname, "..", "..");
const catalog = catalogJson as unknown as Catalog;

/** Whether robots.txt's rules for every crawler block a path, by Google's longest-match rule (the more specific wins). */
function blocked(path: string) {
  const rules = [robots().rules].flat().filter((r) => [r.userAgent].flat().includes("*"));
  let best: { len: number; allow: boolean } = { len: -1, allow: true };
  for (const r of rules) {
    for (const [list, allow] of [[r.allow, true], [r.disallow, false]] as const) {
      for (const rule of [list ?? []].flat()) {
        if (path.startsWith(rule) && (rule.length > best.len || (rule.length === best.len && allow))) best = { len: rule.length, allow };
      }
    }
  }
  return !best.allow;
}

test("robots.txt leaves ?via= addresses open and still closes the outbound redirects", () => {
  for (const path of ["/compare/a-vs-b?via=basket", "/bundle/k?via=home", "/compare/a-vs-b", "/de/compare/a-vs-b?via=dupe"]) {
    assert.equal(blocked(path), false, path);
  }
  for (const path of ["/go/a-vs-b/alternative", "/out?u=x", "/api/x", "/my-list?ids=1"]) assert.equal(blocked(path), true, path);
  const disallow = [robots().rules].flat().flatMap((r) => [r.disallow ?? []].flat());
  assert.ok(!disallow.some((d) => d.includes("via")), "no rule names via");
});

const swap = catalog.pairs.find((p) => p.market === "US")!;
const html = join(ROOT, ".next/server/app/country/us/compare", `${swap.slug}.html`);

test("a swap page, reached with ?via= or without, names its plain address as canonical", { skip: existsSync(html) ? false : "no build" }, () => {
  const page = readFileSync(html, "utf8");
  const canonical = page.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical, "the page has a canonical");
  assert.ok(new URL(canonical!).pathname.endsWith(`/compare/${swap.slug}`), canonical);
  assert.ok(!canonical!.includes("?"), "no query in the canonical");
});
