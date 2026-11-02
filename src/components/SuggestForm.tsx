"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { suggestSwap, type FormState } from "@/app/actions";

const field =
  "mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none";

export function SuggestForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState<FormState, FormData>(suggestSwap, null);

  if (state?.ok) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-accent">{state.message}</p>
        <a href="/suggest" className="btn btn-ghost mt-6">Suggest another</a>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5 p-6 sm:p-8">
      <div>
        <label htmlFor="brandProduct" className="text-sm font-medium">
          Brand-name product <span className="text-warn">*</span>
        </label>
        <input
          id="brandProduct"
          name="brandProduct"
          required
          defaultValue={params.get("brand") ?? ""}
          placeholder="e.g. Rogaine Men's 5% Minoxidil Foam"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="alternativeProduct" className="text-sm font-medium">
          The cheaper alternative <span className="text-muted">(if you know one)</span>
        </label>
        <input id="alternativeProduct" name="alternativeProduct" placeholder="e.g. Kirkland Minoxidil Foam" className={field} />
      </div>
      <div>
        <label htmlFor="reason" className="text-sm font-medium">
          Why do you think they&apos;re the same?
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          placeholder="Same active ingredient, same manufacturer, matching ingredient list…"
          className={field}
        />
      </div>
      <div>
        <label htmlFor="evidenceUrl" className="text-sm font-medium">
          Link to evidence <span className="text-muted">(optional)</span>
        </label>
        <input id="evidenceUrl" name="evidenceUrl" type="url" placeholder="https://" className={field} />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Your email <span className="text-muted">(optional, so we can tell you when it&apos;s live)</span>
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={field} />
      </div>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3.5 disabled:opacity-60">
        {pending ? "Sending…" : "Send suggestion"}
      </button>
    </form>
  );
}
