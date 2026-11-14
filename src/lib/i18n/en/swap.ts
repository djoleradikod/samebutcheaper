/**
 * The swap page's words, server side: the page itself, the same-or-different table, why it's the same, sources,
 * photo credits, price dates, buying in bulk and the questions. English, exactly as the pages had them inline.
 */
import { countryInSentence } from "../../markets";

const ADJECTIVE: Record<string, string> = { US: "US", GB: "UK", CA: "Canadian", DE: "German", IE: "Irish" };

export const swap = {
  home: "Home",
  breadcrumb: "Breadcrumb",
  title: (brand: string, alt: string) => `${brand} vs ${alt}`,
  notFound: "Swap not found",
  verdict: {
    identical_active: (brand: string) => `has the same active ingredient as ${brand}`,
    identical_formula: (brand: string) => `has the same formula as ${brand}`,
    same_manufacturer: (brand: string) => `comes from the same manufacturer as ${brand}`,
    equivalent_spec: (brand: string) => `does the same job as ${brand}`,
    same_kind: (brand: string) => `is the same kind of product as ${brand}`,
    line: (alt: string, what: string, pct: number, per: string) => `${alt} ${what} and costs ${pct}% less${per ? ` ${per}` : ""}.`,
  },
  sameLicence: (id: string) => `Same licensed medicine, ${id}`,
  share: (alt: string, brand: string, pct: number) => `${alt} does the same job as ${brand} for ${pct}% less.`,
  details: "Details",
  againstIt: "Against it: ",
  whatDiffers: "What differs",
  brandWinsOn: (list: string) => `the brand wins on ${list}.`,
  buyingWhereYouLive: "Buying where you live",
  thisStore: "This store",
  moreSwaps: (aisle: string) => `More ${aisle} swaps`,
  allCheaperMatches: (brand: string) => `All cheaper matches for ${brand}`,
  brandProducts: (n: number, brand: string) => `${n} ${brand} products with cheaper matches`,
  seeItOnline: "See it online",
  seeItAt: (atStore: string) => `See it ${atStore}`,
  seeBrandOnline: (brand: string) => `See ${brand} online`,
  seeItAtStore: (store: string) => `See it at ${store}`,
  seeBrandAt: (brand: string, atStore: string) => `See ${brand} ${atStore}`,
  seeIt: "See it",
  whereToBuy: "Where to buy",
  shelf: { cheaper: "The cheaper one", brand: "The brand" },
  offers: {
    label: "Prices and stores",
    product: "Product",
    store: "Store",
    price: "Price",
    pack: "Pack",
    unitPrice: "Unit price",
    link: "Link",
    biggerPack: "The bigger pack",
    elsewhere: (market: string) => `A ${ADJECTIVE[market]} store`,
  },
  sameAmount: {
    each: (unit: string, saved: string) => `Each ${unit} costs ${saved} less.`,
    once: (saved: string) => `You buy it once, so you save ${saved} once.`,
    pack: (saved: string) => `A pack this size costs ${saved} less.`,
    forSame: (pack: string, altCost: string, alt: string, brandCost: string, brand: string) =>
      `For the same ${pack} you pay about ${altCost} with ${alt} and ${brandCost} with ${brand}.`,
  },
  disclosure: {
    noneHereSomeBelow: "These two links don't earn us anything. A link further down this page may.",
    none: "We don't earn anything from these links.",
    both: "Affiliate links. We may earn a commission at no cost to you.",
    one: (store: string) => `The ${store} link is an affiliate link. We may earn a commission at no cost to you.`,
  },
  /** The word an earning link carries where a market's rules want the link itself marked. */
  adLabel: (market: string): string | undefined => (market === "DE" ? "Anzeige" : market === "GB" || market === "IE" ? "Ad" : undefined),
  ticket: (pct: number) => `${pct}% cheaper`,
  /** The band over a swap that another country's view shows (ShelfParts.tsx). */
  pricedAt: (market: string) => `We priced this one at ${ADJECTIVE[market]} stores.`,
  sameSwapAt: (market: string) => `See the same swap at ${ADJECTIVE[market]} prices`,
  notListed: (market: string, country: string) =>
    `We priced this at ${ADJECTIVE[market]} stores and couldn't confirm you can buy it in ${countryInSentence(country)}, so it isn't in our lists there.`,
};

