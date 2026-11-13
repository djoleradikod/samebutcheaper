"use client";

import { useActionState, useEffect, useId } from "react";
import Link from "next/link";
import { wishFor, type FeedbackState } from "@/app/feedback-actions";

/** Searches already counted in this tab, so going back and forth doesn't send one twice. */
const counted = new Set<string>();
/** Wait for the shopper to stop typing, so only the search they meant is counted. */
const SETTLE_MS = 2000;

/**
 * Shown on a search with no results: counts the miss for the "most wanted" list (once the typing has settled, and
 * without anything about who searched), and offers "Tell me when you add it" through double opt-in.
 */
export function WantedPrompt({ term }: { term: string }) {
  useEffect(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2 || q.length > 200 || counted.has(q)) return;
    const timer = setTimeout(() => {
      counted.add(q);
      void fetch("/api/wanted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: term }),
        keepalive: true,
      }).catch(() => {});
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [term]);
  return <WishForm key={term} term={term} />;
}

function WishForm({ term }: { term: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(wishFor, null);
  const id = useId();
  return (
    <div className="mt-3 rounded-card border border-line bg-paper p-4 md:p-5">
      <p id={`${id}-t`} className="font-semibold">
        Tell me when you add it
      </p>
      <p className="mt-1 text-sm text-ink-2">
        One email if we check a swap for “{term}”. We ask you to confirm your address first, and you won&apos;t be
        added to anything else.
      </p>
      {state?.ok ? (
        <p role="status" className="mt-2 text-[13px] text-same">
          {state.message}
        </p>
      ) : (
        <form action={action} aria-labelledby={`${id}-t`} className="mt-3 max-w-xl">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${id}-e`} className="sr-only">
              Email address
            </label>
            <input
              id={`${id}-e`}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="h-11 min-w-0 flex-1 rounded-tile border border-line-strong bg-paper px-3 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
            />
            <input type="hidden" name="query" value={term} />
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
              {pending ? "Saving…" : "Tell me"}
            </button>
          </div>
          <p role="status" className={`mt-2 min-h-5 text-[13px] ${state ? "text-different" : "text-muted"}`}>
            {state?.message ?? (
              <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
                How we use your address
              </Link>
            )}
          </p>
        </form>
      )}
    </div>
  );
}
