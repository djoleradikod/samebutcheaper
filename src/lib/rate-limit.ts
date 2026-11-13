/**
 * In-memory rate limits. The site runs as one Node process on one server, so a Map is the whole store; a second
 * instance would need a shared one (Postgres or Redis) behind the same function.
 *
 * A rule is "at most `limit` hits per `windowMs`". A key is checked against every rule of its limit and counts
 * against all of them only when all allow it, so a refused request doesn't use up the longer window.
 */
export type Rule = { limit: number; windowMs: number };
export type Verdict = { ok: boolean; /** Seconds until the refusing window opens again, 0 when ok. */ retryAfter: number };

type Bucket = { count: number; resetAt: number };

/** Most keys held per limit. Past it, expired buckets go first, then the oldest. */
const MAX_KEYS = 20_000;

const store = (globalThis as unknown as { __sbcLimits?: Map<string, Map<string, Bucket>> }).__sbcLimits ??= new Map();

function bucketsFor(name: string) {
  let buckets = store.get(name);
  if (!buckets) store.set(name, (buckets = new Map()));
  return buckets;
}

function trim(buckets: Map<string, Bucket>, now: number) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // Still full of live buckets: drop the oldest, which a Map keeps first.
  for (const k of buckets.keys()) {
    if (buckets.size <= MAX_KEYS) break;
    buckets.delete(k);
  }
}

/** Counts one hit for `key` under the named limit and says whether it is allowed. */
export function rateLimit(name: string, key: string, rules: readonly Rule[], now = Date.now()): Verdict {
  const live = rules.map((rule, i) => {
    const buckets = bucketsFor(`${name}#${i}`);
    const found = buckets.get(key);
    return { rule, buckets, bucket: found && found.resetAt > now ? found : null };
  });
  const refused = live.filter(({ rule, bucket }) => bucket && bucket.count >= rule.limit);
  if (refused.length) {
    const wait = Math.max(...refused.map(({ bucket }) => bucket!.resetAt - now));
    return { ok: false, retryAfter: Math.max(1, Math.ceil(wait / 1000)) };
  }
  for (const { rule, buckets, bucket } of live) {
    if (bucket) bucket.count++;
    else {
      buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      trim(buckets, now);
    }
  }
  return { ok: true, retryAfter: 0 };
}

/** Whether `key` is already over the named limit, without counting a hit. */
export function isLimited(name: string, key: string, rules: readonly Rule[], now = Date.now()): boolean {
  return rules.some((rule, i) => {
    const b = store.get(`${name}#${i}`)?.get(key);
    return Boolean(b && b.resetAt > now && b.count >= rule.limit);
  });
}

/** Forgets every count. For tests. */
export function resetRateLimits() {
  store.clear();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The site's limits, per visitor unless noted. Generous for a person, tight for a script. */
export const LIMITS = {
  /** Newsletter and suggestion forms. */
  forms: [
    { limit: 5, windowMs: 10 * MINUTE },
    { limit: 20, windowMs: DAY },
  ],
  /** Product checks: each can call four public label databases with their own quotas. */
  lookups: [
    { limit: 30, windowMs: MINUTE },
    { limit: 400, windowMs: DAY },
  ],
  /** Photo label reads: each one costs money. */
  photos: [
    { limit: 8, windowMs: 10 * MINUTE },
    { limit: 40, windowMs: DAY },
  ],
  /** Outbound clicks we log. Past it the shopper is still redirected, the click just isn't recorded. */
  clicks: [{ limit: 60, windowMs: MINUTE }],
  /** Wrong admin passwords or postback keys. */
  authFailures: [{ limit: 10, windowMs: 15 * MINUTE }],
  /** Email confirm and unsubscribe links. */
  tokens: [{ limit: 30, windowMs: 10 * MINUTE }],
} as const satisfies Record<string, readonly Rule[]>;
