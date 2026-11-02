import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getSiteStats } from "@/lib/catalog";

export async function GET() {
  await connection();
  const db = getDb();
  let database: "ok" | "down" | "not-configured" = "not-configured";
  if (db) {
    try {
      await db.execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "down";
    }
  }
  return Response.json(
    { status: "ok", pairs: getSiteStats().pairs, database },
    { headers: { "Cache-Control": "no-store" } },
  );
}
