/** The shopping-list check (ShoppingCheck.tsx on /check/list). "{amount}" and the like are where rich() puts a node. */
export const pageShoppingCheck = {
  emptyList: "Paste a list or a receipt first.",
  checking: "Checking your list against the catalogue…",
  failed: "That didn't work. Try again in a moment.",
  unreachable: "We couldn't reach the site. Check your connection and try again.",
  reading: "Reading your receipt…",
  unreadable: "We couldn't read that photo. Try typing the list instead.",
  photoWrong: "Something went wrong with that photo. Try again, or type the list.",
  label: "Your shopping list or receipt",
  help: "One item per line, as you'd write it or as the till printed it. Prices, totals and loyalty lines are skipped.",
  submit: "Check my shopping",
  readPhoto: "Read a receipt photo",
  tryExample: "Try an example",
  privacy: (photo: boolean) =>
    `We read your list${photo ? " or photo" : ""} only to match it and don't keep it; we count just the names of products we have no swap for, never prices, so we know what to research next.`,
  hiddenShared: (n: number) =>
    `${n === 1 ? "One swap" : `${n} swaps`} on the shared list ${n === 1 ? "isn't" : "aren't"} sold where you are, so ${n === 1 ? "it's" : "they're"} left out.`,
  keepHeading: "What you'd keep",
  /** `often` is the frequency's words, as the yearly section has them. */
  assumes: (assumed: number, total: number, often: string): string => {
    const which =
      assumed === total
        ? total === 1
          ? "This assumes you buy the brand-name pack"
          : "This assumes you buy each brand-name pack"
        : `For ${assumed} of the ${total} swaps, this assumes you buy the brand-name pack`;
    return `${which} ${often}. We can't know, so set how often below.`;
  },
  chosen: "At how often you said you buy each brand-name pack, at the dated prices on each swap page.",
  plusOnce: (amount: string, n: number) => `Plus ${amount} once, from ${n === 1 ? "a thing you buy once" : `${n} things you buy once`}.`,
  perAmount: (n: number) =>
    `${n === 1 ? "One swap is" : `${n} swaps are`} priced per wash or per amount, with no pack to count, so ${n === 1 ? "it isn't" : "they aren't"} in it.`,
  switchingThese: (n: number) => `Switching ${n === 1 ? "this" : `these ${n}`} would keep`,
  switching: "Switching would keep",
  perYear: (amount: string) => `${amount} a year`,
  onceAmount: (amount: string) => `${amount} once`,
  checkSuggestions: "Check the suggestions below to see what you'd keep.",
  nothingFound: "We didn't find anything on your list with a cheaper swap on file yet.",
  savedSee: "Saved. See my list",
  saveAll: "Save all to my list",
  linkCopied: "Link copied",
  copyLink: "Copy a link to this result",
  print: "Print",
  copyThis: "Copy this link:",
  linkHolds: "The link holds only the swaps and how often you buy each, not your list.",
  swapsFor: (n: number) => `${n === 1 ? "One swap" : `${n} swaps`} for what you buy`,
  didYouMean: "Did you mean?",
  didYouMeanNote: "These lines name a brand we have, but we can't tell which product. Say yes only if it's what you buy.",
  couldBe: (to: string) => `could be ${to}, {amount} less a pack`,
  yesIBuy: (product: string) => `Yes, I buy ${product}`,
  yesThatsIt: "Yes, that's it",
  notThis: (product: string) => `No, not ${product}`,
  no: "No",
  nothingCheaper: "Nothing cheaper on file yet",
  // "Which one" (ChooseOne.tsx): a line that names only a brand with several products on file.
  chooseTitle: "Which one do you buy?",
  chooseNote: "These lines name a brand we have more than one product of, and nothing on the line tells them apart. Pick yours, and we'll count only that one.",
  chooseFits: (line: string) => `Products that fit ${line}`,
  chooseIBuy: (product: string) => `I buy ${product}`,
  chooseThis: "This one",
  chooseNone: "None of these",
  countNote: (example: string) =>
    `We count the products we had nothing for by their cleaned name alone, such as “${example}”, so the most asked-for get researched first. `,
  wantSooner: "Want one sooner?",
  suggestIt: "Suggest it",
  own: (n: number) => `${n === 1 ? "One line is" : `${n} lines are`} already a store brand or a cheaper pick we list.`,
  skipped: (n: number) => `We skipped ${n === 1 ? "one line" : `${n} lines`} that weren't products, such as totals, payments and loyalty points.`,
  lessPer: (pack: string | null, pct: number) => `{amount} less per ${pack ?? "pack"}, ${Math.round(pct)}% cheaper`,
  moreOptions: (n: number) => (n === 1 ? "1 more option" : `${n} more options`),
  youBuyIt: "You buy it",
  howOften: (product: string) => `How often you buy ${product}`,
  assumed: "Assumed",
  noYearly: (per: string | null) => `Priced ${per ?? "per amount"}, no yearly figure`,
  aYear: "a year",
  once: "once",
};
