import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __sbcDb?: DB | null };

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
  return globalForDb.__sbcDb;
}

export { schema };
