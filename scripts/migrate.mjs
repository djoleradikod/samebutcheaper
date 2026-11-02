/** Applies SQL migrations from ./drizzle to DATABASE_URL. */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: join(import.meta.dirname, "..", "drizzle") });
await client.end();
console.log("Migrations applied.");
