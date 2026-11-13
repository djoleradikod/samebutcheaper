/**
 * The German pages: the dictionaries line up, numbers and dates read German, record text keeps the English numbers,
 * titles and descriptions are unique in German too, and /de's hreflang says de-DE where the page is German.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { en } from "../../src/lib/i18n/en";
import { de } from "../../src/lib/i18n/de";
import { dateDe, formatMoneyDe, formatPercent, monthDe, shortDateDe } from "../../src/lib/i18n/format";
import { langForPage, langOfPath } from "../../src/lib/i18n/lang";
import { numberProblem, numbersIn, pairDeProblems } from "../../src/lib/i18n/record-check";
import { getT } from "../../src/lib/i18n";
import { money } from "../../src/lib/format";
import { categoryDescription, categoryTitle, DESCRIPTION_MAX, hreflangFor, recordVersions, swapDescriptionsDe, swapTitles } from "../../src/lib/seo";
import { CATEGORIES } from "../../src/lib/categories";
import type { Catalog, Pair } from "../../src/lib/types";

const catalog = catalogJson as unknown as Catalog;
const pairs = catalog.pairs as Pair[];
const ROOT = join(import.meta.dirname, "..", "..");

/** Every key path of a dictionary, with what kind of leaf it ends in. */
function shape(o: unknown, at = ""): string[] {
  if (typeof o === "function") return [`${at}:fn`];
  if (typeof o === "string") return [`${at}:str`];
  if (Array.isArray(o)) return [`${at}:array`];
  if (o && typeof o === "object") return Object.keys(o).sort().flatMap((k) => shape((o as Record<string, unknown>)[k], at ? `${at}.${k}` : k));
  return [`${at}:${typeof o}`];
}

test("the German dictionary has every English key, with the same kind of value", () => {
  // The type (Shape<typeof en>) already fails typecheck on a missing key; this catches a string where a function belongs.
  const enShape = shape(en);
  const deShape = new Set(shape(de));
  const missing = enShape.filter((k) => !deShape.has(k));
  assert.deepEqual(missing, []);
});

test("numbers, money and dates read German", () => {
  assert.equal(formatPercent(88, "de"), "88 %");
  assert.equal(formatPercent(88, "en"), "88%");
  assert.equal(formatMoneyDe(11.7, "EUR"), "11,70 €");
  assert.equal(formatMoneyDe(1234.4, "EUR"), "1.234 €");
  assert.equal(money(11.7, "EUR", "de"), "11,70 €");
  assert.equal(money(11.7, "EUR"), "€11.70", "English money is unchanged");
  assert.equal(dateDe("2026-11-13"), "13. November 2026");
  assert.equal(shortDateDe("2026-11-13"), "13. Nov. 2026");
  assert.equal(monthDe("2026-03"), "März 2026");
});

test("the number check reads both styles and catches a changed figure", () => {
  assert.deepEqual(numbersIn("1,234.5 g and 30%", "en"), numbersIn("1.234,5 g und 30 %", "de"));
  assert.equal(numberProblem("Contains 400 mg.", "Enthält 400 mg."), null);
  assert.match(numberProblem("Contains 400 mg.", "Enthält 500 mg.") ?? "", /missing 400/);
  assert.match(numberProblem("Two tests.", "Zwei Tests, 2025.") ?? "", /added 2025/);
});

test("every German-market swap has German text, and it keeps the English numbers", () => {
  const german = pairs.filter((p) => p.market === "DE");
  assert.ok(german.length > 0);
  for (const p of german) {
    assert.ok(p.de, `${p.slug} has no German text`);
    assert.deepEqual(pairDeProblems(p, p.de!), [], p.slug);
  }
});

test("German swap titles are unique across the catalogue, and descriptions fit", () => {
  const titles = swapTitles(pairs, "de");
  const list = [...titles.values()].map((t) => t.toLowerCase());
  assert.equal(titles.size, pairs.length);
  assert.equal(new Set(list).size, list.length, "two swaps share a German title");
  const descriptions = new Map<string, string>();
  const german = swapDescriptionsDe(pairs);
  for (const p of pairs) {
    const d = german.get(p.slug)!;
    assert.ok(d.length > 40 && d.length <= DESCRIPTION_MAX, `${p.slug}: ${d.length}`);
    assert.ok(!descriptions.has(d), `${p.slug} and ${descriptions.get(d)} share a German description`);
    descriptions.set(d, p.slug);
    if (p.match_type === "identical_active") assert.match(d, /wirkstoff/i, p.slug);
  }
});

