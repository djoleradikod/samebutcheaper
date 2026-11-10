import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import journal from "../../../drizzle/meta/_journal.json";

/** Migrations this build expects to find applied. */
export const MIGRATIONS_EXPECTED = journal.entries.length;

export type DbStatus = { database: "ok" | "down" | "not-configured"; migrationsApplied: number | null };

/**
 * Whether the database answers, and how many migrations it has had. Gives up after two seconds, so a health
 * check never hangs on a database that is down.
 */
export async function dbStatus(): Promise<DbStatus> {
  if (!getDb()) return { database: "not-configured", migrationsApplied: null };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<DbStatus>((resolve) => {
    timer = setTimeout(() => resolve({ database: "down", migrationsApplied: null }), 2000);
  });
  try {
    return await Promise.race([query(), slow]);
  } finally {
    clearTimeout(timer);
  }
}

async function query(): Promise<DbStatus> {
  const db = getDb();
  if (!db) return { database: "not-configured", migrationsApplied: null };
  try {
    await db.execute(sql`select 1`);
  } catch {
    return { database: "down", migrationsApplied: null };
  }
  try {
    const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
    return { database: "ok", migrationsApplied: row?.n ?? 0 };
  } catch {
    // The migrations table isn't there: nothing has been applied.
    return { database: "ok", migrationsApplied: 0 };
  }
}
