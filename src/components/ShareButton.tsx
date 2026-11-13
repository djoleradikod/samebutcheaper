"use client";

import { useContext, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { COUNTRY_COOKIE, CountryContext, FixedContext } from "@/lib/client/country";
import { shareTarget } from "@/lib/shopper-links";

function cookieCountry() {
  try {
    return new RegExp(`(?:^|; )${COUNTRY_COOKIE}=([A-Z]{2})`).exec(document.cookie)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Word of mouth is the cheapest marketing a savings site has: "this is the same as the one you buy, for half". Opens
 * the phone's share sheet, or copies the link where there's none. The link carries utm_source=share, so /admin can
 * count what shared links go on to earn.
 *
 * It shares the page's country URL (/de/compare/x): the sharer's country's version when that country lists the record,
 * else the record's canonical one. `versions` maps a country to its URL and `canonical` is the fallback, both from the
 * record's hreflang set, so a shared link is always an indexable page in the currency the sharer was looking at.
 */
export function ShareButton({
  versions,
  canonical,
  text,
  className = "",
}: {
  versions: Partial<Record<string, string>>;
  canonical: string;
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const fixed = useContext(FixedContext);
  const pageCountry = useContext(CountryContext);
  async function share() {
    const country = fixed && pageCountry ? pageCountry : cookieCountry();
    const url = new URL(shareTarget(versions, canonical, country), window.location.origin);
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
