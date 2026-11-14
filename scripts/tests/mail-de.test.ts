/**
 * Emails in German, for subscribers who signed up on /de: the words, the links and the money read German, and every
 * email keeps its unsubscribe headers exactly as the English one does. English emails are unchanged (the English
 * strings are asserted here and in loops.test.ts).
 *
 *   npx tsx --test scripts/tests/mail-de.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import catalogJson from "../../src/generated/catalog.json";
import type { CatalogueView } from "../../src/lib/catalog-data";
import { buildIssue, letterMail } from "../../src/lib/letter";
import { confirmationMail, listHeaders } from "../../src/lib/newsletter";
import { wishMail } from "../../src/lib/wanted-answer";
import { pricesOf, watchMail } from "../../src/lib/watches";
import type { Pair } from "../../src/lib/types";

const SITE = "https://samebutcheaper.test";
const CONTACT = "hello@samebutcheaper.test";
const catalogue = catalogJson as unknown as CatalogueView;
const pairs = catalogue.pairs as Pair[];
const german = pairs.find((p) => p.market === "DE")!;
const now = new Date("2026-11-12T09:00:00Z");
const TOKEN = "u".repeat(43);

/** English words a German email must not carry (outside product names, which are the same in both). */
const ENGLISH = /\b(?:the|you|your|swap|swaps|instead of|less|Unsubscribe|legal notice|See the|Prices)\b/;
const visible = (text: string) => text.replace(/https?:\/\/\S+/g, "");

test("the confirmation email: German words, the same link, headers and opt-in", () => {
  for (const purpose of [{ kind: "letter" }, { kind: "watch", id: 3, title: "Ratiopharm statt Aspirin" }, { kind: "wish", id: 4, query: "ibuprofen" }] as const) {
    const de = confirmationMail("a@example.com", "s".repeat(43), SITE, purpose, now, { unsubscribeToken: TOKEN, subscriberId: 7 }, "de");
    const en = confirmationMail("a@example.com", "s".repeat(43), SITE, purpose, now, { unsubscribeToken: TOKEN, subscriberId: 7 });
    assert.match(de.subject, /^Bestätige deine/);
    assert.ok(de.text.startsWith("Bitte bestätige deine E-Mail-Adresse"));
    assert.ok(de.html.includes('<html lang="de">'));
    assert.ok(de.text.includes(`${SITE}/newsletter/confirm?t=${"s".repeat(43)}`));
    assert.ok(de.text.includes(`Impressum: ${SITE}/impressum`));
    assert.doesNotMatch(visible(de.text), ENGLISH);
    assert.deepEqual(de.headers, en.headers);
    assert.deepEqual(de.headers, listHeaders(SITE, TOKEN));
    assert.equal(de.idempotencyKey, en.idempotencyKey);
    // English stays as it was.
    assert.ok(en.text.startsWith("Please confirm your email address"));
    assert.ok(en.text.includes(`Impressum (legal notice): ${SITE}/impressum`));
    assert.ok(en.html.startsWith("<!doctype html><html><body"));
  }
});

test("a price watch email: German words and money, /de links, the watch's own unsubscribe header", () => {
  const before = pricesOf(german);
  const moved = { ...before, altPpu: before.altPpu * 1.25 };
  const de = watchMail(
    { to: "a@example.com", token: TOKEN, watchId: 9, title: german.title, slug: german.slug, country: "DE", lang: "de", before: moved, change: { withdrawn: false, move: -0.2, savingsDropped: false, prices: before }, pair: german },
    { siteUrl: SITE, contactEmail: CONTACT },
  );
  assert.match(de.subject, /^Preisänderung bei einem beobachteten Vergleich: /);
  assert.ok(de.text.includes(`ist um 20 % günstiger geworden`));
  assert.match(de.text, /\d[\s\u00a0\u202f](?:€|ct)/u, "German money");
  assert.ok(de.text.includes(`${SITE}/de/compare/${german.slug}?`));
  assert.ok(de.text.includes("Von allem abmelden: "));
  assert.ok(de.html.includes('<html lang="de">'));
  assert.deepEqual(de.headers, listHeaders(SITE, TOKEN, "watch-9"));
  assert.doesNotMatch(visible(de.text.split("--")[0].split("\n").slice(1).join("\n")), ENGLISH);

  const gone = watchMail(
    { to: "a@example.com", token: TOKEN, watchId: 9, title: "Gone", slug: "x", country: "DE", lang: "de", before, change: { withdrawn: true }, pair: null },
    { siteUrl: SITE, contactEmail: CONTACT },
  );
  assert.equal(gone.subject, "Wir haben einen Vergleich zurückgezogen, den du beobachtest");
  assert.ok(gone.text.includes(`${SITE}/de/search?`));
});

test("the weekly letter in German: sections, links and the yearly line", () => {
  const issue = buildIssue({ catalogue, country: "DE", sent: new Set(), seen: {}, now })!;
  assert.ok(issue);
  const de = letterMail(issue, { to: "x@example.com", token: TOKEN, issueKey: "2026-W46", lang: "de" }, { siteUrl: SITE, contactEmail: CONTACT, postalAddress: "Musterstraße 1" });
  const en = letterMail(issue, { to: "x@example.com", token: TOKEN, issueKey: "2026-W46" }, { siteUrl: SITE, contactEmail: CONTACT, postalAddress: "Musterstraße 1" });
  assert.ok(de.text.startsWith("Die Vergleiche dieser Woche"));
  assert.ok(de.text.includes("Vom wöchentlichen Brief abmelden: "));
  assert.ok(de.text.includes(`${SITE}/de/compare/`));
  assert.ok(!de.text.includes(`${SITE}/compare/`));
  assert.match(de.text, / % günstiger/);
  assert.deepEqual(de.headers, en.headers);
  assert.deepEqual(de.headers, listHeaders(SITE, TOKEN, "letter"));
  assert.ok(en.text.startsWith("This week's swaps"));
  assert.ok(en.text.includes(`${SITE}/compare/`));
});

test("a wish answer in German", () => {
  const de = wishMail({ to: "a@example.com", token: TOKEN, query: "ibuprofen", country: "DE", lang: "de", pairs: [german] }, { siteUrl: SITE, contactEmail: CONTACT });
  assert.equal(de.subject, "Wir haben eine Alternative für „ibuprofen“ aufgenommen");
  assert.ok(de.text.includes(`${SITE}/de/search?q=ibuprofen`));
  assert.deepEqual(de.headers, listHeaders(SITE, TOKEN));
  const en = wishMail({ to: "a@example.com", token: TOKEN, query: "ibuprofen", country: "DE", pairs: [german] }, { siteUrl: SITE, contactEmail: CONTACT });
  assert.equal(en.subject, "We've added a swap for “ibuprofen”");
});
