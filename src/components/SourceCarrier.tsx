"use client";

import { useEffect } from "react";
import { trafficSource, withSource } from "@/lib/traffic-source";

/** Worked out once per page load, then kept in memory while the visitor moves through the site. Never stored. */
let source: string | null | undefined;

/**
 * Carries the first-touch source (src/lib/traffic-source.ts) to the store link the visitor follows, without a cookie
 * or any other storage: when a link to /go or /out is about to be followed (pointer down, focus for the keyboard, or
 * the click itself), its address gets `src=<source>`. Renders nothing.
 */
export function SourceCarrier() {
  useEffect(() => {
    if (source === undefined) source = trafficSource(new URLSearchParams(location.search), document.referrer || null, location.host);
    if (!source) return;
    const mark = (e: Event) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      const next = withSource(a.href, source ?? null, location.origin);
      if (next !== a.href) a.href = next;
    };
    const opts = { capture: true, passive: true } as const;
    for (const type of ["pointerdown", "focusin", "click"]) document.addEventListener(type, mark, opts);
    return () => {
      for (const type of ["pointerdown", "focusin", "click"]) document.removeEventListener(type, mark, opts);
    };
  }, []);
  return null;
}
