/** Search results (SearchClient.tsx). */
export const search = {
  /** Matches this shopper's lists leave out because they're priced in other countries. `more`: after some that are listed. */
  elsewhere: (n: number, term: string, more: boolean) => `${n} ${more ? "more " : ""}for “${term}” ${n === 1 ? "is" : "are"} priced in other countries.`,
  showOthers: "Show swaps from other countries",
};
