import type { Sql } from "postgres";

/**
 * A client-side time limit on every statement, for the writes a visitor waits on (forms, buttons). PostgreSQL's own
 * statement_timeout can't help when the database never answers at all (overloaded, or a dropped network): the query
 * would wait for as long as the TCP connection lives, and so would the visitor's form. Through this wrapper each
 * statement (and each transaction as a whole) gives up after `ms`, and the form shows its usual "something went
 * wrong" a few seconds later. The statement may still finish on the server; the visitor just isn't kept waiting.
 *
 * Only the queries drizzle sends through `unsafe` and `begin` are timed. Prerendered pages never read the database
 * (src/lib/reported.ts waits for a request first), and upkeep keeps the untimed client.
 */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`database did not answer within ${ms} ms`);
    this.name = "DbTimeoutError";
  }
}

export function withTimeout<T>(work: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DbTimeoutError(ms)), ms);
  });
  return Promise.race([Promise.resolve(work), limit]).finally(() => clearTimeout(timer));
}

type Pending = PromiseLike<unknown> & { values(): PromiseLike<unknown> };

/** The postgres.js client with `unsafe` and `begin` timed; everything else (options, parsers) passes through. */
export function timedClient<T extends Sql>(client: T, ms: number): T {
  const timedQuery = (q: Pending) => ({
    values: () => withTimeout(q.values(), ms),
    then: <A, B>(ok?: ((v: unknown) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) => withTimeout(q, ms).then(ok, fail),
  });
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "unsafe") return (...args: unknown[]) => timedQuery((target.unsafe as (...a: unknown[]) => unknown)(...args) as Pending);
      if (prop === "begin") return (...args: unknown[]) => withTimeout((target.begin as (...a: unknown[]) => PromiseLike<unknown>)(...args), ms);
      return Reflect.get(target, prop, receiver);
    },
  });
}
