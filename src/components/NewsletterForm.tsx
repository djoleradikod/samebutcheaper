"use client";

import { useActionState } from "react";
import { subscribe, type FormState } from "@/app/actions";

export function NewsletterForm({ source = "site" }: { source?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribe, null);
  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`nl-${source}`} className="sr-only">
          Email address
        </label>
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11 flex-1 rounded-tile border border-line-strong bg-paper px-3 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
        />
        <input type="hidden" name="source" value={source} />
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? "Joining…" : "Get new swaps"}
        </button>
      </div>
      <p
        role="status"
        className={`mt-2 min-h-5 text-[13px] ${state ? (state.ok ? "text-same" : "text-different") : "text-muted"}`}
      >
        {state?.message ?? "One email when we've checked new swaps. Unsubscribe any time."}
      </p>
    </form>
  );
}
