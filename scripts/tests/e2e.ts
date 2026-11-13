/**
 * The built site, started for real and driven over HTTP against a real Postgres:  npm run test:e2e
 *
 * Needs `npm run build` first and TEST_DATABASE_URL pointing at a database that may be wiped (never the live
 * one). Every scenario uses its own visitor address, so rate limits in one can't affect another. Whatever
 * affiliate IDs the site was built with are honoured: a tagged link must carry our click ID, an untagged one
 * must be the store's own URL.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import catalog from "../../src/generated/catalog.json";
import * as schema from "../../src/db/schema";
import { PROGRAMS } from "../../src/lib/affiliate-programs";
import { requestWatch, subscribeEmail } from "../../src/lib/newsletter";
import { pricesOf } from "../../src/lib/watches";
import type { Pair } from "../../src/lib/types";
import { storesFor } from "../../src/lib/markets";

const root = join(import.meta.dirname, "..", "..");
const serverJs = join(root, ".next", "standalone", "server.js");
const dbUrl = process.env.TEST_DATABASE_URL;
const skip = !dbUrl ? "TEST_DATABASE_URL is not set" : !existsSync(serverJs) ? "run `npm run build` first" : false;

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = "e2e-admin-password-1234";
const SECRET = "e2e-postback-secret-0123456789";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const client = dbUrl ? postgres(dbUrl, { max: 4, onnotice: () => {} }) : null;
const db = client ? drizzle(client, { schema }) : null!;
const { clicks, conversions, subscribers } = schema;

let web: ChildProcess;
let mailServer: Server;
let mailUrl = "";
const sent: { to: string[]; text: string }[] = [];
let serverLog = "";

let ipCounter = 0;
/** A browser-like visitor with an address of their own. */
function visitor(extra: Record<string, string> = {}) {
  const ip = `198.51.100.${++ipCounter}`;
  return { ip, headers: { "user-agent": CHROME, "x-forwarded-for": ip, ...extra } };
}
const get = (path: string, headers: Record<string, string> = {}, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, { redirect: "manual", headers, ...init });
const basic = (pass: string) => `Basic ${Buffer.from(`admin:${pass}`).toString("base64")}`;

