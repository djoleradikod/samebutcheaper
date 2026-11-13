/**
 * Titles, descriptions, hreflang, the swap questions, the feed and llms.txt, checked against the whole catalogue.
 * Needs `npm run catalog` first.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import { atomFeed, feedEntries, xmlEscape } from "../../src/lib/feed";
import { llmsText } from "../../src/lib/llms";
import { localFor } from "../../src/lib/localize";
import {
  basketTitle,
  brandTitle,
  bundleDescription,
  bundleTitle,
  checkedDate,
  clip,
  DESCRIPTION_MAX,
  dupeTitle,
  fitSentences,
  newest,
  recordVersions,
  swapDescription,
  swapTitles,
  TITLE_MAX,
} from "../../src/lib/seo";
import { faqJsonLd, hasPrice, namesStore, recordLocal, swapFaq } from "../../src/lib/swap-faq";
import type { Catalog } from "../../src/lib/types";

const catalog = catalogJson as unknown as Catalog;
const pairs = catalog.pairs;
const MONEY = /[$£€¢]|\b\d+(\.\d+)?p\b|\b(USD|GBP|EUR|CAD)\b/;

test("clip cuts at a word and marks it, and leaves short text alone", () => {
  assert.equal(clip("short", 10), "short");
  const cut = clip("one two three four five six seven", 20);
  assert.ok(cut.length <= 20, cut);
  assert.ok(cut.endsWith("…"));
  assert.ok(!/\s…$/.test(cut));
});

test("fitSentences keeps whole sentences under the limit", () => {
  assert.equal(fitSentences(["One.", "Two.", "x".repeat(200)], 20), "One. Two.");
  assert.ok(fitSentences(["y".repeat(300)], 50).length <= 50);
});

test("every swap has its own title, and nearly all fit", () => {
  const titles = swapTitles(pairs);
  const list = [...titles.values()].map((t) => t.toLowerCase());
  assert.equal(titles.size, pairs.length);
  assert.equal(new Set(list).size, list.length, "two swaps share a title");
  const over = list.filter((t) => t.length > TITLE_MAX);
  assert.ok(over.length / list.length < 0.05, `${over.length} titles over ${TITLE_MAX}: ${over.slice(0, 5).join(" | ")}`);
  for (const p of pairs) assert.ok(!MONEY.test(titles.get(p.slug)!), `money in title: ${titles.get(p.slug)}`);
});

test("twin swaps have different titles that say whose prices they have", () => {
  const titles = swapTitles(pairs);
  const twins = pairs.filter((p) => p.twin);
  assert.ok(twins.length > 0);
  for (const p of twins) {
    assert.notEqual(titles.get(p.slug), titles.get(p.twin!.slug));
    assert.match(titles.get(p.slug)!, /\b(US|UK|Canadian|German|Irish)\b/);
  }
});

test("descriptions fit, name no money, and claim only what the match type allows", () => {
  for (const p of pairs) {
    const d = swapDescription(p);
    assert.ok(d.length > 40 && d.length <= DESCRIPTION_MAX, `${p.slug}: ${d.length}`);
    assert.ok(!MONEY.test(d), `${p.slug}: ${d}`);
    if (p.match_type !== "identical_active") assert.ok(!/same active ingredient/.test(d), `${p.slug}: ${d}`);
    if (p.match_type === "same_kind") {
      assert.match(d, /same kind of product/);
      assert.match(d, /don't show/);
      assert.ok(!/does the same job/.test(d));
    }
  }
});

test("twins point at each other with region codes and one shared x-default", () => {
  const prefix = { US: "us", GB: "uk", DE: "de", CA: "ca", IE: "ie" } as const;
  for (const p of pairs.filter((x) => x.twin)) {
    const twin = pairs.find((x) => x.slug === p.twin!.slug)!;
    const mine = recordVersions("compare", p, twin);
    const theirs = recordVersions("compare", twin, p);
    assert.equal(mine.languages[`en-${p.market}`], `/${prefix[p.market]}/compare/${p.slug}`);
    assert.equal(mine.languages[`en-${twin.market}`], `/${prefix[twin.market]}/compare/${twin.slug}`);
    assert.deepEqual(mine, theirs);
    assert.ok([`/${prefix[p.market]}/compare/${p.slug}`, `/${prefix[twin.market]}/compare/${twin.slug}`].includes(mine.xDefault));
  }
});

test("the static questions name no price and no store", () => {
  for (const p of pairs) {
    for (const f of swapFaq(p)) {
      assert.ok(!hasPrice(f.a, p), `${p.slug}: ${f.a}`);
      assert.ok(!namesStore(f.a, p), `${p.slug} names a store: ${f.a}`);
    }
  }
});

test("the JSON-LD answers are what a shopper in the record's own market reads, word for word", () => {
  for (const p of pairs) {
    assert.deepEqual(swapFaq(p, recordLocal()), swapFaq(p, localFor(p.market)), p.slug);
  }
  const ld = faqJsonLd(swapFaq(pairs[0], recordLocal()));
  assert.equal(ld["@type"], "FAQPage");
  assert.equal(ld.mainEntity.length, 4);
});

test("the JSON-LD prices are in the record's currency, never converted", () => {
  const us = pairs.find((p) => p.market === "US")!;
  const record = swapFaq(us, recordLocal())[2].a;
  assert.match(record, /\$|¢/);
  assert.ok(!/about/.test(record));
  assert.match(swapFaq(us, localFor("GB"))[2].a, /about/);
});

test("each match type answers 'is it the same' in its own words", () => {
  for (const p of pairs) {
    const a = swapFaq(p)[0].a;
    if (p.match_type === "same_kind") assert.match(a, /^We can't say/, p.slug);
    else assert.ok(!/^We can't say/.test(a), p.slug);
    if (p.match_type === "identical_active") assert.match(a, /same active ingredient/);
    else assert.ok(!/has the same active ingredient/.test(a), `${p.slug}: ${a}`);
    if (p.match_type === "equivalent_spec") assert.match(a, /^Not the same product/);
  }
});

test("a shopper the store doesn't deliver to is told what to look for instead", () => {
  const de = pairs.find((p) => p.market === "DE" && p.alternative.retailer !== "amazon")!;
  const a = swapFaq(de, localFor("GB"))[3].a;
  assert.match(a, /doesn't deliver to the United Kingdom/);
  assert.match(a, /Look for "/);
});

test("other page titles stay short and name no money", () => {
  for (const b of catalog.bundles) {
    assert.ok(bundleTitle(b).length <= TITLE_MAX, bundleTitle(b));
    assert.ok(bundleDescription(b).length <= DESCRIPTION_MAX);
    assert.ok(!MONEY.test(bundleTitle(b) + bundleDescription(b)));
  }
  for (const p of catalog.presets) assert.ok(basketTitle(p).length <= TITLE_MAX && !MONEY.test(basketTitle(p)), basketTitle(p));
  assert.ok(brandTitle("A very long brand name that goes on and on and on", 50).length <= TITLE_MAX);
  assert.equal(dupeTitle({ brand: "Claritin", actives: ["Loratadine"], subcategory: "Allergy", category: "otc-medicine" }, 88.2), "Generic for Claritin (Loratadine): save up to 88%");
  assert.match(dupeTitle({ brand: "Dawn", actives: null, subcategory: "Dish soap", category: "household" }, 40), /^Cheaper alternatives to Dawn/);
});

test("dates come from price_checked", () => {
  assert.equal(checkedDate("2026-11")?.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(checkedDate("2026-11-06")?.toISOString(), "2026-11-06T00:00:00.000Z");
  assert.equal(checkedDate("soon"), null);
  assert.equal(newest(["2025-01", undefined, "2026-03", "bad"])?.toISOString(), "2026-03-01T00:00:00.000Z");
});

test("the feed lists the newest checks first and escapes its text", () => {
  const entries = feedEntries(pairs, catalog.bundles, 30);
  assert.equal(entries.length, 30);
  for (let i = 1; i < entries.length; i++) assert.ok(entries[i - 1].updated >= entries[i].updated);
  const xml = atomFeed({ name: "S&B", url: "https://example.com", tagline: "<x>" }, entries);
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<title>S&amp;B: newest price checks<\/title>/);
  assert.equal((xml.match(/<entry>/g) ?? []).length, 30);
  assert.equal(xmlEscape(`a<b>&"'`), "a&lt;b&gt;&amp;&quot;&apos;");
});

test("llms.txt follows the proposal: H1, summary, sections of links, Optional last", () => {
  const text = llmsText({
    name: "SameButCheaper",
    url: "https://example.com",
    swaps: 10,
    kits: 2,
    baskets: 3,
    brands: 4,
    ingredients: 5,
    markets: ["US", "GB"],
    aisles: ["household"],
    linksEarn: false,
    examples: { swap: "/compare/x" },
  });
  const lines = text.split("\n");
  assert.equal(lines[0], "# SameButCheaper");
  assert.ok(lines[2].startsWith("> "));
  assert.equal(lines.filter((l) => l.startsWith("# ")).length, 1);
  const h2 = lines.filter((l) => l.startsWith("## "));
  assert.equal(h2[h2.length - 1], "## Optional");
  const after = lines.slice(lines.indexOf(h2[0]));
  for (const l of after.filter((x) => x.startsWith("- "))) assert.match(l, /^- \[[^\]]+\]\(https:\/\/example\.com\/[^)]*\)(: .+)?$/);
  assert.match(text, /10 swaps/);
  assert.match(text, /US and UK/);
  assert.match(text, /No link earns/);
});
