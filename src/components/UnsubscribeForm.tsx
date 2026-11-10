"use client";

import { useSearchParams } from "next/navigation";

/** The button behind the unsubscribe link. A plain form post, so it works without JavaScript once loaded. */
export function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return <p>This unsubscribe link is incomplete. Open the link from one of our emails again.</p>;
  }
  return (
    <form method="post" action={`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`}>
      <button type="submit" className="btn btn-primary">
        Unsubscribe me
      </button>
    </form>
  );
}
