/**
 * The client-side time limit on a visitor's database writes (src/db/timed.ts): a database that never answers fails
 * a form in seconds. Against the test database (skipped without TEST_DATABASE_URL) and scripts/ci/tcp-gate.mjs in
 * hang mode, which accepts connections and never answers.
 *
 *   TEST_DATABASE_URL=postgres://... npx tsx --test scripts/tests/db-timeout.test.ts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/db/schema";
import { DbTimeoutError, timedClient, withTimeout } from "../../src/db/timed";

const URL_ = process.env.TEST_DATABASE_URL;
/** Drizzle wraps a driver error in its own, with the original as `cause`. */
const timedOut = (e: unknown) => e instanceof DbTimeoutError || (e as { cause?: unknown })?.cause instanceof DbTimeoutError;

test("withTimeout passes a quick answer through and gives up on a slow one", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50), 7);
  await assert.rejects(withTimeout(new Promise(() => {}), 30), timedOut);
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 50), /boom/);
});

test("a timed client answers as usual, and gives up on a statement the database sits on", { skip: !URL_ }, async () => {
  const client = postgres(URL_!, { max: 2, onnotice: () => {} });
  try {
    const db = drizzle(timedClient(client, 800), { schema });
    const [row] = await db.execute<{ n: number }>(sql`select 1 as n`);
    assert.equal(row.n, 1);
    assert.equal((await db.transaction(async (tx) => (await tx.execute<{ n: number }>(sql`select 2 as n`))[0].n)), 2);
    const started = Date.now();
    await assert.rejects(db.execute(sql`select pg_sleep(5)`), timedOut);
    assert.ok(Date.now() - started < 2_000, "gave up within the limit");
    await assert.rejects(db.transaction(async (tx) => tx.execute(sql`select pg_sleep(5)`)), timedOut);
  } finally {
    await client.end({ timeout: 0 });
  }
});

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

test("through tcp-gate's hang mode (accepts, never answers) a write fails in seconds, not minutes", { skip: !URL_ }, async () => {
  const target = new URL(URL_!);
  const port = await freePort();
  const gate = spawn(process.execPath, ["scripts/ci/tcp-gate.mjs", String(port), `${target.hostname}:${target.port || 5432}`, "hang"], { stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve) => gate.stdout!.once("data", resolve));
  const hung = new URL(URL_!);
  hung.hostname = "127.0.0.1";
  hung.port = String(port);
  // A long connect timeout, so it is the time limit that answers, not postgres.js giving up on the handshake.
  const client = postgres(hung.toString(), { max: 1, connect_timeout: 60, onnotice: () => {} });
  try {
    const db = drizzle(timedClient(client, 1_000), { schema });
    const started = Date.now();
    await assert.rejects(db.insert(schema.submissions).values({ brandProduct: "Hung database test" }), timedOut);
    assert.ok(Date.now() - started < 3_000, `answered after ${Date.now() - started} ms`);
  } finally {
    gate.kill("SIGTERM");
    await client.end({ timeout: 0 }).catch(() => {});
  }
});
