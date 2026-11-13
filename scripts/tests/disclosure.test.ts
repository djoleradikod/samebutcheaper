/**
 * The wording about earning is true per link (src/lib/disclosure.ts): a link earns only when a programme's env setting
 * tags it or an affiliate feed's tracked link replaces it, the same choice /go makes. English and German.
 *
 *   npx tsx --test scripts/tests/disclosure.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { linksEarn, mayEarn } from "../../src/lib/affiliate";
import { earningSides, kitEarns, swapDisclosure } from "../../src/lib/disclosure";
import type { FeedInfo } from "../../src/lib/feed-links";
import type { ProductSide } from "../../src/lib/types";

type Link = { retailer: ProductSide["retailer"]; asin: null; url: string };
const NO_ENV = {};
const WALMART_ON = { AFF_WALMART_US: "https://goto.walmart.com/c/1234567/565706/9383" };
const feed = (link?: string): { feed: FeedInfo } => ({ feed: { network: "awin", link, seen: "2026-11-10", stock: "in" } });
const AWIN_LINK = "https://www.awin1.com/pclick.php?p=123&a=456&m=789";

const walmart: Link = { retailer: "walmart", asin: null, url: "https://www.walmart.com/ip/Equate-Ibuprofen/10315394" };
const zooplus: Link = { retailer: "zooplus", asin: null, url: "https://www.zooplus.de/shop/hunde/1983704?activeVariant=1983704.2" };

function swap(market: "US" | "DE", brand: Link, alternative: Link, prices: Record<string, { feed?: FeedInfo }> = {}) {
  return { market, brand: { ...brand, brand: "Brand" }, alternative: { ...alternative, brand: "Own" }, prices } as unknown as Parameters<typeof swapDisclosure>[0];
}

test("nothing configured: no link earns and every page says so", () => {
  assert.equal(mayEarn(walmart, "US", undefined, NO_ENV), false);
  assert.equal(linksEarn(NO_ENV, 0), false);
  const p = swap("US", walmart, walmart);
  assert.deepEqual(earningSides(p, NO_ENV), []);
  assert.equal(swapDisclosure(p, "en", NO_ENV, 0), "We don't earn anything from these links.");
  assert.equal(swapDisclosure(p, "de", NO_ENV, 0), "An diesen Links verdienen wir nichts.");
});

test("a programme env setting tags only its own store's links", () => {
  assert.equal(mayEarn(walmart, "US", undefined, WALMART_ON), true);
  assert.equal(mayEarn(zooplus, "DE", undefined, WALMART_ON), false);
  const p = swap("US", zooplus, walmart);
  assert.deepEqual(earningSides(p, WALMART_ON), ["alternative"]);
  assert.equal(swapDisclosure(p, "en", WALMART_ON, 0), "The Walmart link is an affiliate link. We may earn a commission at no cost to you.");
  assert.equal(swapDisclosure(p, "de", WALMART_ON, 0), "Der Link zu Walmart ist ein Affiliate-Link. Wir erhalten eventuell eine Provision, für dich ohne Mehrkosten.");
  // Neither side here earns, but the site's other links do.
  const q = swap("DE", zooplus, zooplus);
  assert.equal(swapDisclosure(q, "en", WALMART_ON, 0), "These two links don't earn us anything. A link further down this page may.");
});

test("a feed's tracked link earns with no env set; a feed reading without a link doesn't", () => {
  assert.equal(mayEarn(zooplus, "DE", feed(AWIN_LINK), NO_ENV), true);
  assert.equal(mayEarn(zooplus, "DE", feed(undefined), NO_ENV), false);
  assert.equal(mayEarn(zooplus, "DE", feed("https://evil.example/c/1/2/3"), NO_ENV), false, "only the networks' own click hosts count");
  const p = swap("DE", zooplus, zooplus, { alternative: feed(AWIN_LINK) });
  assert.deepEqual(earningSides(p, NO_ENV), ["alternative"]);
  assert.equal(swapDisclosure(p, "de", NO_ENV, 1), "Der Link zu zooplus ist ein Affiliate-Link. Wir erhalten eventuell eine Provision, für dich ohne Mehrkosten.");
  const both = swap("DE", zooplus, zooplus, { alternative: feed(AWIN_LINK), brand: feed(AWIN_LINK) });
  assert.equal(swapDisclosure(both, "en", NO_ENV, 2), "Affiliate links. We may earn a commission at no cost to you.");
  assert.equal(swapDisclosure(both, "de", NO_ENV, 2), "Affiliate-Links. Wir erhalten eventuell eine Provision, für dich ohne Mehrkosten.");
  assert.equal(linksEarn(NO_ENV, 1), true, "the footer and disclosure page count feed links");
});

test("a kit earns when its own link or any piece's link does", () => {
  const kit = (prices: Record<string, { feed?: FeedInfo }>) =>
    ({ market: "DE", bundle: { ...zooplus }, components: [{ ...zooplus, replaces: 0 }, { ...zooplus, replaces: 1 }], prices }) as unknown as Parameters<typeof kitEarns>[0];
  assert.equal(kitEarns(kit({}), NO_ENV), false);
  assert.equal(kitEarns(kit({ "item-1": feed(AWIN_LINK) }), NO_ENV), true);
  assert.equal(kitEarns(kit({ kit: feed(AWIN_LINK) }), NO_ENV), true);
});
