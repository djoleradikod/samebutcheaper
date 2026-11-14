import "server-only";
import { timingSafeEqual } from "node:crypto";
import catalogJson from "@/generated/catalog.json";
import { log } from "@/lib/log";
import { expiryMoments } from "@/lib/price-expiry";
import { priceClock, setPriceClock } from "@/lib/price-clock";
import type { Catalog } from "@/lib/types";

/**
 * Withholds a time-limited price when its programme's window closes, without a deploy (src/lib/price-expiry.ts).
 *
 * Started once per server (src/lib/server/startup.ts). With no limited price in the build (no programme with a price
 * rule priced from its feed) it does nothing at all. Otherwise it looks every few minutes; when a price's moment has
 * come it moves the catalogue's clock (src/lib/price-clock.ts), so everything rendered from then on leaves the price
 * out, and asks this server, over loopback, to drop every cached page (src/app/api/prices/expired/route.ts), so the
 * next visit to any page renders it again with the price withheld. A server started after the moment (a restart, a
 * rollback to an older image) moves the clock before it serves anything.
 */
const built = catalogJson as unknown as Catalog;
const CHECK_MS = 5 * 60_000;
export const EXPIRE_HEADER = "x-sbc-prices-expired";

const g = globalThis as unknown as { __sbcPriceToken?: string };

/** The token that lets this server's own timer, and nothing else, call the revalidation route. */
export function priceToken() {
  g.__sbcPriceToken ??= crypto.randomUUID();
  return g.__sbcPriceToken;
}

export function isPriceToken(value: string | null) {
  const want = Buffer.from(priceToken());
  const got = Buffer.from(value ?? "");
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Moves the clock to `now` when a limited price's moment has passed since it last moved. True when it moved, and the
 * pages must be rendered again.
 */
export function advance(now: number, moments: number[] = expiryMoments(built)): boolean {
  const last = priceClock() ?? -Infinity;
  if (!moments.some((t) => t > last && t <= now)) return false;
  setPriceClock(now);
  return true;
}

async function revalidateAll(port: string) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/prices/expired`, { method: "POST", headers: { [EXPIRE_HEADER]: priceToken() }, cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    log.info("prices.expired", { clock: new Date(priceClock()!).toISOString() });
  } catch (err) {
    // The clock has moved, so anything rendered from now on leaves the price out; the cached pages are retried next time.
    log.error("prices.revalidate_failed", { err });
    throw err;
  }
}

/** True when the build has any time-limited price, so the clock has work to do. */
export function hasLimitedPrices() {
  return expiryMoments(built).length > 0;
}

/** Called from startServerTasks. The clock moves at once when the server starts past a moment. */
export function startPriceClock(port = process.env.PORT || "3000") {
  const moments = expiryMoments(built);
  if (!moments.length) return;
  let pending = advance(Date.now(), moments);
  log.info("prices.clock_started", { limitedUntil: new Date(moments.at(-1)!).toISOString(), movedAtStart: pending });
  const tick = async () => {
    if (advance(Date.now(), moments)) pending = true;
    if (!pending) return;
    try {
      await revalidateAll(port);
      pending = false;
    } catch {
      // Logged; tried again on the next tick.
    }
  };
  // Until the server listens the loopback call fails, so a start past a moment retries every half second for a minute:
  // the pages cached in the image are dropped within moments of the first request.
  let tries = 0;
  const early = async () => {
    await tick();
    if (pending && ++tries < 120) setTimeout(() => void early(), 500).unref();
  };
  setTimeout(() => void early(), 200).unref();
  setInterval(() => void tick(), CHECK_MS).unref();
}
