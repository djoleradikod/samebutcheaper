/**
 * Buying a kit or a basket: the one-click cart builder, whole packs at the till, the buying list and the kit filters.
 *
 *   npx tsx --test scripts/qa/kit-buying.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/generated/catalog.json";
import { buyListText, groupByStore, namesPack, pieceLabel, type BuyStore } from "../../src/lib/buy-list";
import { AMAZON_CART_DOMAINS, cartSide, cartUrl, sellerOfCartSide } from "../../src/lib/cart";
import { basketCheckout, checkout, tillLine, wholePacks, type TillLine } from "../../src/lib/delivery";
import { filterKits } from "../../src/lib/kit-filter";
import { MARKETS } from "../../src/lib/markets";
import type { Catalog } from "../../src/lib/types";

const cat = catalog as unknown as Catalog;
const TAGS = { AMAZON_ASSOCIATE_TAG: "sbc-20", AMAZON_TAGS: "amazon.co.uk:sbcuk-21,amazon.de:sbcde-21" };

/* ------------------------------------------------------------------ cart */

test("an Amazon cart puts every piece in with its quantity and our tag", () => {
  const url = cartUrl(
    "amazon",
    [
      { seller: "amazon", asin: "B000000001" },
      { seller: "amazon", asin: "B000000002" },
      { seller: "target", asin: null },
    ],
    "US",
    TAGS,
  );
  assert.ok(url);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://www.amazon.com/gp/aws/cart/add.html");
  assert.equal(u.searchParams.get("ASIN.1"), "B000000001");
  assert.equal(u.searchParams.get("Quantity.1"), "1");
  assert.equal(u.searchParams.get("ASIN.2"), "B000000002");
  assert.equal(u.searchParams.get("Quantity.2"), "1");
  assert.equal(u.searchParams.get("ASIN.3"), null, "a piece from another store stays out");
  assert.equal(u.searchParams.get("AssociateTag"), "sbc-20");
});

test("each market's cart goes to its own storefront with that storefront's tag", () => {
  const pieces = [
    { seller: "amazon", asin: "B000000001" },
    { seller: "amazon", asin: "B000000002" },
  ];
  const gb = new URL(cartUrl("amazon", pieces, "GB", TAGS)!);
  assert.equal(gb.hostname, "www.amazon.co.uk");
  assert.equal(gb.searchParams.get("AssociateTag"), "sbcuk-21");
  const de = new URL(cartUrl("amazon", pieces, "DE", TAGS)!);
  assert.equal(de.hostname, "www.amazon.de");
  assert.equal(de.searchParams.get("AssociateTag"), "sbcde-21");
  const ca = new URL(cartUrl("amazon", pieces, "CA", TAGS)!);
  assert.equal(ca.hostname, "www.amazon.ca");
  assert.equal(ca.searchParams.get("AssociateTag"), null, "no tag set for amazon.ca, so none is sent");
});

test("no cart when any piece lacks an ASIN, for one piece, for a storefront the form doesn't document, or another store", () => {
  const two = [
    { seller: "amazon", asin: "B000000001" },
    { seller: "amazon", asin: "B000000002" },
  ];
  assert.equal(cartUrl("amazon", [two[0], { seller: "amazon", asin: null }], "US", TAGS), null);
  assert.equal(cartUrl("amazon", [two[0], { seller: "amazon", asin: "not-an-asin" }], "US", TAGS), null);
  assert.equal(cartUrl("amazon", [two[0]], "US", TAGS), null);
  assert.equal(MARKETS.IE.amazon, "amazon.ie");
  assert.ok(!AMAZON_CART_DOMAINS.has("amazon.ie"));
  assert.equal(cartUrl("amazon", two, "IE", TAGS), null);
  assert.equal(cartUrl("target", two.map((p) => ({ ...p, seller: "target" })), "US", TAGS), null);
});

test("the same pack twice is one line with quantity two", () => {
  const u = new URL(cartUrl("amazon", [{ seller: "amazon", asin: "B000000001" }, { seller: "amazon", asin: "B000000001" }], "US", TAGS)!);
  assert.equal(u.searchParams.get("ASIN.1"), "B000000001");
  assert.equal(u.searchParams.get("Quantity.1"), "2");
  assert.equal(u.searchParams.get("ASIN.2"), null);
});

