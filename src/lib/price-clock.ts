/**
 * The moment the catalogue is read at, for time-limited prices (src/lib/price-expiry.ts).
 *
 * Unset (at build time, in scripts and tests) the catalogue reads as built. In the running server, the price clock
 * (src/lib/server/price-clock.ts) sets it whenever a limited price's window closes, and from then on every page,
 * feed and email reads the catalogue with that price withheld. It is a plain value on globalThis, set from a timer,
 * so a page never reads the time itself: renders stay deterministic, and pages change only when the server
 * re-renders them on purpose.
 *
 * Not server-only: src/lib/catalog-data.ts (jobs and scripts) reads it too.
 */
import { expireCatalog } from "./price-expiry";
import type { Catalog } from "./types";

type Clocked = Pick<Catalog, "pairs" | "bundles" | "presets">;

const g = globalThis as unknown as { __sbcPriceClock?: number };

/** The moment (milliseconds) the catalogue is read at, or undefined: as built. */
export function priceClock(): number | undefined {
  return g.__sbcPriceClock;
}

/** Moves the clock. Only ever forwards: a price once withheld never comes back without a new build. */
export function setPriceClock(ms: number) {
  if (g.__sbcPriceClock === undefined || ms > g.__sbcPriceClock) g.__sbcPriceClock = ms;
}

/** Tests only. */
export function resetPriceClock() {
  delete g.__sbcPriceClock;
}

const views = new WeakMap<object, { at: number; view: Clocked }>();

/** The catalogue as it reads at the clock: the same object while nothing has expired. */
export function catalogNow<C extends Clocked>(built: C): C {
  const at = g.__sbcPriceClock;
  if (at === undefined) return built;
  const hit = views.get(built);
  if (hit?.at === at) return hit.view as C;
  const view = expireCatalog(built, at);
  views.set(built, { at, view });
  return view;
}
