/** My list's totals and lines (MyList.tsx). "{button}" is where rich() puts the button's name. */
export const pageMyList = {
  nothingSaved: "Nothing saved yet. Press {button} on a swap or kit, or save a whole basket, and this page adds up what switching saves.",
  addButton: "Add to my savings list",
  seeBaskets: "See the baskets",
  seeBiggest: "See the biggest savings",
  kit: "Kit: ",
  youBuyIt: "You buy it",
  howOften: (from: string) => `How often you buy ${from}`,
  assumed: "Assumed",
  remove: (from: string) => `Remove ${from} from my list`,
  restocking: (n: number) => `Restocking ${n === 1 ? "this one" : `all ${n}`} once`,
  saveAmount: (amount: string) => `Save ${amount}`,
  perPackNote: "Per brand-name pack for a swap and per kit for a kit, at the dated prices on each page.",
  saveThese: "Save these to my list",
  linkCopied: "Link copied",
  copyList: "Copy a link to this list",
  staysHere: "Your list and how often you buy each thing stay in this browser. We don't store them.",
  yearLess: (pct: number) => `a year, ${Math.round(pct)}% less`,
  onceLess: (pct: number) => `once, ${Math.round(pct)}% less`,
  perLess: (per: string, pct: number) => `${per}, ${Math.round(pct)}% less`,
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
  chosen: "At how often you said you buy each brand-name pack, at the dated prices on each page.",
  plusOnce: (amount: string, kits: number, things: number) => {
    const parts = [
      kits ? (kits === 1 ? "a kit" : `${kits} kits`) : null,
      things ? (things === 1 ? "a thing you buy once" : `${things} things you buy once`) : null,
    ].filter(Boolean);
    return `Plus ${amount} once, from ${parts.join(" and ")}.`;
  },
  perAmount: (n: number) =>
    `${n === 1 ? "One swap is" : `${n} swaps are`} priced per wash or per amount, with no pack to count, so ${n === 1 ? "it isn't" : "they aren't"} in it.`,
  listSaves: "Your list saves",
  perYear: (amount: string) => `${amount} a year`,
  onceAmount: (amount: string) => `${amount} once`,
  nothingToCount: "Nothing on your list has a pack to count over a year.",
};
