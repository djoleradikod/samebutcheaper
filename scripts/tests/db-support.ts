/**
 * Shared by the database test files. node:test runs files in parallel, and each file empties the same tables, so a
 * file holds a Postgres advisory lock for its whole run: the files take turns instead of wiping each other's rows.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

const LOCK = 7262099;

export const ALL_TABLES = sql`truncate subscribers, clicks, conversions, lookups, submissions, app_state, reports, wanted, watches, wishes, sends restart identity cascade`;

export function testDb(url: string | undefined) {
  const client = url ? postgres(url, { max: 4, onnotice: () => {} }) : null;
  const db = client ? drizzle(client, { schema }) : null!;
  let lock: postgres.ReservedSql | null = null;
  return {
    client,
    db,
    /** Takes the lock, then applies the migrations. */
    async open() {
      if (!client) return;
      lock = await client.reserve();
      await lock`select pg_advisory_lock(${LOCK})`;
      await migrate(db, { migrationsFolder: join(import.meta.dirname, "..", "..", "drizzle") });
    },
    async close() {
      if (lock) {
        await lock`select pg_advisory_unlock(${LOCK})`;
        lock.release();
      }
      await client?.end();
    },
  };
}

/** A stand-in for Resend: records what would have been sent, and can fail the next send. */
export type Sent = { to: string[]; subject: string; text: string; html: string; headers?: Record<string, string>; from: string; idempotencyKey?: string };

export function mailStub() {
  const state = { sent: [] as Sent[], failNext: 0, env: {} as Record<string, string>, server: null as Server | null };
  return {
    state,
    async start() {
      state.server = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          if (state.failNext > 0) {
            state.failNext--;
            res.writeHead(500).end("{}");
            return;
          }
          assert.equal(req.headers.authorization, "Bearer re_test");
          state.sent.push({ ...JSON.parse(body), idempotencyKey: req.headers["idempotency-key"] as string | undefined });
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `mail-${state.sent.length}` }));
        });
      });
      await new Promise<void>((r) => state.server!.listen(0, "127.0.0.1", r));
      const { port } = state.server.address() as { port: number };
      state.env = { RESEND_API_KEY: "re_test", MAIL_FROM: "SameButCheaper <hello@samebutcheaper.test>", RESEND_API_URL: `http://127.0.0.1:${port}/emails` };
    },
    stop() {
      state.server?.close();
    },
    reset() {
      state.sent.length = 0;
      state.failNext = 0;
    },
  };
}
