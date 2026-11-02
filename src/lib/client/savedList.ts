"use client";

import { useSyncExternalStore } from "react";

const KEY = "sbc:saved";
const EVENT = "sbc:saved-change";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let cache: { raw: string | null; value: string[] } = { raw: null, value: [] };
function snapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  if (raw !== cache.raw) cache = { raw, value: read() };
  return cache.value;
}

const EMPTY: string[] = [];

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useSavedList(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function setSavedList(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(list))));
  } catch {
    /* storage blocked: nothing we can do */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function toggleSaved(slug: string) {
  const list = snapshot();
  setSavedList(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
}
