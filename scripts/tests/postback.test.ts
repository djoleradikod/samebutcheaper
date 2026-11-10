import assert from "node:assert/strict";
import { test } from "node:test";
import { flatten, formFields, parsePostback } from "../../src/lib/postback";

test("our own field names", () => {
  const r = parsePostback({ key: "s", network: "Impact", click: "abc123def", order: "A-1", commission: "1.5", sale: "30", currency: "gbp", status: "APPROVED" });
  assert.ok(r.ok);
  assert.deepEqual(
    { ...r.value, raw: undefined },
    { network: "impact", orderId: "A-1", clickId: "abc123def", commission: "1.50", sale: "30.00", currency: "GBP", status: "approved", raw: undefined },
  );
  assert.equal("key" in r.value.raw, false, "the secret is never stored");
});

test("Impact's names", () => {
  const r = parsePostback({ network: "impact", SubId1: "abc123def", ActionId: "9000.1.2", Payout: "2.10", Amount: "42.00", Currency: "USD", State: "PENDING" });
  assert.ok(r.ok);
  assert.equal(r.value.clickId, "abc123def");
  assert.equal(r.value.orderId, "9000.1.2");
  assert.equal(r.value.commission, "2.10");
  assert.equal(r.value.sale, "42.00");
  assert.equal(r.value.status, "pending");
});

test("Awin posts JSON inside one form field", () => {
  const push = JSON.stringify({
    transactionId: "259630312",
    transactionDate: "2026-11-10 16:01:25",
    transactionCurrency: "EUR",
    transactionAmount: "38.40",
    affiliateId: "45628",
    merchantId: "13808",
    clickRef: "k3j2h1g0f9",
    commission: "4.61",
    ip: "203.0.113.7",
    url: "https://samebutcheaper.com/compare/x",
    commissionGroups: [{ id: "1", name: "Default", code: "DEFAULT" }],
    products: [{ productName: "Ibuprofen 400", unitPrice: "3.20", quantity: "12" }],
  });
  const fields = formFields([["AwinTransactionPush", push]]);
  const r = parsePostback({ ...fields, network: "awin", key: "s" });
  assert.ok(r.ok);
  assert.equal(r.value.orderId, "259630312");
  assert.equal(r.value.clickId, "k3j2h1g0f9");
  assert.equal(r.value.commission, "4.61");
  assert.equal(r.value.sale, "38.40");
  assert.equal(r.value.currency, "EUR");
  assert.equal(r.value.status, "pending");
  const kept = Object.keys(r.value.raw).join(" ");
  assert.ok(!/\bip\b/.test(kept), "the shopper's address is dropped");
  assert.ok(!kept.includes("products"), "what they bought is dropped");
  assert.ok(!kept.includes("url"));
  assert.equal(r.value.raw.merchantId, "13808");
});

test("nested JSON reports flatten", () => {
  const flat = flatten({ commissionAmount: { amount: 1.25, currency: "CAD" }, orderId: 77, saleAmount: { amount: 20 } });
  const r = parsePostback({ ...flat, network: "partnerize" });
  assert.ok(r.ok);
  assert.equal(r.value.commission, "1.25");
  assert.equal(r.value.currency, "CAD");
  assert.equal(r.value.sale, "20.00");
  assert.equal(r.value.orderId, "77");
});

test("statuses map onto pending, approved and reversed", () => {
  const status = (s: string) => {
    const r = parsePostback({ network: "n", order: "1", commission: "1", status: s });
    return r.ok ? r.value.status : null;
  };
  assert.equal(status("locked"), "approved");
  assert.equal(status("Paid"), "approved");
  assert.equal(status("declined"), "reversed");
  assert.equal(status("cancelled"), "reversed");
  assert.equal(status("something-new"), "pending");
});

test("rejects reports missing the essentials, and junk values", () => {
  assert.equal(parsePostback({ network: "awin", commission: "1" }).ok, false);
  assert.equal(parsePostback({ order: "1", commission: "1" }).ok, false);
  assert.equal(parsePostback({ network: "awin", order: "1" }).ok, false);
  assert.equal(parsePostback({ network: "awin", order: "1", commission: "abc" }).ok, false);
  const r = parsePostback({ network: "awin", order: "1", commission: "1", click: "../../etc", currency: "EURO" });
  assert.ok(r.ok);
  assert.equal(r.value.clickId, null, "a click ID that isn't ours is ignored");
  assert.equal(r.value.currency, "USD");
});

test("form fields that only look like JSON are kept as text", () => {
  assert.deepEqual(formFields([["note", "{not json}"], ["a", "1"]]), { note: "{not json}", a: "1" });
});
