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
          className="h-12 flex-1 rounded-xl border border-line-strong bg-surface px-4 text-base placeholder:text-muted focus:border-accent focus:outline-none"
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
        <button type="submit" disabled={pending} className="btn btn-primary h-12 disabled:opacity-60">
          {pending ? "Joining…" : "Get new swaps"}
        </button>
      </div>
      <p
        role="status"
        className={`mt-2 min-h-5 text-sm ${state ? (state.ok ? "text-accent" : "text-warn") : "text-muted"}`}
      >
        {state?.message ?? "One email when we verify new swaps. No spam, unsubscribe anytime."}
      </p>
    </form>
  );
}