export const compare = {
  verdicts: {
    same: "Same",
    about_same: "About the same",
    alt_better: "Cheaper one wins",
    brand_better: "Brand wins",
    different: "Differs",
    check: "Check the label",
    unknown: "Not on file",
    neutral: "",
  },
  heading: "Same or different?",
  counted: (same: number, of: number) => `${same} of ${of} the same.`,
  brandWins: (n: number) => ` Brand wins ${n}.`,
  showMore: (n: number) => `Show ${n} more`,
  showFewer: "Show fewer",
  continued: (label: string) => `${label}, continued`,
  everythingElse: "Everything else",
  whatWeCompared: "What we compared",
  what: "What",
  verdictColumn: "Verdict",
  source: "Source",
  sourceFor: (aspect: string) => `Source for ${aspect}`,
  showAll: "Show all",
  showLess: "Show less",
  from: "From",
  peopleEnter: ". People enter these records, so check the pack. Records:",
};

export const why = {
  headingSameKind: "What we know so far",
  heading: "Why the extra money buys little",
  whatWeChecked: "What we checked",
  worthKnowing: "Worth knowing: ",
  allFindings: "All our findings",
  acrossAisle: "Across this aisle",
  sources: (n: number) => `${n} source${n === 1 ? "" : "s"}`,
  readMore: (sources: string) => `Read more and see ${sources}`,
  see: (sources: string) => `See ${sources}`,
  evidenceStops: "Where the evidence stops: ",
  brandWinsHeading: "Where the brand wins, and what differs",
  brandWinsIntro: (alt: string) => `What ${alt} doesn't match, from the same records as the saving.`,
  /** "Source" beside a test result. */
  source: "Source",
  sourceFor: (aspect: string) => `Source for ${aspect}`,
};

export const evidence = {
  sources: "Sources",
  sourcesIntro: "What we checked. Look for yourself.",
  healthLead: "Read the label. ",
  /** On a medicine. German law wants its own notice there (Heilmittelwerbegesetz). */
  medicineLead: "Read the label. ",
  healthBody:
    "This compares labels and published evidence. It isn't medical advice. Inactive ingredients (fillers, dyes, flavours) can differ, which matters if you have allergies. Ask a pharmacist or doctor if you're unsure.",
  /** The same, where the page shows pet products. */
  healthBodyPet:
    "This compares labels and published evidence. It isn't veterinary advice. Inactive ingredients (fillers, dyes, flavours) can differ, which matters if your pet has allergies. Ask a vet or pharmacist if you're unsure.",
  photos: "Photos: ",
  by: "by",
  noPhotoOf: (names: string[]) => `No licensed photo of ${names.join(" or ")} yet.`,
  photoCredits: "Photo credits",
  whereItCameFrom: "Where it came from",
  adapted: "Adapted: cropped and placed on white.",
  noPhoto: "No licensed photo yet. The drawing is only a placeholder.",
  trademarks: "Pack designs and trademarks belong to their owners.",
  allCredits: "All photo credits",
  /** A photo credit as the image records write it, in the page's language. English keeps it as written. */
  credit: (credit: string) => credit,
};

export const prices = {
  checked: (day: string) => `Prices checked ${day}.`,
  checkedEach: (brand: string, brandDay: string, alt: string, altDay: string) => `${brand} price checked ${brandDay}, ${alt} ${altDay}.`,
  history: "Price history",
  ageing: "Checked over 3 months ago, so check the price at the store.",
  stale: "Checked over 6 months ago, so check the price at the store.",
  oldestChecked: "Oldest price checked",
  pricesChecked: "Prices checked",
  everyCheck: (amount: string) => `${amount} at every check`,
  lowHigh: (lo: string, hi: string) => `Low ${lo}, high ${hi}`,
  checksSince: (summary: string, n: number, first: string) => `${summary}, ${n} checks since ${first}`,
  pricesWeSaw: (name: string) => `${name}: prices we saw`,
  date: "Date",
  price: "Price",
  /** A side an affiliate feed last listed as out of stock (src/lib/stock-notes.ts). */
  outOfStock: (name: string, store: string, day: string) => `${name} was out of stock at ${store} when its product feed was read on ${day}.`,
};

