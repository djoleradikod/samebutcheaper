/**
 * The privacy pages against the code: every cookie, browser storage key and service worker cache the code uses is
 * in src/lib/privacy-facts.ts, and the English /privacy and the German /datenschutz both name each one, say the same
 * periods and switch the same sentences with the same settings. Then the short privacy lines elsewhere (the report
 * form, the product check, the list check) against the same facts.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { activeCookies, allParagraphs, BROWSER_STORAGE, cookieParagraphs, COOKIES, RETIRED_COOKIES, SERVICE_WORKER_CACHES, type PolicyFacts } from "../../src/lib/privacy-facts";
import { policy as en } from "../../src/lib/i18n/en/privacy";
import { policy as de } from "../../src/lib/i18n/de/datenschutz";
import { retention } from "../../src/lib/maintenance";
import { getT } from "../../src/lib/i18n";

const ROOT = join(import.meta.dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|js|mjs)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

/** The code that runs: src and public, without the privacy texts and the facts themselves. */
const CODE = [...files(join(ROOT, "src")), ...files(join(ROOT, "public"))]
  .filter((f) => !/src\/lib\/i18n\/|src\/lib\/privacy-facts\.ts$|src\/generated\//.test(f))
  .map((f) => ({ file: relative(ROOT, f), text: readFileSync(f, "utf8") }));

const KNOWN_COOKIES = new Set<string>([...Object.keys(COOKIES), ...RETIRED_COOKIES]);

test("every cookie name in the code is in the facts", () => {
  const found = new Map<string, string>();
  for (const { file, text } of CODE) for (const m of text.matchAll(/\bsbc_[a-z]+\b/g)) found.set(m[0], file);
  for (const name of Object.keys(COOKIES)) assert.ok(found.has(name) || name === "sbc_consent", `${name} is in the facts but not in the code`);
  const unknown = [...found].filter(([name]) => !KNOWN_COOKIES.has(name)).map(([name, file]) => `${name} (${file})`);
  assert.deepEqual(unknown, [], "a cookie the privacy pages don't name");
});

test("every browser storage key and service worker cache in the code is in the facts", () => {
  const keys = new Set<string>();
  for (const { text } of CODE) {
    if (!/localStorage|sessionStorage/.test(text)) continue;
    // Event names ("sbc:saved-change", a kit's EVENT) share the prefix; they store nothing.
    for (const line of text.split("\n")) {
      if (/EVENT|Event\(|addEventListener|dispatchEvent/.test(line)) continue;
      for (const m of line.matchAll(/["'`](sbc:[a-z-]+:?)/g)) if (!/-(change|open)$/.test(m[1])) keys.add(m[1]);
    }
  }
  assert.deepEqual([...keys].sort(), [...BROWSER_STORAGE].sort());
  assert.ok(!CODE.some(({ text }) => /sessionStorage\.setItem|indexedDB\.open/.test(text)), "sessionStorage or IndexedDB in use: add it to the facts");
  const sw = readFileSync(join(ROOT, "public/sw.js"), "utf8");
  const caches = [...sw.matchAll(/"(sbc-[a-z]+-)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(caches)].sort(), [...SERVICE_WORKER_CACHES].sort());
});

const VARIANTS: PolicyFacts[] = [false, true].flatMap((photos) =>
  [[], ["amazon"]].map((consentStores) => ({ keep: retention({}), photos, backupDays: 14, notice: null, consentStores })),
);
VARIANTS.push({ ...VARIANTS[3], keep: retention({ RETENTION_CLICK_DETAIL_DAYS: "90", RETENTION_LOOKUP_DAYS: "500" }), backupDays: 7 });

const numbers = (paras: string[]) => [...new Set(paras.join(" ").match(/\d+/g) ?? [])].sort();

for (const [lang, text] of [["en", en], ["de", de]] as const) {
  test(`/${lang === "en" ? "privacy" : "datenschutz"} names every cookie, storage key and cache, and only those`, () => {
    for (const f of VARIANTS) {
      const cookies = cookieParagraphs(text, f).join("\n");
      for (const c of activeCookies(f)) assert.match(cookies, new RegExp(`\`${c}\``), `${c} with consent stores ${f.consentStores.join()}`);
      for (const c of RETIRED_COOKIES) assert.match(cookies, new RegExp(`\`${c}\``), `the retired ${c}`);
      if (!f.consentStores.length) assert.doesNotMatch(cookies, /sbc_consent/, "no consent cookie while nothing asks for consent");
      const all = allParagraphs(text, f).join("\n");
      for (const m of all.matchAll(/\bsbc_[a-z]+\b/g)) assert.ok(KNOWN_COOKIES.has(m[0]), `${m[0]} is on the page but not in the facts`);
      const storage = text.storage.join("\n");
      for (const k of [...BROWSER_STORAGE, ...SERVICE_WORKER_CACHES]) assert.ok(storage.includes(`\`${k}\``), `${k} in the storage section`);
      const photoText = text.collected(f).map((i) => i.text).join("\n") + text.processors(f).join("\n");
      assert.equal(/Anthropic/.test(photoText), f.photos, "Anthropic is named exactly when photos are read");
      assert.equal(/Amazon(?! Associates|-Partnerprogramm)/.test(cookies), f.consentStores.length > 0, "the stores that ask for consent, only when some do");
    }
  });
}

test("the English and German pages say the same numbers and have the same sections", () => {
  for (const f of VARIANTS) {
    assert.deepEqual(numbers(allParagraphs(en, f)), numbers(allParagraphs(de, f)), `numbers for ${JSON.stringify({ ...f, keep: undefined })}`);
    assert.equal(en.collected(f).length, de.collected(f).length);
    assert.equal(en.logs(f).length, de.logs(f).length);
    assert.equal(cookieParagraphs(en, f).length, cookieParagraphs(de, f).length);
    assert.equal(en.processors(f).length, de.processors(f).length);
    assert.equal(en.bases(f).length, de.bases(f).length);
    assert.equal(en.storage.length, de.storage.length);
    assert.equal(en.rights.length, de.rights.length);
  }
  const f = VARIANTS[4];
  for (const n of [90, 500, 7]) assert.ok(allParagraphs(en, f).join(" ").includes(String(n)), `the English page follows the setting ${n}`);
});

test("short privacy lines elsewhere say what the code does", () => {
  for (const lang of ["en", "de"] as const) {
    const t = getT(lang);
    // The report form: no IP address is stored with a report (the web server's own access log still sees it).
    assert.doesNotMatch(t("feedback.noAccount"), /never store|speichern wir nie/i);
    assert.match(t("feedback.noAccount"), /report|Meldung/);
    // The product check and the list check name the AI service only when photos are read.
    assert.match(t("pageLookup.privacy", true), /Anthropic/);
    assert.doesNotMatch(t("pageLookup.privacy", false), /Anthropic|AI|KI/);
    assert.match(t("pageShoppingCheck.privacy", true), /Anthropic|AI service/);
  }
});
