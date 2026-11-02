"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A <details> based dropdown that closes when a link inside is clicked, when
 * clicking outside, or on Escape. Works without JS (falls back to <details>).
 */
export function Dropdown({
  summary,
  summaryClassName,
  className,
  summaryLabel,
  children,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  summaryLabel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDoc = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) el.open = false;
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details
      ref={ref}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a") && ref.current) ref.current.open = false;
      }}
    >
      <summary aria-label={summaryLabel} className={summaryClassName}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