export const bulk = {
  heading: "Buying in bulk",
  advice: {
    stock_up: "Worth stocking up on. It keeps for years.",
    buy_to_use: "Buy big only if you'll use it in time.",
    buy_small: "Buy small. It goes off or weakens.",
  },
  keeps: "How long it keeps",
  unopened: "Unopened",
  opened: "Once opened",
  storage: "Storage",
  fromRecord: (label: string) => `From our record for ${label}.`,
  paysAfter: (shown: string, pack: string) => `This pack pays for itself after ${shown} of ${pack}.`,
  atBrandPrice: (brand: string) => `At ${brand}'s unit price, `,
  buys: (shown: string, words: string) => ` buys ${shown} ${words}.`,
  restIsSaving: "Everything after that in this pack is the saving.",
  youPay: "You pay ",
  moreAtTill: (brand: string, times: string) => ` more at the till than for the ${brand} pack, for ${times} times as much.`,
  biggerPack: "The bigger pack",
  biggerLess: (pct: number, label: string, pack: string, vsBrand: number, brand: string) =>
    `${pct}% less ${label} than the ${pack} pack, and ${vsBrand}% less than ${brand}.`,
  biggerNoLess: (label: string, pack: string) => `It costs no less ${label} than the ${pack} pack.`,
  noShelfRecord: "We have no shelf-life record for this yet. Check the date on the pack before buying a lot.",
};

export const faq = {
  heading: "Questions",
  more: "More on this swap",
  allCheaperMatches: (brand: string) => `All cheaper matches for ${brand}`,
  every: (brand: string) => `Every ${brand} swap`,
  cheapest: (ingredient: string) => `Cheapest ${ingredient}`,
  aisle: (aisle: string) => `${aisle} aisle`,
  twin: (market: string) => `This swap at ${ADJECTIVE[market]} prices`,
  /** The questions and their answers' fixed words (src/lib/swap-faq.ts). */
  q: {
    same: (alt: string, brand: string) => `Is ${alt} the same as ${brand}?`,
    different: (alt: string) => `What is different about ${alt}?`,
    cheaper: (alt: string, brand: string) => `How much cheaper is ${alt} than ${brand}?`,
    buy: (alt: string) => `Where can I buy ${alt}?`,
  },
  confidenceHigh: " Both labels were confirmed from primary sources.",
  confidenceMedium: " The evidence is strong, but not every detail came from a primary source.",
  sameKind: (claim: string, subcategory: string) =>
    `We can't say they are. ${claim} (${subcategory}), priced from real sources. What we have doesn't show that they match on what's inside or how well they work.`,
  actives: (claim: string, actives: string) => `${claim}${actives ? `: ${actives}` : ""}.`,
  inactiveDiffer: " Inactive ingredients can differ, so read the label if you have allergies.",
  inactiveSame: " The labels list the same inactive ingredients too.",
  notSame: (claim: string) => `Not the same product, but ${claim}.`,
  matchOn: (list: string, more: number) => ` They match on ${list}${more > 0 ? ` and ${more} more points` : ""}.`,
  claimSentence: (claim: string) => `${claim}.`,
  brandWinsOn: (brand: string, list: string) => `${brand} wins on ${list}.`,
  noDifference: (alt: string, brand: string) => `Our records show no difference between ${alt} and ${brand} beyond the pack and the price.`,
  differencesOnPage: "The differences on file are on this page, with the prices in your currency.",
  when: (market: string, month: string) => `at the ${ADJECTIVE[market]} prices we checked in ${month}`,
  old: " Those prices are over a year old, so check before you buy.",
  cheaperPlain: (alt: string, pct: number, per: string, brand: string, when: string) => `${alt} costs ${pct}% less${per ? ` ${per}` : ""} than ${brand}, ${when}.`,
  cheaperLocal: (alt: string, altUnit: string, per: string, brandUnit: string, brand: string, pct: number, when: string) =>
    `${alt} costs ${altUnit}${per ? ` ${per}` : ""} against ${brandUnit} for ${brand}, ${pct}% less, ${when}.`,
  section: `"Buying where you live" on this page lists stores to search where you are.`,
  checkedAtA: (market: string, month: string) => `We checked the price at a ${ADJECTIVE[market]} store in ${month}.`,
  checkedAt: (store: string, month: string) => `We checked the price at ${store} in ${month}.`,
  mayShip: (store: string, country: string) => ` ${store} may ship it to ${countryInSentence(country)}, so check at checkout.`,
  pricesChange: " Prices change, so check at the store before you buy.",
  noDelivery: (market: string, country: string, query: string) =>
    `We checked the price at a ${ADJECTIVE[market]} store that doesn't deliver to ${countryInSentence(country)}. Look for "${query}" at stores there.`,
  pharmacy: (country: string): string | null =>
    country === "DE" || country === "AT" || country === "CH" ? "Most medicines there are sold only by pharmacies (Apotheke), including online pharmacies." : null,
};

