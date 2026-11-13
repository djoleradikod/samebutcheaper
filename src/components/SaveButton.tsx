"use client";

import Link from "@/components/CountryLink";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleSaved, useSavedList } from "@/lib/client/savedList";

export function SaveButton({ slug, className = "" }: { slug: string; className?: string }) {
  const list = useSavedList();
  const saved = list.includes(slug);
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => toggleSaved(slug)}
        aria-pressed={saved}
        className={`btn w-full ${saved ? "border border-cobalt bg-cobalt-soft text-cobalt-strong" : "btn-ghost"}`}
      >
        {saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
        {saved ? "On my list" : "Save to my list"}
      </button>
      {saved && (
        <Link
          href="/my-list"
          className="inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium text-cobalt underline underline-offset-2"
        >
          View
        </Link>
      )}
    </div>
  );
}

export function SavedCount() {
  const list = useSavedList();
  if (!list.length) return null;
  return (
    <span className="num ml-1 inline-grid h-5 min-w-5 place-items-center rounded-tile bg-accent px-1 text-[11px] font-semibold text-accent-ink">
      {list.length}
    </span>
  );
}
