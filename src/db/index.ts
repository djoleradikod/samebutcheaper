import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

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
  const client = postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 5 });
  globalForDb.__sbcDb = drizzle(client, { schema });
  return globalForDb.__sbcDb;
}

export { schema };