/** A swap's title and description for search results (src/lib/seo.ts). */
export const seo = {
  vs: (brand: string, alt: string) => `${brand} vs ${alt}`,
  cheaper: (pct: number) => `${pct}% cheaper`,
  marketPrices: (market: string) => `${ADJECTIVE[market]} prices`,
  question: (alt: string, brand: string) => `Is ${alt} the same as ${brand}?`,
  costsLess: (pct: number, per: string, market: string, month: string) =>
    `costs ${pct}% less${per ? ` ${per}` : ""} at ${ADJECTIVE[market]} prices checked ${month}`,
  lead: (claim: string, actives: string, price: string) => `${claim}${actives ? ` (${actives})` : ""} and ${price}.`,
  sameKindLead: (claim: string, pct: number, per: string, market: string) =>
    `${claim} and costs ${pct}% less${per ? ` ${per}` : ""} at ${ADJECTIVE[market]} prices, but our records don't show they match inside.`,
  more: "What differs, the sources, and where to buy.",
  /** Where a store's affiliate terms withhold the prices (src/lib/programme-terms.ts): the claim with no saving. */
  leadNoPrice: (claim: string, actives: string) => `${claim}${actives ? ` (${actives})` : ""}.`,
  sameKindNoPrice: (claim: string) => `${claim}, but our records don't show they match inside.`,
};

/** What the feedback forms' server actions answer (src/app/feedback-actions.ts). */
export const actions = {
  tooMany: "That's a lot of tries in a short time. Please wait a few minutes.",
  thanksReport: "Thank you. We'll check it against the store and fix the page if it's wrong.",
  pickKind: "Pick what's wrong first.",
  noRecord: "We couldn't find this page's record.",
  reportsClosed: "Reports aren't open yet. Please try again later.",
  wrong: "Something went wrong. Please try again.",
  almostThere: (what: string) => `Almost there. We've sent you an email: click the link in it to ${what}. Nothing else is sent until you do.`,
  saved: "Saved. We'll email you once to confirm before we send anything.",
  thanks: "Thanks.",
  validEmail: "Please enter a valid email address.",
  noSwap: "We couldn't find this swap.",
  watchesClosed: "Price watches aren't open yet. Please check back soon.",
  watchBarred: "This store's affiliate terms don't allow price alerts, so this swap can't be watched.",
  startWatching: "start watching this swap",
  searchFirst: "Search for a product name first.",
  notOpen: "This isn't open yet. Please check back soon.",
  confirm: "confirm",
  /** The shoppers' reports note on a swap or kit page (src/components/RecordFeedback.tsx). */
  reportedOut: "Shoppers report this is out of stock at the store. We're re-checking.",
  reportedEither: "Shoppers report this price has changed or is out of stock. We're re-checking.",
  reportedPrice: "Shoppers report this price has changed. We're re-checking.",
  reportedBy: "Reported by shoppers: ",
  untilWe: "Until we have, check the price and stock on the store's own page before you buy.",
};

/** Versions of a page in other countries, and the note on record text that has no German yet. */
export const record = {
  pricesByCountry: "Prices by country",
  pricesByCountryColon: "Prices by country:",
  inEnglish: "",
};

/**
 * The words compare.ts writes into the same-or-different table, exactly as it writes them. A German page finds each one
 * here by its English text and shows the German entry (src/lib/i18n/compare-de.ts).
 */
