"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import Link from "@/components/CountryLink";
import { reportProblem, watchSwap, type FeedbackState } from "@/app/feedback-actions";
import { useLang, useT } from "@/lib/i18n/client";
import { feedback } from "@/lib/i18n/en/client/feedback";
import { newsletter } from "@/lib/i18n/en/client/newsletter";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { feedback, newsletter };

const KINDS = ["price", "stock", "product", "other"] as const;

/** The page's language, sent with each form so the answer reads in it. */
function LangField() {
  return <input type="hidden" name="lang" value={useLang()} />;
}
const NOTE_MAX = 300;

/**
 * The foot of a swap or kit page: "Email me if this changes" (swaps only) and a small "Something wrong?" form.
 * Both are plain forms posting to server actions, so they work with keyboard and screen reader alike.
 */
export function RecordFeedbackForms({ record, slug, note, watch = {} }: { record: "pair" | "bundle"; slug: string; note?: ReactNode; watch?: WatchLimits }) {
  const inner = (
    <>
      {note}
      <div className={`grid gap-4 ${record === "pair" ? "lg:grid-cols-2" : ""}`}>
        {record === "pair" && <WatchForm slug={slug} limits={watch} />}
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

/**
 * What a store's affiliate terms leave of the price watch (src/lib/watch-terms.ts), by store name: `barred` when the
 * cheaper product's price may not be watched (no watch), `brandBarred` when only the brand's may not (no saving).
 */
export type WatchLimits = { barred?: string; brandBarred?: string };

function WatchForm({ slug, limits }: { slug: string; limits: WatchLimits }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(watchSwap, null);
  const id = useId();
  const t = useT(TEXT);
  const lang = useLang();
  return (
    <section id="watch" aria-labelledby={`${id}-t`} className="scroll-mt-20 self-start rounded-card border border-line bg-paper p-4 md:p-5">
      <h2 id={`${id}-t`} className="text-base font-semibold">
        {t("feedback.watchHeading")}
      </h2>
      {limits.barred ? (
        <p className="mt-1 text-sm text-ink-2">{t("feedback.watchBarred", limits.barred)}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">{t("feedback.watchIntro")}</p>
          {limits.brandBarred && <p className="mt-1 text-sm text-ink-2">{t("feedback.watchBrandBarred", limits.brandBarred)}</p>}
        </>
      )}
      {limits.barred ? null : state?.ok ? (
        <Status state={state} />
      ) : (
        <form action={action} className="mt-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={`${id}-e`} className="sr-only">
              {t("feedback.email")}
            </label>
            <input
              id={`${id}-e`}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("newsletter.placeholder")}
              className="h-11 min-w-0 flex-1 rounded-tile border border-line-strong bg-paper px-3 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
            />
            <input type="hidden" name="slug" value={slug} />
            <LangField />
            <Honeypot />
            <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
              {pending ? t("feedback.saving") : t("feedback.watch")}
            </button>
          </div>
          <Status
            state={state}
            idle={t("feedback.watchIdle")}
          />
          <p className="text-[13px] text-muted">
            <Link href={lang === "de" ? "/datenschutz" : "/privacy"} className="inline-flex min-h-11 items-center underline underline-offset-2 md:min-h-0">
              {t("feedback.howWeUse")}
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
  const t = useT(TEXT);
  return (
    <details className="group self-start rounded-card border border-line bg-paper">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-ink-2 hover:text-ink md:px-5 [&::-webkit-details-marker]:hidden">
        <span>{t("feedback.somethingWrong")}</span>
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
            <LangField />
            <Honeypot />
            <fieldset>
              <legend className="text-sm font-semibold">{t("feedback.whatsWrong")}</legend>
              <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                {KINDS.map((k) => (
                  <label key={k} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
                    <input type="radio" name="kind" value={k} required className="h-4 w-4 accent-[var(--ink)]" />
                    {t(`feedback.kinds.${k}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${id}-n`} className="mt-2 block text-sm font-semibold">
              {t("feedback.anything")} <span className="font-normal text-muted">{t("feedback.optional")}</span>
            </label>
            <textarea
              id={`${id}-n`}
              name="note"
              rows={2}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={`${id}-c`}
              placeholder={t("feedback.placeholder")}
              className="mt-1 w-full rounded-tile border border-line-strong bg-paper px-3 py-2 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
            />
            <p id={`${id}-c`} className="num text-right text-xs text-muted">
              {note.length}/{NOTE_MAX}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
                {pending ? t("feedback.sending") : t("feedback.send")}
              </button>
              <p className="text-xs text-muted">{t("feedback.noAccount")}</p>
            </div>
            <Status state={state} />
          </form>
        )}
      </div>
    </details>
  );
}