test("German aisle titles and descriptions are unique and fit", () => {
  const t = getT("de");
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const c of CATEGORIES) {
    const name = t(`categories.${c.slug}.name`);
    const title = categoryTitle(name, 12, "de");
    const description = categoryDescription(name, t(`categories.${c.slug}.description`), 12, "de");
    assert.ok(!titles.has(title) && !descriptions.has(description), c.slug);
    titles.add(title);
    descriptions.add(description);
    assert.ok(description.length <= DESCRIPTION_MAX, `${c.slug}: ${description.length}`);
    assert.notEqual(title, categoryTitle(c.name, 12), "the German title is not the English one");
  }
  assert.equal(categoryTitle("Household & Cleaning", 3), "Cheaper household & cleaning: 3 brand-name swaps", "English unchanged");
});

test("a URL's language: /de is German, kits and baskets stay whole English pages, the rest is English", () => {
  assert.equal(langOfPath("/de"), "de");
  assert.equal(langOfPath("/de/compare/x"), "de");
  assert.equal(langOfPath("/country/de/category/household"), "de");
  assert.equal(langOfPath("/de/bundle/x"), "en");
  assert.equal(langOfPath("/de/basket/x"), "en");
  assert.equal(langOfPath("/datenschutz"), "de");
  assert.equal(langOfPath("/us/compare/x"), "en");
  assert.equal(langOfPath("/compare/x"), "en");
  assert.equal(langForPage("DE", "compare"), "de");
  assert.equal(hreflangFor("DE"), "de-DE");
  assert.equal(hreflangFor("DE", "bundle"), "en-DE");
  assert.equal(hreflangFor("GB"), "en-GB");
});

test("a German swap's versions name it de-DE", () => {
  const p = pairs.find((x) => x.market === "DE" && !x.twin)!;
  const v = recordVersions("compare", p);
  assert.equal(v.languages["de-DE"], `/de/compare/${p.slug}`);
  assert.ok(!Object.keys(v.languages).includes("en-DE"));
});

test("client code carries only its own client sections", () => {
  // English pages must not ship the whole dictionary, nor any German: client.tsx and client-dict.ts import no dictionary
  // at all, and code that reaches the browser imports single sections (en/client/<section>), never all of them.
  for (const file of ["client.tsx", "client-dict.ts"]) {
    const src = readFileSync(join(ROOT, "src/lib/i18n", file), "utf8");
    const imports = [...src.matchAll(/^import (?!type)[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
    for (const i of imports) assert.ok(!/^\.\/(index|en|de|en\/.*|de\/.*)$/.test(i), `${file} imports ${i}`);
  }
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
  const clientFiles = walk(join(ROOT, "src")).filter((f) => /^["']use client["']/m.test(readFileSync(f, "utf8")));
  assert.ok(clientFiles.length > 10);
  for (const f of clientFiles) {
    const src = readFileSync(f, "utf8");
    const imports = [...src.matchAll(/^import (?!type)[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
    for (const i of imports) assert.ok(!/(^|\/)i18n(\/(index|en|de|en\/client|de\/client))?$/.test(i), `${f} imports ${i}`);
  }
});

test("German text uses the pharmacy terms, never 'identisch', and carries the legal notice", () => {
  const dir = join(ROOT, "data/i18n/de");
  const texts = [
    ...readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")),
    ...["swap.ts", "client.ts", "site.ts", "datenschutz.ts"].map((f) => readFileSync(join(ROOT, "src/lib/i18n/de", f), "utf8")),
  ].join("\n");
  assert.ok(!/identisch/i.test(texts));
  assert.match(texts, /Wirkstoffgleich/);
  assert.match(texts, /Gleicher Wirkstoff/);
  assert.match(texts, /Packungsbeilage beachten/);
  assert.ok(
    texts.includes("Zu Risiken und Nebenwirkungen lesen Sie die Packungsbeilage und fragen Sie Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke"),
  );
});
