import "server-only";
import { cacheLife, cacheTag, io } from "next/cache";
import { getDb } from "@/db";
import { log } from "./log";
import { setReported } from "./reported-state";
import { flaggedRecords, type FlaggedRecord } from "./reports";

export const REPORTED_TAG = "reported-records";

/**
 * The records shoppers have reported as changed, shared by every request for a minute (Cache Components
 * `use cache` with a short cacheLife). An `expire` under five minutes keeps it out of prerendered HTML: it is
 * always read at request time, inside a Suspense boundary. Resolving reports in /admin refreshes it at once
 * (updateTag). Without a database, or if the query fails, nothing is reported.
 */
async function cachedFlags(): Promise<FlaggedRecord[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 240 });
  cacheTag(REPORTED_TAG);
  const db = getDb();
  if (!db) return [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A slow database must not hold up every list page: after two seconds, nothing is reported this minute.
    const slow = new Promise<FlaggedRecord[]>((resolve) => {
      timer = setTimeout(() => resolve([]), 2000);
    });
    return await Promise.race([flaggedRecords(db), slow]);
  } catch (err) {
    log.error("reports.flags_failed", { err });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the flags and refreshes the snapshot ranking code reads (src/lib/reported-state.ts).
 *
 * `io()` first: during a prerender it suspends, so the caller's Suspense boundary is a hole filled at request time and
 * the short-lived cache is never entered at build. Without it every prerendered swap, kit and list page ran the
 * database read in the cache-warming pass, could not keep the result (a short-lived entry is left out of prerenders),
 * missed it again in the final pass and logged "Unexpected cache miss after cache warming" for each page. At request
 * time `io()` resolves at once, so the minute-long cache works exactly as before.
 */
export async function reportedRecords(): Promise<FlaggedRecord[]> {
  await io();
  const flags = await cachedFlags();
  setReported(flags);
  return flags;
}