export const rows = {
  words: {
    activeIngredients: "Active ingredients",
    specs: "Specs",
    fullFormula: "Full formula",
    sameIngredientList: "Same ingredient list",
    sameIngredientListOrder: "Same ingredient list, same order",
    inactiveIngredients: "Inactive ingredients",
    sameListPerLabel: "Same list per the label",
    canDiffer: "Can differ. Read the label if you have allergies",
    whoMakesIt: "Who makes it",
    sameMaker: "Same maker",
    sameMakerSources: "Same maker (see sources)",
    pack: "Pack",
    licenceNumber: "Licence number",
    notRecorded: "Not recorded",
    shopperRating: "Shopper rating",
    notComparedHere: "Not compared here",
    noRating: "No rating found yet",
    notListed: "Not listed",
    yes: "Yes",
    energy: "Energy",
    fat: "Fat",
    saturates: "Saturates",
    sugars: "Sugars",
    salt: "Salt",
    protein: "Protein",
    fibre: "Fibre",
    ingredients: "Ingredients",
    aboutTheSame: "About the same",
    sameList: "Same list",
    wordedDifferently: "Records worded differently, check the pack",
    listsDiffer: "Lists differ",
    lowerGradesBetter: "Lower grades are better",
  },
  /** What "inactive ingredients" means for each kind of product, as compare.ts has it. */
  inactive: {
    "otc-medicine": "fillers, coating, dyes and flavour",
    supplements: "fillers, capsule, coating and flavour",
    "skincare-personal-care": "base, fragrance and preservatives",
    "beauty-hair": "base, fragrance and preservatives",
    household: "fragrance, dyes and stabilisers",
    baby: "base, flavour and preservatives",
    pet: "other ingredients and flavour",
    "food-pantry": "other ingredients",
    other: "other ingredients",
  } as Record<string, string>,
  per100: { "per 100 ml": "per 100 ml", "per 100 g": "per 100 g", "per 100 g or 100 ml": "per 100 g or 100 ml" } as Record<string, string>,
  /** German test grades in words, as the records write them. */
  grades: { "very good": "very good", good: "good", satisfactory: "satisfactory", sufficient: "sufficient", poor: "poor" } as Record<string, string>,
  /** A rating as rating.ts writes it: "4.4 of 5", "grade 1.5", "4.4 of 5 from 1,253 ratings". */
  rating: {
    outOf: (score: string, of: number) => `${score} of ${of}`,
    grade: (score: string) => `grade ${score}`,
    fromRatings: (score: string, count: string) => `${score} from ${count} ratings`,
  },
  /** The same words on a medicine, where the leaflet is what to read. */
  canDifferMedicine: "Can differ. Read the label if you have allergies",
  ownWords: (words: string) => `Its own ${words}`,
  higher: (name: string) => `${name} higher`,
  score: (publisher: string) => `${publisher} score`,
  pricePer: (label: string) => `Price ${label}`,
  less: (value: string, pct: number) => `${value} (${pct}% less)`,
  people: (when: string, n: string) => `${when}, ${n} people`,
  caption: (per: string, nutrition: boolean) => (nutrition ? `Nutrition ${per}, and ingredients` : "Ingredients"),
  intro: {
    nothingInside:
      "Beyond the pack size and the unit price, our records only have details the other side doesn't state. Nothing here compares what's inside.",
    onlyPack: "All we have on file for this swap is the pack size and the unit price. Nothing here compares what's inside.",
    onFile: (list: string) => `On file for this swap: ${list}, pack size and unit price.`,
    test: (name: string) => `the ${name} result`,
    tests: (n: number) => `${n} test results`,
    nutrition: "nutrition and ingredients from community records",
    communityIngredients: "ingredients from community records",
    ingredientList: "the ingredient list",
    maker: "who makes it",
    others: (n: number) => `${n} other ${n === 1 ? "point" : "points"}`,
    licences: "licence numbers",
    ratings: "ratings",
  },
};

/**
 * What a page says where an affiliate programme's own terms don't let us show a price (src/lib/programme-terms.ts):
 * the store, the day we last checked, and why there's no figure.
 */
export const terms = {
  seePrice: (store: string) => `See the price at ${store}`,
  lastChecked: (date: string) => `Last checked by us: ${date}`,
  why: (stores: string) =>
    `${stores} lets its affiliates show only prices it supplies and keeps current, so this page shows no price or saving for it. Compare the price per unit at the store.`,
  /** The verdict without a saving. */
  verdict: (alt: string, what: string) => `${alt} ${what}.`,
  share: (alt: string, brand: string) => `${alt} instead of ${brand}: what matches and what differs`,
  /** The notice a programme wants beside a price we do show for it. */
  notice: {
    "store-price-applies": (store: string) => `If the price at ${store} differs, ${store}'s price applies.`,
    "as-of-time": () => "Product prices and availability are accurate as of the date/time indicated and are subject to change.",
  },
  /** Beside each earning link of a programme that wants each link labelled. */
  paidLink: "Paid link",
  theKit: "The brand's kit",
  thePieces: "The cheaper pieces",
  replaces: (item: string) => `In place of: ${item}`,
  insteadOf: (brand: string) => `instead of ${brand}`,
  kit: (stores: string) =>
    `${stores} lets its affiliates show only prices it supplies and keeps current, so this kit shows no prices or totals. Each piece links to its store.`,
  basket: (stores: string) =>
    `${stores} lets its affiliates show only prices it supplies and keeps current, so this basket shows no totals. Each line links to its swap.`,
  /** The same, naming no store, for text every country's view shares. */
  whyPlain: "The store lets its affiliates show only prices it supplies and keeps current, so this page shows no price or saving for it. Compare the price per unit at the store.",
};
