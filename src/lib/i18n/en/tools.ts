/** The tools' server parts: /check, /check/list, /my-list and /search (their pages and ProductReport.tsx). */
import type { LookupProduct } from "../../lookup/types";

export const checkPage = {
  metaTitle: "Check any product: ingredients, uses and cheaper swaps",
  metaDescription:
    "Search a product name, scan its barcode or snap the label. See what's in it, what it's for, and cheaper products that deliver to your country, with what each one matches on.",
  eyebrow: "Product check",
  h1: "What's in it, what it's for, and what costs less",
  intro:
    "Type a product, scan its barcode or snap the label. We read the official label data and show cheaper products from stores that deliver where you live, with what each one matches on.",
  listLink: "Got a whole shopping list or a receipt? Check it all at once",
  tooMany: "That's a lot of checks in a short time.",
  tooManyBody: "Give it a minute, then try again.",
  inDatabases: "The same product in label databases",
  inCatalogue: "Swaps already in our catalogue",
  pick: "Pick your product to see what's in it",
  resultsFor: (q: string) => `Results for “${q}” from public label databases.`,
  failed: (sources: string) => `Some databases didn't answer just now (${sources}). Try again in a minute for more results.`,
  thatProduct: "that product",
  barcode: (digits: string) => `barcode ${digits}`,
  quoted: (q: string) => `“${q}”`,
  invalid: (what: string) => `${what} isn't a valid barcode number.`,
  notFound: (what: string) => `We couldn't find ${what}.`,
  checkDigits: "Check the digits under the barcode, or search by the product's name.",
  notInDatabases: "It isn't in the open label databases yet. Search by the product's name instead, or snap the label so we can read it.",
  tryName: "Try the brand and product name as printed on the pack, for example “Advil 200 mg” or “CeraVe moisturizing cream”.",
  tellUs: "Tell us what you were looking for",
  wellResearch: "and we'll research it.",
  steps: (): { title: string; text: string }[] => [
    { title: "Search, scan or snap", text: "Type the name, scan the barcode, or photograph the label. Barcodes are read on your phone." },
    { title: "We read the official label", text: "FDA drug labels, the NIH supplement label database, and the open beauty and food databases." },
    { title: "See what's really in it", text: "Active ingredients and strengths, what it's for, how to use it and the main warnings." },
    {
      title: "Find what costs less",
      text: "Swaps from our catalogue, store brands with the same active ingredients on the label, and stores that deliver to your country.",
    },
  ],
  tryOne: "Try one:",
  onPhone: "On a phone, “Scan a barcode” opens your camera.",
  checking: "Checking the label databases",
  yourProduct: "Your product",
};

export const checkList = {
  metaTitle: "Check your shopping: what switching would keep a year",
  metaDescription:
    "Paste a shopping list or a receipt. See which of the brands you buy have a cheaper product that does the same job, and what switching keeps in a year.",
  crumb: "Product check",
  here: "/ Your shopping",
  h1: "Paste your shopping list. See what you'd keep a year.",
  intro:
    "Paste a list or the text of a receipt. We match each brand to a cheaper product that does the same job, from stores that sell where you live, and add up what switching keeps. When we can't tell which product a line means, we ask.",
};

/** The shopping-list check's two routes (src/app/check/list/match and photo), answering in the page's language. */
export const listErrors = {
  browser: "This works in a browser.",
  tooMany: "That's a lot of lists in a short time. Give it a few minutes, then try again.",
  tooLong: (max: number) => `That's longer than we read in one go. Paste up to ${max.toLocaleString("en-GB")} characters.`,
  sendText: "Send the list as text.",
  empty: "Paste a list or a receipt first.",
  photoOff: "Photo reading isn't switched on yet.",
  tooManyPhotos: "That's a lot of photos. Try again in a few minutes.",
  tooLarge: "That photo is too large. Try one under 5 MB.",
  sendForm: "Send the photo as a form upload.",
  noPhoto: "No photo received.",
  photoType: "Use a JPEG, PNG or WebP photo.",
  /** Only German pages use it: an English page shows the label reader's own message. */
  unreadable: "We couldn't read that photo. Try typing the list instead.",
};

export const myListPage = {
  metaTitle: "My savings list",
  metaDescription: "Add up what switching to the cheaper products saves you.",
  h1: "My savings list",
  intro: "The swaps you've saved, and what switching adds up to.",
  detail: (subcategory: string, pack: string) => `${subcategory}, per ${pack} pack`,
  cheaperItems: (n: number) => `${n} cheaper items`,
};

export const searchPage = {
  metaTitle: "Search swaps",
  metaDescription: "Search cheaper alternatives by brand, product or ingredient.",
  h1: "Find it cheaper",
  intro: "Type the brand you usually buy. We'll show the cheaper one that does the same job.",
  brands: "Brands with the most swaps",
  aisles: "Or browse an aisle",
};

export const report = {
  kind: {
    medicine: "Over-the-counter medicine",
    supplement: "Dietary supplement",
    cosmetic: "Personal care",
    food: "Food",
    pet: "Pet food",
    other: "Product",
  } satisfies Record<LookupProduct["kind"], string>,
  madeFor: (maker: string) => `Made for ${maker}`,
  barcode: (upc: string) => `Barcode ${upc}`,
  onSale: (countries: string) => `Reported on sale in: ${countries}`,
  whatFor: "What it's for",
  doesntSay: "The label data doesn't say.",
  whatsIn: "What's in it",
  amountMissing: "amount not listed",
  noIngredients: "No ingredient list in the data we have.",
  inactive: "Inactive ingredients",
  fullList: "Full ingredient list",
  howToUse: "How to use it",
  warnings: "Main warnings",
  readFull: (host: string) => `Read the full record at ${host}`,
  cheaper: "Cheaper options",
  compared: "Swaps we've compared with this product",
  eachSays: "Each one says what it matches on and what differs.",
  sameKind: "The same kind of product, for less",
  sameKindNote: "Our records don't show that these match on what's inside or how well they work.",
  sameActive: "Cheaper products with the same active ingredients on file",
  bundles: "Bundles from this brand, rebuilt for less",
  noteActives:
    "Look for a brand that lists exactly these active ingredients at the same strength. The form and other ingredients can still differ, and medicine rules differ by country, so ask a pharmacist if you're unsure.",
  noteFirstFive: (list: string) =>
    `Tip: products whose first five ingredients match (${list}) in the same order are usually close in formula. Ingredients are listed from most to least.`,
  noteStore: "Store brands are usually the cheapest. Compare the label and the price per unit.",
  usLabel: "Same active ingredients on the official US label",
  usLabelNote: "From FDA drug label data: same actives, same strength, same form. Store brands are usually the cheapest.",
  storeBrand: (name: string) => `Store brand: ${name}`,
  label: "Label",
  noMatch: "We don't have a cheaper match with prices for this one yet. We count every lookup, and the most requested products are researched first.",
  knowMatch: "Know a match? Tell us",
  fda: "Label data from openFDA and DailyMed (U.S. National Library of Medicine). ",
  dsld: "Label data from the NIH Office of Dietary Supplements' Label Database. ",
  odbl: (source: string) => `Data from ${source}, available under the Open Database License. `,
  photo: "Read from your photo, so check it against the pack. ",
  notAdvice: "This is label information, not medical advice. Always read the label, and ask a pharmacist or doctor if you're unsure.",
};
