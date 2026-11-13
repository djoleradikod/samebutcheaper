"use client";

import { useSearchParams } from "next/navigation";

const ONLY: Record<string, string> = { letter: "Stop the weekly letter", watch: "Stop watching this swap", wish: "Stop this request" };

/**
 * The buttons behind an unsubscribe link. Plain form posts, so they work without JavaScript once loaded. A link
 * from a weekly letter or a price watch offers to stop just that, or everything.
 */
export function UnsubscribeForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const only = params.get("only") ?? "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return <p>This unsubscribe link is incomplete. Open the link from one of our emails again.</p>;
  }
  const base = `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
  const scoped = /^(letter|watch-\d{1,9}|wish-\d{1,9})$/.test(only) ? only : null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {scoped && (
        <form method="post" action={`${base}&only=${scoped}`}>
          <button type="submit" className="btn btn-primary w-full sm:w-auto">
            {ONLY[scoped.split("-")[0]]}
          </button>
        </form>
      )}
      <form method="post" action={base}>
        <button type="submit" className={`btn ${scoped ? "btn-ghost" : "btn-primary"} w-full sm:w-auto`}>
          {scoped ? "Unsubscribe from everything" : "Unsubscribe me"}
        </button>
      </form>
    </div>
  );
}
