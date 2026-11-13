"use client";

import { useActionState } from "react";
import { subscribe, type FormState } from "@/app/actions";
import { useLang, useT } from "@/lib/i18n/client";
import { newsletter } from "@/lib/i18n/en/client/newsletter";

/** The English this component reads (src/lib/i18n/client-dict.ts). */
const TEXT = { newsletter };

export function NewsletterForm({ source = "site" }: { source?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribe, null);
  const lang = useLang();
  const t = useT(TEXT);
  return (
    <form action={action} className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`nl-${source}`} className="sr-only">
          {t("newsletter.emailLabel")}
        </label>
        <input
          id={`nl-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t("newsletter.placeholder")}
          className="h-11 flex-1 rounded-tile border border-line-strong bg-paper px-3 text-base placeholder:text-muted focus:border-cobalt focus:outline-none"
        />
        <input type="hidden" name="source" value={source} />
        {lang !== "en" && <input type="hidden" name="lang" value={lang} />}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? t("newsletter.joining") : t("newsletter.submit")}
        </button>
      </div>
      <p
        role="status"
        className={`mt-2 min-h-5 text-[13px] ${state ? (state.ok ? "text-same" : "text-different") : "text-muted"}`}
      >
        {state?.message ?? t("newsletter.note")}
      </p>
    </form>
  );
}
