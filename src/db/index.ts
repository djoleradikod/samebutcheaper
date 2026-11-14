import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { timedClient } from "./timed";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sbcDb?: DB | null; __sbcFormDb?: DB | null };

/** How long a visitor's form waits for the database before it says something went wrong (src/db/timed.ts). */
export const FORM_DB_TIMEOUT_MS = Math.max(500, Number(process.env.DB_FORM_TIMEOUT_MS) || 4_000);

/**
 * Returns the database, or null when DATABASE_URL is not configured. The site
 * itself never depends on the database (the catalog is static), so features
 * that write to it degrade gracefully when it is missing.
 */
export function getDb(): DB | null {
  if (globalForDb.__sbcDb !== undefined) return globalForDb.__sbcDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    globalForDb.__sbcDb = null;
    return null;
  }
  const client = postgres(url, {
    max: Math.max(1, Number(process.env.DB_POOL_MAX) || 10),
    idle_timeout: 30,
    connect_timeout: 5,
    // Recycle connections, so a Postgres restart or a long-lived leak can't pin the pool.
    max_lifetime: 30 * 60,
    // No query here should take seconds; one that does is cut off instead of holding a connection.
    connection: { application_name: "sbc-web", statement_timeout: 15_000 },
    onnotice: () => {},
  });
  globalForDb.__sbcDb = drizzle(client, { schema });
  globalForDb.__sbcFormDb = drizzle(timedClient(client, FORM_DB_TIMEOUT_MS), { schema });
  return globalForDb.__sbcDb;
}

/**
 * The same database for what a visitor waits on (forms, confirm and unsubscribe buttons): each statement gives up
 * after FORM_DB_TIMEOUT_MS, so a database that hangs fails the form in seconds instead of keeping it spinning.
 */
export function getFormDb(): DB | null {
  if (!getDb()) return null;
  return globalForDb.__sbcFormDb ?? null;
}

export { schema };
