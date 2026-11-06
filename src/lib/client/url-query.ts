"use client";

import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/**
 * The query string of the page at `path`. Empty on the server, so the page stays fully
 * prerendered and a shared link applies its filters straight after hydrating. The path check
 * ignores the old URL for the moment a link is still on its way to this page.
 */
export function useUrlQuery(path: string) {
  return useSyncExternalStore(
    subscribe,
    () => (window.location.pathname === path ? window.location.search : ""),
    () => "",
  );
}

/** Changes the query without a page load. Next.js keeps its router in step with these history calls. */
export function writeUrlQuery(path: string, query: URLSearchParams, mode: "push" | "replace") {
  const text = query.toString();
  const url = text ? `${path}?${text}` : path;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  for (const notify of listeners) notify();
}
