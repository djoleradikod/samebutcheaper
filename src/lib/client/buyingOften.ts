"use client";

import { useSyncExternalStore } from "react";
import { NO_CHOICES, parseChoices, withChoice, type FrequencyId, type OftenChoices } from "@/lib/yearly";

/** How often the shopper buys each swap's brand pack, kept in this browser only. See src/lib/yearly.ts. */
const KEY = "sbc:how-often";
const EVENT = "sbc:how-often-change";

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Choices made while storage is blocked still apply for the rest of the visit. */
let memory: OftenChoices | null = null;

let cache: { raw: string | null; value: OftenChoices } = { raw: null, value: NO_CHOICES };
function snapshot(): OftenChoices {
  if (memory) return memory;
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parseChoices(raw) };
  return cache.value;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** The server and the first render see no choices, so both render the stated assumption and nothing mismatches. */
export function useBuyingOften(): OftenChoices {
  return useSyncExternalStore(subscribe, snapshot, () => NO_CHOICES);
}

export function setBuyingOften(slug: string, often: FrequencyId) {
  const next = withChoice(snapshot(), slug, often);
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(KEY, raw);
    memory = null;
  } catch {
    memory = next;
  }
  window.dispatchEvent(new Event(EVENT));
}
