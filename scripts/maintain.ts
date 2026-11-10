/** Runs the daily upkeep now (src/lib/maintenance.ts):  DATABASE_URL=... npm run db:maintain */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { runMaintenance } from "../src/lib/maintenance";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = postgres(url, { max: 2, onnotice: () => {} });
try {
  const report = await runMaintenance(drizzle(client, { schema }), {
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  });
  console.log(report ? JSON.stringify(report, null, 2) : "Another upkeep run is in progress.");
} finally {
  await client.end();
}
