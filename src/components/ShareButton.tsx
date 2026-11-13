"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Word of mouth is the cheapest marketing a savings site has: "this is the same as the one you buy, for half". Opens
 * the phone's share sheet, or copies the link where there's none. The link carries utm_source=share, so /admin can
 * count what shared links go on to earn.
 */
export function ShareButton({ path, text, className = "" }: { path: string; text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin);
    url.searchParams.set("utm_source", "share");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, text, url: url.toString() });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  }
  return (
    <button type="button" onClick={share} className={`btn btn-ghost ${className}`} aria-live="polite">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Link copied" : "Share this swap"}
    </button>
  );
}
