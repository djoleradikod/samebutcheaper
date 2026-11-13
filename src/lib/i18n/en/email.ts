/**
 * Emails to subscribers (newsletter.ts, watches.ts, letter.ts, wanted-answer.ts, mail-layout.ts), in the language of the
 * page they signed up on (subscribers.lang). Every one keeps its List-Unsubscribe headers and goes only to confirmed
 * addresses, whatever the language.
 */
export const mailCommon = {
  unsubscribeAll: "Unsubscribe from everything",
  impressum: "Impressum (legal notice)",
};

export const mailConfirm = {
  heading: "Please confirm your email address",
  askedLetter: "to get new swaps from SameButCheaper",
  askedWatch: (title: string) => `to get an email from SameButCheaper if the swap “${title}” changes price or is withdrawn`,
  askedWish: (query: string) => `to get an email from SameButCheaper when we add a swap for “${query}”`,
  subjectLetter: "Confirm your email for SameButCheaper",
  subjectWatch: "Confirm your price watch on SameButCheaper",
  subjectWish: "Confirm your request on SameButCheaper",
  someone: (asked: string, host: string) => `Someone, hopefully you, asked ${asked} (${host}) at this address.`,
  openLink: "Open this link, then press the button on the page to confirm:",
  openPage: "Open the page below and press its button to confirm.",
  button: "Open the confirmation page",
  orPaste: "Or paste this link into your browser:",
  notYou: "If that wasn't you, ignore this email. You won't hear from us about it again, and the request is removed after 30 days.",
};

export const mailWatch = {
  why: "You get this because you asked us to email you if this swap changes. This watch only writes when a price moves 5% or more, the saving drops under 5%, or the swap is withdrawn.",
  stopThis: "Stop watching this swap",
  withdrawnSubject: "We've withdrawn a swap you watch",
  withdrawn: (title: string) => `We've taken “${title}” off SameButCheaper, so your watch on it has ended.`,
  noMore: "We won't email you about it again.",
  findAnother: "Find another swap",
  moved: (alt: string, up: boolean, pct: number, now: string, before: string) => `${alt} has gone ${up ? "up" : "down"} ${pct}%, to ${now} from ${before}.`,
  repriced: (alt: string, now: string) => `We've re-priced ${alt}: it is now ${now}.`,
  savingDropped: (brand: string, now: number, before: number) => `The saving against ${brand} is now ${now}%, under 5%, down from ${before}%.`,
  cheaperThan: (now: number, brand: string, before: number) => `It is ${now}% cheaper than ${brand} (was ${before}%).`,
  /** `month` is null when the record has no check date. */
  pricesAsOf: (month: string | null) => `Prices as we checked them in ${month ?? "our last check"}. Store prices can change between our checks.`,
  subjectDropped: "The saving on a swap you watch is now under 5%",
  subjectChange: (alt: string) => `Price change on a swap you watch: ${alt}`,
  seeSwap: "See the swap",
};

export const mailLetter = {
  newOnSite: "New on the site",
  bigSavings: "Big savings you haven't had from us yet",
  kits: "Kits, rebuilt for less",
  leadNone: "New swaps this week",
  leadPair: (alt: string, brand: string, pct: number) => `${alt} instead of ${brand}, ${pct}% less`,
  leadKit: (kit: string, pct: number) => `${kit}, ${pct}% less`,
  andMore: (n: number) => `, and ${n} more`,
  test: "[Test] ",
  priceNote: (currency: string | null) =>
    `Prices are as we last checked them at the store. Where a price reads “about”, we converted it to ${currency ?? "your currency"} at the ECB reference rate. Prices change between our checks: the store's own page has today's.`,
  why: "You get this because you asked for new swaps from SameButCheaper and confirmed your address. One email a week at most.",
  stopThis: "Unsubscribe from the weekly letter",
  intro: (total: number, hasKits: boolean) =>
    `${total} ${hasKits ? "swaps and kits" : total === 1 ? "swap" : "swaps"} you haven't had from us yet, each checked against at least two sources.`,
  heading: "This week's swaps",
  seeEvery: "See every swap",
  instead: (name: string) => `instead of ${name}`,
  facts: (match: string, pct: number, alt: string, brand: string, per: string) => `${match}. ${pct}% less: ${alt} against ${brand} ${per}.`,
  whatMatches: "What matches and what differs",
  rebuilt: (pieces: number, pct: number, same: string, kit: string) =>
    `Rebuilt from ${pieces} cheaper pieces for ${pct}% less: ${same} for the same amount, against ${kit} for the kit.`,
  seePieces: "See the pieces",
  /** The yearly line under a swap (mail-layout.ts yearlyNote). `often` is the frequency's words. */
  yearly: (brand: string, often: string, amount: string) => `If you buy a pack of ${brand} ${often}, that's ${amount} a year. Set how often you buy it on the swap's page.`,
};

export const mailWish = {
  subject: (query: string) => `We've added a swap for “${query}”`,
  intro: (query: string, n: number) => `You asked us to tell you when we added a swap for “${query}”. We have${n > 1 ? `, ${n} of them` : ""}:`,
  why: (query: string) =>
    `You get this because you asked us to email you when we added a swap for “${query}”, and confirmed your address. That request has now ended: this is the only email about it.`,
  seeAll: "See everything for this search",
  priceNote: "Prices are as we last checked them at the store. Prices change between our checks: the store's own page has today's.",
  preheader: (alt: string, brand: string) => `${alt} instead of ${brand}`,
};
