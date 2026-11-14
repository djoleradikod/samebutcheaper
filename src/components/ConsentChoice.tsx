"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { consentApplies, consentCookie, readConsent, type ConsentChoice as Choice } from "@/lib/consent-core";
import { countryOfPath } from "@/lib/country-url";

/** Fired by the footer's button (ConsentReopen) to show the choice again. */
const REOPEN = "sbc:consent-open";
/** Fired when a choice is made. */
const CHOSEN = "sbc:consent-change";

function subscribe(onChange: () => void) {
  window.addEventListener(CHOSEN, onChange);
  return () => window.removeEventListener(CHOSEN, onChange);
}

/** No choice yet, and the visitor is where consent applies (the page's country, else the country cookie). */
function needsAsking() {
  const cookieCountry = /(?:^|;\s*)sbc_country=([A-Z]{2})/.exec(document.cookie)?.[1];
  return !readConsent(document.cookie) && consentApplies(countryOfPath(location.pathname) ?? cookieCountry ?? null);
}

export type ConsentText = { heading: string; body: string; allow: string; decline: string; policy: string };

/**
 * The choice about store tracking that needs consent (src/lib/consent.ts). The root layout renders it only while a
 * programme asks for consent, so today it never shows. When it does: a panel fixed to the bottom of the window (it
 * moves nothing on the page), shown to visitors where consent applies until they choose. "Allow" and "Don't allow"
 * are the same size and style, side by side; closing it any other way is not a choice, so it stays until one is made.
 * Nothing is set before the choice. It doesn't take focus when it appears, only when reopened from the footer.
 */
export function ConsentChoice({ text, policyHref }: { text: ConsentText; policyHref: string }) {
  // Shown after the first paint, from what only the browser knows (a fixed panel, so nothing shifts).
  const unasked = useSyncExternalStore(subscribe, needsAsking, () => false);
  const [reopened, setReopened] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const open = unasked || reopened;

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);

  useEffect(() => {
    if (reopened) heading.current?.focus();
  }, [reopened]);

  if (!open) return null;
  const choose = (c: Choice) => {
    document.cookie = consentCookie(c, location.protocol === "https:");
    setReopened(false);
    window.dispatchEvent(new Event(CHOSEN));
  };
  return (
    <section aria-labelledby="consent-heading" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="container-page py-4">
        <h2 id="consent-heading" ref={heading} tabIndex={-1} className="text-base font-semibold outline-none focus-visible:underline">
          {text.heading}
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-2">
          {text.body}{" "}
          <a href={policyHref} className="text-cobalt underline underline-offset-2">
            {text.policy}
          </a>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:flex">
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => choose("yes")}>
            {text.allow}
          </button>
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => choose("no")}>
            {text.decline}
          </button>
        </div>
      </div>
    </section>
  );
}

/** The footer's way back to the choice. */
export function ConsentReopen({ label }: { label: string }) {
  return (
    <button type="button" className="inline-flex min-h-11 items-center hover:text-ink hover:underline md:min-h-0" onClick={() => window.dispatchEvent(new Event(REOPEN))}>
      {label}
    </button>
  );
}