/** Clicks are written after the response is sent, so give them a moment. */
async function clicksFor(slug: string, want: number, tries = 40) {
  for (let i = 0; ; i++) {
    const rows = await db.select().from(clicks).where(eq(clicks.pairSlug, slug)).orderBy(desc(clicks.id));
    if (rows.length >= want || i >= tries) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const pairs = catalog.pairs as { slug: string; alternative: { url?: string } }[];
const slugs = pairs.filter((p) => p.alternative.url).map((p) => p.slug);
let slugAt = 0;
/** A catalogue swap no other scenario has clicked. */
const freshSlug = () => slugs[slugAt++];

before(async () => {
  if (skip) return;
  await migrate(db, { migrationsFolder: join(root, "drizzle") });
  await db.execute(sql`truncate subscribers, clicks, conversions, lookups, submissions, app_state, reports, wanted, watches, wishes, sends restart identity cascade`);

  mailServer = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      sent.push(JSON.parse(body));
      res.writeHead(200, { "content-type": "application/json" }).end('{"id":"m1"}');
    });
  });
  await new Promise<void>((r) => mailServer.listen(0, "127.0.0.1", r));
  mailUrl = `http://127.0.0.1:${(mailServer.address() as { port: number }).port}/emails`;

  web = spawn(process.execPath, [serverJs], {
    cwd: join(root, ".next", "standalone"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: dbUrl,
      ADMIN_PASSWORD: ADMIN,
      POSTBACK_SECRET: SECRET,
      CLICK_HASH_SALT: "e2e-salt-0123456789abcdef",
      RESEND_API_KEY: "re_test",
      MAIL_FROM: "SameButCheaper <hello@samebutcheaper.test>",
      RESEND_API_URL: mailUrl,
      ANTHROPIC_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  web.stdout?.on("data", (c) => (serverLog += c));
  web.stderr?.on("data", (c) => (serverLog += c));
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {}
    if (i > 100) throw new Error(`the server didn't start:\n${serverLog.slice(-2000)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
});

after(async () => {
  web?.kill("SIGTERM");
  mailServer?.close();
  await client?.end();
});

test("health: up, database reachable, every migration applied", { skip }, async () => {
  const res = await get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.status, "ok");
  assert.equal(body.database, "ok");
  const [applied, expected] = String(body.migrations).split("/").map(Number);
  assert.ok(applied >= 1 && applied === expected, body.migrations);
  assert.ok(body.pairs > 100, "the catalogue is loaded");

  const ready = await get("/api/health?ready=1");
  const readyBody = await ready.json();
  assert.equal(ready.status, readyBody.ready ? 200 : 503);
  assert.ok(!readyBody.blockers.includes("database"));
  assert.ok(!readyBody.blockers.includes("admin-password"));
  assert.ok(!JSON.stringify(readyBody).includes(ADMIN), "no secret in the health answer");
});

test("pages carry the security headers", { skip }, async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'self'.*form-action 'self'/);
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("a click is redirected, tagged when a program covers the store, and logged with its context", { skip }, async () => {
  const slug = freshSlug();
  const v = visitor({ cookie: "sbc_country=DE; sbc_src=google.cpc", referer: `${BASE}/compare/${slug}` });
  const res = await get(`/go/${slug}/alternative`, v.headers);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
  const location = res.headers.get("location")!;
  assert.match(location, /^https?:\/\//);

  const [row] = await clicksFor(slug, 1);
  assert.ok(row, "the click was logged");
  assert.equal(row.side, "alternative");
  assert.equal(row.country, "DE");
  assert.equal(row.source, "google.cpc");
  assert.match(row.clickId ?? "", /^[a-z0-9]{6,24}$/);
  assert.match(row.visitorHash ?? "", /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes(v.ip), "the address itself is never stored");
  const store = pairs.find((p) => p.slug === slug)!.alternative.url!;
  const network = PROGRAMS.find((p) => p.id === row.program)?.network;
  // Amazon's tag has no sub-ID field; every other program and both sub-networks take our click ID.
  if (row.program && network !== "amazon") assert.ok(location.includes(row.clickId!), "a tagged link carries our click ID");
  if (!row.program) assert.equal(location, store, "an untagged link is the store's own URL");
});

test("crawlers, HEAD requests and prefetches are redirected but not counted", { skip }, async () => {
  const slug = freshSlug();
  const bot = await get(`/go/${slug}/alternative`, { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)", "x-forwarded-for": visitor().ip });
  assert.equal(bot.status, 302);
  const head = await get(`/go/${slug}/alternative`, visitor().headers, { method: "HEAD" });
  assert.equal(head.status, 302);
  const prefetch = await get(`/go/${slug}/alternative`, visitor({ "sec-purpose": "prefetch" }).headers);
  assert.equal(prefetch.status, 302);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal((await clicksFor(slug, 1, 0)).length, 0);
});

test("one address can't inflate click counts: 60 a minute are logged, all are redirected", { skip }, async () => {
  const slug = freshSlug();
  const v = visitor();
  const statuses = await Promise.all(Array.from({ length: 75 }, () => get(`/go/${slug}/alternative`, v.headers).then((r) => r.status)));
  assert.ok(statuses.every((s) => s === 302));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal((await clicksFor(slug, 60)).length, 60);
});

test("unknown swaps and sides are 404, and /out only goes to listed stores", { skip }, async () => {
  assert.equal((await get("/go/no-such-swap/alternative", visitor().headers)).status, 404);
  assert.equal((await get(`/go/${slugs[0]}/https:%2F%2Fevil.example`, visitor().headers)).status, 404);
  assert.equal((await get("/out?s=evil&c=RS&q=ibuprofen", visitor().headers)).status, 404);
  assert.equal((await get("/out?s=amazon&c=XX&q=ibuprofen", visitor().headers)).status, 400);
  const store = storesFor("DE")[0];
  const ok = await get(`/out?s=${store.id}&c=DE&q=ibuprofen%20400&from=${slugs[0]}`, visitor().headers);
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get("location") ?? "", /^https:\/\//);
});

test("an unknown catalogue page is a real 404", { skip }, async () => {
  assert.equal((await get("/compare/definitely-not-a-swap")).status, 404);
  assert.equal((await get(`/compare/${slugs[0]}`)).status, 200);
});

test("sale postbacks: need the key, tie a sale to its click, and update on a repeat", { skip }, async () => {
  const slug = freshSlug();
  await get(`/go/${slug}/alternative`, visitor().headers);
  const [click] = await clicksFor(slug, 1);
  const v = visitor();

  assert.equal((await get(`/api/postback?network=impact&order=E2E-1&commission=1`, v.headers)).status, 403);
  assert.equal((await get(`/api/postback?key=wrong&network=impact&order=E2E-1&commission=1`, v.headers)).status, 403);
  assert.equal((await get(`/api/postback?key=${SECRET}&network=impact&order=E2E-1`, v.headers)).status, 400);

  const first = await get(`/api/postback?key=${SECRET}&network=impact&click=${click.clickId}&order=E2E-1&commission=2.50&sale=40&currency=EUR`, v.headers);
  assert.equal(first.status, 200);
  let rows = await db.select().from(conversions).where(eq(conversions.orderId, "E2E-1"));
  assert.equal(rows.length, 1);
  assert.deepEqual(
    [rows[0].clickId, rows[0].program, rows[0].commission, rows[0].sale, rows[0].currency, rows[0].status],
    [click.clickId, click.program, "2.50", "40.00", "EUR", "pending"],
  );

  await get(`/api/postback?key=${SECRET}&network=impact&order=E2E-1&commission=2.50&status=approved`, v.headers);
  rows = await db.select().from(conversions).where(eq(conversions.orderId, "E2E-1"));
  assert.equal(rows.length, 1, "the same order updates, it doesn't duplicate");
  assert.deepEqual([rows[0].status, rows[0].clickId, rows[0].sale], ["approved", click.clickId, "40.00"]);
});

test("Awin's report (JSON inside a form field) is accepted, without the shopper's address or basket", { skip }, async () => {
  const push = JSON.stringify({
    transactionId: "E2E-AWIN-1",
    transactionCurrency: "GBP",
    transactionAmount: "25.00",
    clickRef: "abcdef123456",
    commission: "1.75",
    ip: "203.0.113.77",
    products: [{ productName: "Something", quantity: "1" }],
  });
  const res = await fetch(`${BASE}/api/postback?key=${SECRET}&network=awin`, {
    method: "POST",
    headers: { ...visitor().headers, "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: new URLSearchParams({ AwinTransactionPush: push }),
  });
  assert.equal(res.status, 200);
  const [row] = await db.select().from(conversions).where(eq(conversions.orderId, "E2E-AWIN-1"));
  assert.deepEqual([row.network, row.commission, row.sale, row.currency, row.clickId], ["awin", "1.75", "25.00", "GBP", "abcdef123456"]);
  const raw = JSON.stringify(row.raw);
  assert.ok(!raw.includes("203.0.113.77") && !raw.includes("Something") && !raw.includes(SECRET));
});

test("ten wrong postback keys lock that address out, and nobody else", { skip }, async () => {
  const attacker = visitor();
  for (let i = 0; i < 10; i++) assert.equal((await get(`/api/postback?key=guess${i}&network=x&order=1&commission=1`, attacker.headers)).status, 403);
  const locked = await get(`/api/postback?key=${SECRET}&network=x&order=LOCK&commission=1`, attacker.headers);
  assert.equal(locked.status, 429);
  assert.ok(locked.headers.get("retry-after"));
  assert.equal((await get(`/api/postback?key=${SECRET}&network=x&order=LOCK&commission=1`, visitor().headers)).status, 200);
});

test("admin: password required, wrong guesses are locked out, the dashboard and downloads work", { skip }, async () => {
  const anon = await get("/admin", visitor().headers);
  assert.equal(anon.status, 401);
  assert.match(anon.headers.get("www-authenticate") ?? "", /^Basic /);
  assert.equal((await get("/admin/export/subscribers", visitor().headers)).status, 401);

  const owner = visitor();
  const page = await get("/admin", { ...owner.headers, authorization: basic(ADMIN) });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Launch checklist"), "the launch checklist is on the dashboard");
  assert.ok(!html.includes(ADMIN) && !html.includes(SECRET), "no secret is printed on the dashboard");

  const csv = await get("/admin/export/conversions", { ...owner.headers, authorization: basic(ADMIN) });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type") ?? "", /^text\/csv/);
  assert.match(csv.headers.get("content-disposition") ?? "", /attachment; filename="samebutcheaper-conversions-/);
  assert.match(await csv.text(), /^createdAt,updatedAt,network,/);
  assert.equal((await get("/admin/export/passwords", { ...owner.headers, authorization: basic(ADMIN) })).status, 404);

  const attacker = visitor();
  for (let i = 0; i < 10; i++) assert.equal((await get("/admin", { ...attacker.headers, authorization: basic(`guess-${i}`) })).status, 401);
  assert.equal((await get("/admin", { ...attacker.headers, authorization: basic(ADMIN) })).status, 429, "locked out even with the right password");
  assert.equal((await get("/admin", { ...owner.headers, authorization: basic(ADMIN) })).status, 200, "the owner is not");
});

test("newsletter: the emailed link confirms, one-click unsubscribe works, and a GET never unsubscribes", { skip }, async () => {
  assert.equal(await subscribeEmail(db, { email: "e2e@example.com" }, { siteUrl: BASE, env: { RESEND_API_KEY: "re_test", MAIL_FROM: "x <x@samebutcheaper.test>", RESEND_API_URL: mailUrl } }), "sent");
  const link = /http:\/\/\S+confirm\?token=\S+/.exec(sent.at(-1)!.text)![0];
  const token = new URL(link).searchParams.get("token")!;
  const status = async () => (await db.select().from(subscribers).where(eq(subscribers.email, "e2e@example.com")))[0].status;

  const bad = await get("/api/newsletter/confirm?token=nope-nope-nope-nope-nope", visitor().headers);
  assert.deepEqual([bad.status, bad.headers.get("location")], [303, "/newsletter/invalid"]);
  assert.equal(await status(), "pending");

  const ok = await get(new URL(link).pathname + new URL(link).search, visitor().headers);
  assert.deepEqual([ok.status, ok.headers.get("location")], [303, "/newsletter/confirmed"]);
  assert.equal(await status(), "confirmed");
  assert.equal((await get("/newsletter/confirmed")).status, 200);

  const viaGet = await get(`/api/newsletter/unsubscribe?token=${token}`, visitor().headers);
  assert.equal(viaGet.status, 303);
  assert.match(viaGet.headers.get("location") ?? "", /^\/newsletter\/unsubscribe\?token=/);
  assert.equal(await status(), "confirmed", "a mail scanner opening the link changes nothing");
  assert.equal((await get(`/newsletter/unsubscribe?token=${token}`)).status, 200);

  const oneClick = await fetch(`${BASE}/api/newsletter/unsubscribe?token=${token}`, {
    method: "POST",
    headers: { ...visitor().headers, "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  assert.equal(oneClick.status, 200);
  assert.equal(await status(), "unsubscribed");

  const button = await fetch(`${BASE}/api/newsletter/unsubscribe?token=${token}`, { method: "POST", redirect: "manual", headers: visitor().headers });
  assert.deepEqual([button.status, button.headers.get("location")], [303, "/newsletter/unsubscribed"]);
});

test("a price watch's link confirms just that watch, and its one-click link stops just that watch", { skip }, async () => {
  const pair = (catalog.pairs as unknown as Pair[])[0];
  const mailEnv = { RESEND_API_KEY: "re_test", MAIL_FROM: "x <x@samebutcheaper.test>", RESEND_API_URL: mailUrl };
  assert.equal(
    await requestWatch(db, { email: "watch-e2e@example.com", country: "US", slug: pair.slug, title: pair.title, prices: pricesOf(pair) }, { siteUrl: BASE, env: mailEnv }),
    "sent",
  );
  const link = new URL(/http:\/\/\S+confirm\?token=\S+/.exec(sent.at(-1)!.text)![0]);
  assert.match(link.search, /&for=watch-\d+$/);
  const token = link.searchParams.get("token")!;
  const scope = link.searchParams.get("for")!;
  const row = async () => (await db.select().from(subscribers).where(eq(subscribers.email, "watch-e2e@example.com")))[0];
  const watchStatus = async () => (await db.select().from(schema.watches).where(eq(schema.watches.slug, pair.slug)))[0].status;

  const ok = await get(link.pathname + link.search, visitor().headers);
  assert.deepEqual([ok.status, ok.headers.get("location")], [303, "/newsletter/confirmed/watch"]);
  assert.equal((await get("/newsletter/confirmed/watch")).status, 200);
  assert.deepEqual([(await row()).status, (await row()).newsletter, await watchStatus()], ["confirmed", "no", "active"]);

  const page = await get(`/api/newsletter/unsubscribe?token=${token}&only=${scope}`, visitor().headers);
  assert.equal(page.headers.get("location"), `/newsletter/unsubscribe?token=${token}&only=${scope}`);
  const oneClick = await fetch(`${BASE}/api/newsletter/unsubscribe?token=${token}&only=${scope}`, {
    method: "POST",
    headers: { ...visitor().headers, "content-type": "application/x-www-form-urlencoded" },
    body: "List-Unsubscribe=One-Click",
  });
  assert.equal(oneClick.status, 200);
  assert.equal(await watchStatus(), "stopped");
  assert.equal((await row()).status, "confirmed", "only the watch stopped");
  const bad = await fetch(`${BASE}/api/newsletter/unsubscribe?token=${token}&only=everything`, { method: "POST", redirect: "manual", headers: visitor().headers });
  assert.equal(bad.headers.get("location"), "/newsletter/invalid");
  assert.equal((await row()).status, "confirmed", "an unknown scope does nothing, not everything");
});

test("searches with no results are counted once per visitor and query, never from scripts, and limited", { skip }, async () => {
  const post = (q: unknown, headers: Record<string, string>) =>
    fetch(`${BASE}/api/wanted`, { method: "POST", headers: { ...headers, "content-type": "application/json", cookie: "sbc_country=DE" }, body: JSON.stringify({ q }) });
  const a = visitor();
  assert.equal((await post("Zzyzx  Cream", a.headers)).status, 204);
  await post("zzyzx cream", a.headers);
  await post("Zzyzx Cream", visitor().headers);
  await post("Zzyzx Cream", { "user-agent": "curl/8.0", "x-forwarded-for": "203.0.113.9" });
  await post("someone@example.com", visitor().headers);
  const rows = await db.select().from(schema.wanted);
  assert.deepEqual(rows.map((r) => [r.query, r.source, r.country, r.count]), [["zzyzx cream", "search", "DE", 2]]);

  const flood = visitor();
  const codes = [];
  for (let i = 0; i < 22; i++) codes.push((await post(`thing ${i}`, flood.headers)).status);
  assert.deepEqual([codes.filter((c) => c === 204).length, codes.at(-1)], [20, 429]);
});

test("swap and kit pages carry the report form; swap pages the price watch", { skip }, async () => {
  const swap = await (await get(`/compare/${pairs[0].slug}`, visitor().headers)).text();
  assert.ok(swap.includes("Something wrong on this page?"));
  assert.ok(swap.includes("Email me if this changes"));
  const kitSlug = (catalog.bundles as { slug: string }[])[0].slug;
  const kit = await (await get(`/bundle/${kitSlug}`, visitor().headers)).text();
  assert.ok(kit.includes("Something wrong on this page?"));
  assert.ok(!kit.includes("Email me if this changes"));
});

test("admin: the new queues show and the most-wanted list downloads", { skip }, async () => {
  const auth = { ...visitor().headers, authorization: basic(ADMIN) };
  const page = await (await get("/admin", auth)).text();
  for (const heading of ["Something wrong?", "Most wanted", "Weekly letter"]) assert.ok(page.includes(heading), heading);
  const csv = await get("/admin/export/wanted?days=30", auth);
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /^query,country,sources,last7,last30,waiting,waitingPending/);
  const preview = await get("/admin/letter-preview?country=DE", auth);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /utm_source=newsletter/);
  assert.equal((await get("/admin/letter-preview?country=DE", visitor().headers)).status, 401);
});

test("product checks are limited per visitor", { skip }, async () => {
  const v = visitor();
  // An invalid barcode is answered without calling any label database, but still counts as a check.
  const pages = await Promise.all(Array.from({ length: 34 }, () => get("/check?upc=12345678", v.headers).then((r) => r.text())));
  const limited = pages.filter((html) => html.includes("a lot of checks")).length;
  assert.equal(limited, 4, "30 a minute, the rest are asked to wait");
  const other = await (await get("/check?upc=12345678", visitor().headers)).text();
  assert.ok(!other.includes("a lot of checks"));
});

test("photo reading says so when it is switched off, and refuses scripts", { skip }, async () => {
  const off = await fetch(`${BASE}/api/identify`, { method: "POST", headers: visitor().headers, body: new FormData() });
  assert.equal(off.status, 503);
});

test("the server logged no errors while all of this ran", { skip }, async () => {
  const errors = serverLog.split("\n").filter((l) => l.includes('"level":"error"') || /⨯|Unhandled|TypeError|ReferenceError/.test(l));
  assert.deepEqual(errors, []);
});

test("check my shopping: a pasted receipt is matched in the shopper's country, misses counted by name only, results shared by slug", { skip }, async () => {
  const v = visitor({ cookie: "sbc_country=GB", "content-type": "application/json" });
  const receipt = [
    "TESCO STORES LTD",
    "HEINZ TOM KETCHUP 460G      £3.00 A",
    "NUROFEN 200MG 16S           £2.00 A",
    "2 x ZZQUUX TOASTIE 800G     £1.65 A",
    "Clubcard Price Saving      -£0.50",
    "VISA ************4242",
  ].join("\n");
  const res = await fetch(`${BASE}/check/list/match`, { method: "POST", headers: v.headers, body: JSON.stringify({ text: receipt }) });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = (await res.json()) as { ok: boolean; noise: number; lines: { status: string; slug?: string; counted?: string }[]; swaps: Record<string, { currency: string }> };
  assert.equal(body.ok, true);
  assert.deepEqual(body.lines.map((l) => l.status), ["swap", "maybe", "none"]);
  assert.equal(body.noise, 3);
  const ketchup = body.lines[0].slug!;
  assert.match(ketchup, /^heinz-tomato-ketchup-.*-gb$/);
  assert.equal(body.swaps[ketchup].currency, "GBP");
  assert.equal(body.lines[2].counted, "zzquux toastie");

  // The miss is counted by its cleaned name, written after the response; nothing else from the receipt is stored.
  let rows: (typeof schema.wanted.$inferSelect)[] = [];
  for (let i = 0; i < 40 && !rows.length; i++) {
    rows = (await db.select().from(schema.wanted)).filter((r) => r.query.includes("zzquux"));
    if (!rows.length) await new Promise((r) => setTimeout(r, 50));
  }
  assert.deepEqual(rows.map((r) => [r.query, r.source, r.country]), [["zzquux toastie", "check", "GB"]]);
  const stored = JSON.stringify(await db.select().from(schema.wanted)) + JSON.stringify(await db.select().from(schema.lookups));
  for (const bit of ["4242", "1.65", "Clubcard", "TESCO STORES"]) assert.ok(!stored.includes(bit), `${bit} was stored`);
  assert.ok(!serverLog.includes("ZZQUUX") && !serverLog.includes("4242"), "the receipt never reaches the log");

  // A shared result names only slugs and frequencies, and opens the same swap.
  const page = await (await get(`/check/list?s=${ketchup}.2w~not-a-swap`, { ...visitor().headers, cookie: "sbc_country=GB" })).text();
  assert.ok(page.includes("Heinz Tomato Ketchup"), "the shared swap shows");
  assert.ok(page.includes("Paste your shopping list"));

  // Photo reading is off without a key, and the text check refuses scripts and floods.
  const photo = await fetch(`${BASE}/check/list/photo`, { method: "POST", headers: visitor().headers, body: new FormData() });
  assert.equal(photo.status, 503);
  const script = await fetch(`${BASE}/check/list/match`, { method: "POST", headers: { "user-agent": "curl/8.0", "x-forwarded-for": "203.0.113.77" }, body: JSON.stringify({ text: "HEINZ" }) });
  assert.equal(script.status, 403);
  const flood = visitor({ "content-type": "application/json" });
  const codes: number[] = [];
  for (let i = 0; i < 21; i++) {
    codes.push((await fetch(`${BASE}/check/list/match`, { method: "POST", headers: flood.headers, body: JSON.stringify({ text: "HEINZ KETCHUP" }) })).status);
  }
  assert.deepEqual([codes.filter((c) => c === 200).length, codes.at(-1)], [20, 429]);
});
