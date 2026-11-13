/**
 * A rebuilt kit's checkout: one order per store, each against its free-delivery line, and only fees we have a source for.
 *
 *   npx tsx --test scripts/qa/delivery-rules.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkout, deliveryRule, storeOrder } from "../../src/lib/delivery";
import { sellerOf } from "../../src/lib/sellers";

test("an order under the line pays the fee and says how far it is from free", () => {
  const o = storeOrder("target", "US", 18.58);
  assert.equal(o.delivery, 5.99);
  assert.equal(o.toFree, 16.42);
});

test("an order at or over the line ships free", () => {
  assert.equal(storeOrder("target", "US", 35).delivery, 0);
  assert.equal(storeOrder("target", "US", 35).toFree, null);
});

test("a store that always ships free charges nothing at any size", () => {
  assert.equal(storeOrder("anker", "US", 1).delivery, 0);
});

test("an unknown store or an unknown fee leaves delivery unknown, never zero", () => {
  assert.equal(storeOrder("nobody", "US", 10).delivery, null);
  assert.equal(storeOrder("logitech", "US", 10).delivery, null);
  assert.equal(storeOrder("logitech", "US", 30).delivery, 0);
  assert.equal(checkout([{ seller: "target", price: 10 }, { seller: "nobody", price: 10 }], "US").delivery, null);
});

test("a rule is per market", () => {
  assert.ok(deliveryRule("theordinary", "GB"));
  assert.equal(deliveryRule("target", "GB"), null);
});

test("pieces from one store make one order, and each store's delivery adds up", () => {
  const c = checkout(
    [
      { seller: "target", price: 10 },
      { seller: "target", price: 30 },
      { seller: "ulta", price: 20 },
    ],
    "US",
  );
  assert.equal(c.stores.length, 2);
  assert.equal(c.stores.find((s) => s.seller === "target")?.delivery, 0);
  assert.equal(c.delivery, 6.95);
  assert.equal(c.payToday, 66.95);
});

test("a members-only store counts the non-member surcharge", () => {
  const c = checkout([{ seller: "costco", price: 100 }], "US");
  assert.equal(c.surcharge, 5);
  assert.ok(c.stores[0].membership);
});

test("a locale subdomain doesn't become the seller", () => {
  assert.equal(sellerOf({ brand: "UGREEN", product: "Hub", retailer: "other", url: "https://us.ugreen.com/products/x" }), "ugreen");
  assert.equal(sellerOf({ brand: "X", product: "Y", retailer: "other", url: "https://shop.example.com/a" }), "example");
});

test("a kit delivered to another country is counted with that country's delivery, or says it isn't checked", async () => {
  const { kitFor } = await import("../../src/lib/delivery-abroad");
  const { checkout: co } = await import("../../src/lib/delivery");
  const kit = {
    market: "DE" as const,
    bundle: { price: 40 },
    components: [{ seller: "aponeo", price: 32 }],
    kitSeller: "aponeo",
    savings: 8,
    checkout: co([{ seller: "aponeo", price: 32 }], "DE"),
    kitCheckout: co([{ seller: "aponeo", price: 40 }], "DE"),
    extraDelivery: 0,
    netSavings: 8,
    netSavingsPct: 20,
  };
  assert.equal(kitFor(kit, "DE"), kit);
  assert.equal(kitFor(kit, null), kit);
  const at = kitFor(kit, "AT");
  assert.equal(at.checkout.delivery, 4.99, "Austria has no free-delivery line at this store");
  assert.equal(at.kitCheckout.delivery, 4.99);
  assert.equal(at.extraDelivery, 0);
  assert.equal(at.netSavings, 8);
  assert.equal(at.checkout.payToday, 36.99);
  const ch = kitFor(kit, "CH");
  assert.equal(ch.checkout.delivery, null, "no rule for Switzerland, so never the German one");
  assert.equal(ch.extraDelivery, null);
});

test("a country that lists other markets' records beside its own doesn't filter to its own by default", async () => {
  const { defaultMarket } = await import("../../src/lib/browse");
  const row = (market: string) => ({ market, aisle: "household" }) as never;
  assert.equal(defaultMarket([row("CA"), row("US")], "CA"), "all");
});
