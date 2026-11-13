/** The search box and its results (SearchClient.tsx on /search). "{n}" and "{term}" are where rich() puts a node. */
export const pageSearch = {
  placeholder: "Brand, product or ingredient",
  label: "Search swaps by brand, product or ingredient",
  startTyping: "Start typing to search {n} swaps.",
  didntLoad: "Search didn't load. Check your connection, then",
  tryAgain: "try again",
  looking: "Looking through the swaps.",
  results: (n: number) => `${n} result${n === 1 ? "" : "s"}`,
  forTerm: (term: string) => `for “${term}”.`,
  notChecked: (term: string) => `We haven't checked a swap for “${term}” yet.`,
  tryBrand: "Try the brand name on its own, or check the spelling.",
  suggest: (term: string) => `Suggest “${term}”`,
  lookInto: "and we'll look into it.",
  showMore: (n: number) => `Show ${n} more`,
  showing: (shown: number, total: number) => `Showing ${shown} of ${total}`,
};