test("cart sides round-trip and refuse anything else", () => {
  assert.equal(cartSide("amazon"), "cart-amazon");
  assert.equal(sellerOfCartSide("cart-amazon"), "amazon");
  assert.equal(sellerOfCartSide("item-0"), null);
  assert.equal(sellerOfCartSide("cart-../x"), null);
});

test("every kit's cart button only appears where the cart would hold every piece from that store", () => {
  for (const b of cat.bundles) {
    for (const s of b.checkout.stores) {
      const mine = b.components.filter((c) => c.seller === s.seller);
      const url = cartUrl(s.seller, b.components, b.market, TAGS);
      if (!url) continue;
      const asins = new URL(url).searchParams;
      for (const c of mine) assert.ok([...asins.values()].includes(c.asin!), `${b.slug}: ${c.product} missing from the cart`);
    }
  }
});

/* ------------------------------------------------------------ whole packs */

test("whole packs cover the amount, and a pack a tenth short counts as enough", () => {
  assert.equal(wholePacks(0), 0);
  assert.equal(wholePacks(0.2), 1);
  assert.equal(wholePacks(1), 1);
  assert.equal(wholePacks(1.07), 1);
  assert.equal(wholePacks(1.1), 1);
  assert.equal(wholePacks(1.2), 2);
  assert.equal(wholePacks(5.05), 5);
  assert.equal(wholePacks(5.2), 6);
});

test("a line priced per amount scales its same-amount cost instead of counting packs", () => {
  const line: TillLine = { seller: "dm", altCost: 0.66, qty: 3, pack: null };
  assert.deepEqual(tillLine(line, 3), { packs: null, cost: 0.66 });
  assert.deepEqual(tillLine(line, 6), { packs: null, cost: 1.32 });
  assert.deepEqual(tillLine(line, 0), { packs: 0, cost: 0 });
});

test("a basket's checkout at any quantity is its lines' till costs, store by store", () => {
  for (const p of cat.presets) {
    const lines: TillLine[] = p.lines.map((l) => ({ seller: l.seller, altCost: l.altCost, qty: l.qty, pack: l.pack }));
    // The build's checkout is the starting quantities.
    assert.deepEqual(basketCheckout(lines, p.lines.map((l) => l.qty), p.market), p.checkout, p.slug);
    for (const qty of [p.lines.map(() => 0), p.lines.map((l, i) => (i % 2 ? 0 : l.qty + 2)), p.lines.map((_, i) => (i % 3) + 1)]) {
      const c = basketCheckout(lines, qty, p.market);
      const bySeller = new Map<string, number>();
      lines.forEach((l, i) => bySeller.set(l.seller, (bySeller.get(l.seller) ?? 0) + tillLine(l, qty[i]).cost));
      for (const s of c.stores) assert.ok(Math.abs(s.subtotal - bySeller.get(s.seller)!) < 0.011, `${p.slug} ${s.seller}`);
      // A store with nothing left in the basket isn't an order.
      assert.equal(c.stores.length, [...bySeller.values()].filter((v) => v > 0).length, p.slug);
      const packs = c.stores.reduce((n, s) => n + s.subtotal, 0);
      assert.ok(Math.abs(c.payToday - packs - (c.delivery ?? 0) - c.surcharge) < 0.011, p.slug);
    }
  }
});

test("a basket never claims free delivery it can't source", () => {
  for (const p of cat.presets) {
    for (const s of p.checkout.stores) if (s.delivery === 0) assert.ok(s.sources.length > 0, `${p.slug} ${s.seller}`);
  }
});

/* ------------------------------------------------------------ buying list */

const kit = cat.bundles.find((b) => b.slug === "clinique-cleansing-edit-set-vs-garnier-balm-neutrogena-remover-cetaphil");

test("the buying list groups pieces by store in the checkout's order", () => {
  for (const b of cat.bundles) {
    const groups = groupByStore(b.checkout, b.components);
    assert.deepEqual(groups.map((g) => g.seller), b.checkout.stores.map((s) => s.seller), b.slug);
    assert.equal(groups.reduce((n, g) => n + g.pieces.length, 0), b.components.length, b.slug);
    for (const g of groups) {
      const sum = g.pieces.reduce((n, c) => n + c.price, 0);
      assert.ok(Math.abs(sum - b.checkout.stores.find((s) => s.seller === g.seller)!.subtotal) < 0.011, b.slug);
    }
  }
});

