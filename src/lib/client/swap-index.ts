"use client";

import { SWAP_INDEX_URL, type SwapIndex } from "@/lib/browse";

let pending: Promise<SwapIndex> | null = null;

/** Fetches the index once per page view. A failed fetch can be tried again. */
export function loadSwapIndex() {
  pending ??= fetch(SWAP_INDEX_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Swap index: HTTP ${res.status}`);
      return res.json() as Promise<SwapIndex>;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
