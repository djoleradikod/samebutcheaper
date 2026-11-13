"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { reportProblem, watchSwap, type FeedbackState } from "@/app/feedback-actions";

const KINDS = [
  { value: "price", label: "Price changed" },
  { value: "stock", label: "Out of stock" },
  { value: "product", label: "Not the same product" },
  { value: "other", label: "Something else" },
] as const;
const NOTE_MAX = 300;

/**
 * The foot of a swap or kit page: "Email me if this changes" (swaps only) and a small "Something wrong?" form.
 * Both are plain forms posting to server actions, so they work with keyboard and screen reader alike.
 */
export function RecordFeedbackForms({ record, slug, note }: { record: "pair" | "bundle"; slug: string; note?: ReactNode }) {
  const inner = (
    <>
      {note}
      <div className={`grid gap-4 ${record === "pair" ? "lg:grid-cols-2" : ""}`}>
        {record === "pair" && <WatchForm slug={slug} />}
        <ReportForm record={record} slug={slug} />
      </div>
    </>
  );
  return record === "pair" ? <div className="container-page pb-8 md:pb-10">{inner}</div> : inner;
}

function Status({ state, idle }: { state: FeedbackState; idle?: string }) {
  return (
    <p role="status" className={`mt-2 min-h-5 text-[13px] ${state ? (state.ok ? "text-same" : "text-different") : "text-muted"}`}>
      {state?.message ?? idle ?? ""}
    </p>
  );
}

function Honeypot() {
  return <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />;
}

function WatchForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(watchSwap, null);
  const id = useId();
  return (
    <section aria-labelledby={`${id}-t`} className="self-start rounded-card border border-line bg-paper p-4 md:p-5">
      <h2 id={`${id}-t`} className="text-base font-semibold">
        Email me if this changes
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        One email when the cheaper product&apos;s price moves 5% or more, the saving drops under 5%, or we withdraw
        this swap. We ask you to confirm your address first.
      </p>
      {state?.ok ? (
        <Status state={state} />
      ) : (
        <form action={action} className="mt-3">
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
            <input type="hidden" name="slug" value={slug} />
            <Honeypot />
            <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
              {pending ? "Saving…" : "Watch this swap"}
            </button>
          </div>
          <Status
            state={state}
            idle="Only about this swap. Every email has a one-click stop link."
          />
          <p className="text-[13px] text-muted">
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              How we use your address
            </Link>
          </p>
        </form>
      )}
    </section>
  );
}

function ReportForm({ record, slug }: { record: "pair" | "bundle"; slug: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(reportProblem, null);
  const [note, setNote] = useState("");
  const id = useId();
  return (
    <details className="group self-start rounded-card border border-line bg-paper">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-ink-2 hover:text-ink md:px-5 [&::-webkit-details-marker]:hidden">
        <span>Something wrong on this page?</span>
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="border-t border-line px-4 pt-3 pb-4 md:px-5">
        {state?.ok ? (
          <Status state={state} />
        ) : (
          <form action={action}>
            <input type="hidden" name="record" value={record} />
            <input type="hidden" name="slug" value={slug} />
            <Honeypot />
            <fieldset>
              <legend className="text-sm font-semibold">What&apos;s wrong?</legend>
              <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <label key={k.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
                    <input type="radio" name="kind" value={k.value} required className="h-4 w-4 accent-[var(--ink)]" />
                    {k.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${id}-n`} className="mt-2 block text-sm font-semibold">
              Anything we should know? <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id={`${id}-n`}
              name="note"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={`${id}-c`}
              placeholder="For example the price you saw, and where"
              className="mt-1 w-full rounded-tile border border-line-strong bg-paper px-3 py-2 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
            />
            <p id={`${id}-c`} className="num text-right text-xs text-muted">
              {note.length}/{NOTE_MAX}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
                {pending ? "Sending…" : "Send"}
              </button>
              <p className="text-xs text-muted">No account or email needed. We never store your IP address.</p>
            </div>
            <Status state={state} />
          </form>
        )}
      </div>
    </details>
  );
}
