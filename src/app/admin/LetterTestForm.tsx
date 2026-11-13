"use client";

import { useActionState } from "react";
import { sendTestLetter, type TestState } from "./actions";

/** "Send a test to me": this week's letter, to the admin, as a new reader in the chosen country would get it. */
export function LetterTestForm({ defaultEmail, countries }: { defaultEmail: string; countries: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState<TestState, FormData>(sendTestLetter, null);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Your email</span>
        <input
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          className="h-9 w-64 rounded border border-line-strong bg-paper px-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">As a reader in</span>
        <select name="country" defaultValue="DE" className="h-9 rounded border border-line-strong bg-paper px-2">
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="h-9 rounded border border-line-strong px-3 font-medium text-ink disabled:opacity-60">
        {pending ? "Sending…" : "Send a test to me"}
      </button>
      <p role="status" className={`w-full text-[13px] ${state ? (state.ok ? "text-same" : "text-different") : "text-muted"}`}>
        {state?.message ?? ""}
      </p>
    </form>
  );
}