test("the copied list names every piece, pack, store, price, the total and the page", () => {
  const c = checkout(
    [
      { seller: "target", price: 10.49 },
      { seller: "ulta", price: 9.74 },
      { seller: "ulta", price: 17.99 },
    ],
    "US",
  );
  const stores: BuyStore[] = [
    { seller: "target", name: "Target", cartHref: null, pieces: [{ index: 0, name: "Garnier Balm", pack: "4.2 oz", price: 10.49, replaces: "Balm", href: "/go/x/item-0" }] },
    {
      seller: "ulta",
      name: "Ulta Beauty",
      cartHref: null,
      pieces: [
        { index: 1, name: "Neutrogena Remover", pack: "5.5 oz", price: 9.74, replaces: "Remover", href: "/go/x/item-1" },
        { index: 2, name: "Cetaphil Cleanser", pack: "16 oz", price: 17.99, replaces: "Soap", href: "/go/x/item-2" },
      ],
    },
  ];
  const text = buyListText({ title: "Rebuild the kit", url: "https://example.org/bundle/x", stores, checkout: c, money: (n) => `$${n.toFixed(2)}`, checked: "Nov 2026" });
  assert.equal(
    text,
    [
      "Rebuild the kit",
      "",
      "Target ($10.49, delivery $5.99)",
      "- Garnier Balm, 4.2 oz: $10.49",
      "",
      "Ulta Beauty ($27.73, delivery $6.95)",
      "- Neutrogena Remover, 5.5 oz: $9.74",
      "- Cetaphil Cleanser, 16 oz: $17.99",
      "",
      "Total with delivery: $51.16",
      "Prices checked Nov 2026. Check them before you buy.",
      "https://example.org/bundle/x",
    ].join("\n"),
  );
  assert.ok(!/<|&amp;|undefined|NaN/.test(text));
});

test("a name that already gives its size doesn't get it twice", () => {
  assert.equal(pieceLabel({ name: "Cetaphil Gentle Skin Cleanser, 16.0 oz", pack: "16 oz" }), "Cetaphil Gentle Skin Cleanser, 16.0 oz");
  assert.equal(pieceLabel({ name: "Garnier Balm", pack: "4.2 oz" }), "Garnier Balm, 4.2 oz");
  assert.ok(!namesPack("Pack of 160 sheets", "16 oz"));
});

test("the hardest kit: two stores, and more at the till than the kit", () => {
  assert.ok(kit, "the scratch kit is in the catalogue");
  assert.equal(kit.checkout.stores.length, 2);
  const kitToday = kit.bundle.price + (kit.kitCheckout.delivery ?? 0) + kit.kitCheckout.surcharge;
  assert.ok(kit.checkout.payToday > kitToday);
  assert.ok(kit.netSavings > 0);
});

/* ------------------------------------------------------------ kit filters */

test("kit filters keep one-store kits, one aisle, and sort by the saving after delivery", () => {
  const items = [
    { slug: "a", aisle: "tech", oneStore: true, net: 10, netPct: 50, rank: 2 },
    { slug: "b", aisle: "tech", oneStore: false, net: 40, netPct: 20, rank: 0 },
    { slug: "c", aisle: "skin", oneStore: true, net: 25, netPct: 30, rank: 1 },
  ];
  assert.deepEqual(filterKits(items, { aisle: "all", oneStore: false, sort: "recommended" }).map((i) => i.slug), ["b", "c", "a"]);
  assert.deepEqual(filterKits(items, { aisle: "all", oneStore: false, sort: "amount" }).map((i) => i.slug), ["b", "c", "a"]);
  assert.deepEqual(filterKits(items, { aisle: "all", oneStore: false, sort: "pct" }).map((i) => i.slug), ["a", "c", "b"]);
  assert.deepEqual(filterKits(items, { aisle: "all", oneStore: true, sort: "amount" }).map((i) => i.slug), ["c", "a"]);
  assert.deepEqual(filterKits(items, { aisle: "tech", oneStore: true, sort: "amount" }).map((i) => i.slug), ["a"]);
});
