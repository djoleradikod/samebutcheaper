/** My list (MyList.tsx). */
export const myList = {
  /** Offline, when the service worker serves the copy kept on the last visit. `kept` is its date, or null. */
  offline: (kept: string | null) => `You're offline. Prices from your last visit${kept ? `, ${kept}` : ""}. Check each price at the store before you buy.`,
};
