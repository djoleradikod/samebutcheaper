/**
 * The site's frame and the words every page shares: the header, the footer, the aisles and the match levels.
 * English, exactly as the components had it inline.
 */
import type { CategorySlug, MatchType } from "../../types";
import { inSentence } from "../../format";
import { countryInSentence } from "../../markets";

export const layout = {
  skip: "Skip to content",
  /** The site's description in its JSON-LD (SITE.description in English). */
  siteDescription:
    "Cheaper alternatives to brand-name products, compared per unit. Each swap says what matches, what differs and what our records don't show, and links to at least two sources.",
};

export const header = {
  home: "SameButCheaper home",
  searchPlaceholder: "Search swaps by brand or product",
  search: "Search",
  check: "Check a product",
  myList: "My list",
  menu: "Menu",
  aisles: "Aisles",
  links: {
    "/check": "Check a product",
    "/my-list": "My savings list",
    "/biggest-savings": "Biggest savings",
    "/bundles": "Bundles",
    "/bulk": "Buy in bulk",
    "/why": "Why not overpay",
    "/brands": "Browse by brand",
    "/how-we-verify": "How we check",
    "/suggest": "Suggest a swap",
  } as Record<string, string>,
  aisleShort: {
    "food-pantry": "Food",
    household: "Household",
    "skincare-personal-care": "Skincare",
    "beauty-hair": "Beauty",
    baby: "Baby",
    pet: "Pet",
    kitchen: "Kitchen",
    "tech-tools": "Tech",
    batteries: "Batteries",
    "tools-diy": "Tools",
    office: "Office",
    car: "Car",
    garden: "Garden",
    supplements: "Supplements",
    "otc-medicine": "Medicine",
  } satisfies Record<CategorySlug, string>,
};

export const footer = {
  about:
    "We find cheaper products that do the same job as the brand names, show what differs and link the proof. No brand pays to be listed or ranked.",
  amazon: "As an Amazon Associate we earn from qualifying purchases. That never changes which swaps we list or how we rank them.",
  someLinks: "Some links are affiliate links. That never changes which swaps we list or how we rank them.",
  noLinks: "No link on this site earns us anything today.",
  readDisclosure: "Read our disclosure",
  aisles: "Aisles",
  links: {
    "/check": "Check any product",
    "/biggest-savings": "Biggest savings",
    "/bundles": "Bundles",
    "/bulk": "Buy in bulk",
    "/why": "Why it's worth switching",
    "/brands": "Browse by brand",
    "/ingredients": "Browse by ingredient",
    "/my-list": "My savings list",
    "/how-we-verify": "How we check",
    "/suggest": "Suggest a swap",
    "/about": "About",
    "/credits": "Photo credits",
    "/disclosure": "Disclosure",
    "/privacy": "Privacy",
    "/impressum": "Impressum",
  } as Record<string, string>,
  affiliateDisclosure: "Affiliate disclosure",
  /** Where the footer's privacy link goes. */
  privacyHref: "/privacy",
  bottom:
    "Prices change often, so check the current price at the store. Brand names and pack designs belong to their owners and are used only to identify the products being compared. Nothing here is medical advice: read the label and ask a pharmacist or doctor about medicines and supplements.",
  pricesByCountry: "Prices by country",
  /** A link to a page that exists only in English, as the link reads. */
  englishOnly: (label: string) => label,
};

export const markets = {
  name: { US: "United States", GB: "United Kingdom", CA: "Canada", DE: "Germany", IE: "Ireland" } as Record<string, string>,
};

type CategoryText = { name: string; short: string; description: string };

export const categories: Record<CategorySlug, CategoryText> = {
  "otc-medicine": {
    name: "OTC Medicine",
    short: "Pain, allergy, stomach, sleep",
    description:
      "Pain, allergy and stomach medicines, compared per tablet or per dose. Each swap says what the labels show. Ask a pharmacist if you're unsure.",
  },
  supplements: {
    name: "Supplements & Vitamins",
    short: "Creatine, fish oil, multivitamins",
    description: "Vitamins, minerals and other supplements, compared per serving. Each swap says what the labels show.",
  },
  "skincare-personal-care": {
    name: "Skincare & Personal Care",
    short: "Moisturisers, acne, dental, shave",
    description: "The same kind of product, with ingredients and active percentages from the label.",
  },
  "beauty-hair": {
    name: "Beauty & Hair",
    short: "Haircare, makeup removers, lip",
    description: "The same kind of product, with both ingredient lists side by side. No scent-alike “dupes”.",
  },
  household: {
    name: "Household & Cleaning",
    short: "Laundry, dishes, paper, cleaning",
    description:
      "Laundry, dishes, paper and cleaning products, compared per wash, per sheet or per litre, with test results where they exist.",
  },
  baby: {
    name: "Baby",
    short: "Formula and skin care",
    description: "The same kind of product, compared per unit. Check with your doctor or health visitor before changing formula.",
  },
  pet: {
    name: "Pet",
    short: "Food, litter, flea & tick",
    description: "The same kind of food or treatment, compared per kilo or per dose. Ask your vet if you're unsure.",
  },
  "food-pantry": {
    name: "Food & Pantry",
    short: "Staples, sweeteners, drinks",
    description: "Own-label food next to the brand, compared per 100 g or per litre, with taste tests where they exist.",
  },
  "tech-tools": {
    name: "Tech accessories",
    short: "Chargers, cables, keyboards",
    description: "Chargers, cables, memory and keyboards, compared per item, with lab tests where they exist.",
  },
  kitchen: {
    name: "Kitchen",
    short: "Foil, bags, filters, kettles",
    description: "Foil, film, bags and basics, compared per metre or per item, with test results where they exist.",
  },
  batteries: {
    name: "Batteries",
    short: "AA, AAA, button cells, rechargeables",
    description: "AA, AAA, button cells and rechargeables, compared per cell, with test results where they exist.",
  },
  "tools-diy": {
    name: "Tools & DIY",
    short: "Hand tools, glue, sealant, gloves",
    description: "Hand tools, glue, sealant and gloves, compared per item, with test results where they exist.",
  },
  office: {
    name: "Office & School",
    short: "Paper, pens, ink, labels",
    description: "Paper, pens, ink and labels, compared per sheet or per item.",
  },
  car: {
    name: "Car",
    short: "Screenwash, wipers, car care",
    description: "Fluids and car care, compared per litre or per item, with group test results where they exist.",
  },
  garden: {
    name: "Garden",
    short: "Compost, feed, hoses, secateurs",
    description: "The same kind of product, compared per litre or per item, with test results where they exist.",
  },
};

/** The head of every list of swaps (src/components/ShelfParts.tsx), the aisle pages and biggest savings. */
export const lists = {
  home: "Home",
  breadcrumb: "Breadcrumb",
  howWeCheck: "How we check",
  photos: "Photos",
  averageSaving: "Average saving",
  pricesChecked: (month: string) => `Prices last checked ${month}.`,
  biggestSaving: "biggest saving",
  upTo: (n: number) => `Up to ${n}% cheaper per unit`,
  noneHere: (country: string) => `We haven't priced any of these at a store that sells in ${countryInSentence(country)} yet.`,
  noneHereMore: (more: number, country: string) =>
    ` The ${more} we priced elsewhere are behind "Show swaps from other countries" at the top of the page. Each one says what to look for in shops in ${countryInSentence(country)}.`,
  category: {
    notFound: "Category not found",
    cheaper: (name: string) => `Cheaper ${inSentence(name)}`,
    metaTitle: (name: string, count: number) => (count ? `Cheaper ${inSentence(name)}: ${count} brand-name swaps` : `Cheaper ${inSentence(name)}`),
    metaLead: (name: string, count: number) => `${count} cheaper alternatives to brand-name ${inSentence(name)}, compared per unit with sources.`,
    emptyTitle: "We haven't checked any swaps in this aisle yet.",
    emptyBody: "Tell us what you buy here and we'll look into it, or try another aisle.",
    suggest: "Suggest a swap",
  },
  biggest: {
    title: "Biggest savings",
    intro: (sources: number) => `Every swap we've checked, with the biggest saving per unit first. ${sources} sources back them up.`,
    metaTitle: "Biggest savings: every swap, ranked",
    metaDescription: "Every cheaper alternative to a brand-name product in our catalogue, ranked by how much you save per unit.",
  },
};

/** /bundles (src/app/bundles/page.tsx). */
export const bundlesPage = {
  metaTitle: "Baskets and brand kits, priced both ways",
  metaDescription:
    "Whole shopping baskets and brand kits rebuilt from cheaper products. Totals buy the same amount on both sides, and every item links to what we have on file for it.",
  both: "Baskets and brand kits",
  kitsOnly: "Brand kits",
  none: "None are listed yet. The single swaps are ready, and if a kit costs you too much you can tell us which one.",
  seeBiggest: "See the biggest savings",
  suggestKit: "Suggest a kit",
  baskets: (n: number) => ` basket${n === 1 ? "" : "s"} for a moment in life, built from swaps we've checked. Both totals buy the same amount. `,
  kits: (n: number) => ` brand kit${n === 1 ? "" : "s"} taken apart and rebuilt from cheaper items, one piece at a time.`,
  onThisPage: "On this page",
  basketsJump: "Baskets",
  aisleKits: (aisle: string) => `${aisle} kits`,
  pricedIn: (market: string) => `Baskets priced in ${market}`,
  kitsHeading: "Brand kits, rebuilt from cheaper items",
  kitsIntro: "Brands sell regimens, stacks and gift sets as one price. We match each piece with a cheaper product and add up the same amount.",
};

/** What the newsletter sign-up answers (subscribe in src/app/actions.ts). */
export const subscribe = {
  thanks: "Thanks!",
  validEmail: "Please enter a valid email address.",
  tooMany: "That's a lot of tries in a short time. Please wait a few minutes.",
  notOpen: "Sign-ups are not open yet. Please check back soon.",
  almost: "Almost there. We've sent you an email: click the link in it to confirm.",
  onList: "You're on the list. We'll email you once to confirm before the first send.",
  wrong: "Something went wrong. Please try again.",
};

/** The 404 page (src/app/not-found.tsx). */
export const notFound = {
  title: "We couldn't find that page",
  body: "The swap may have moved, or we haven't checked it yet.",
  search: "Search swaps",
  suggest: "Suggest one",
};

/** The home page (src/app/page.tsx). */
export const home = {
  metaTitle: "",
  metaDescription: "",
  h1: "Same job. Lower price.",
  swapsSources: (n: number) => ` swap${n === 1 ? "" : "s"}, each with at least two sources`,
  typically: ", typically ",
  cheaperPerUnit: " cheaper per unit.",
  noBrandPays: "No brand pays to be listed.",
  someEarn: "Some links earn us a commission.",
  noneEarn: "No link earns us anything today.",
  howWeCheck: "How we check",
  cta: "Paste your shopping list. See what you'd keep a year.",
  ctaSub: "A list or a receipt: we match what we can and ask about the rest.",
  basket: "Swap a whole basket",
  biggest: "Biggest savings",
  allSwaps: "All swaps",
  photos: "Photos",
  why: "Why it's worth switching",
  allFindings: "All findings",
  bulk: "Buying in bulk",
  bulkBody: "A bigger pack only saves money if it's cheaper per unit and you'll use it before it goes off. These are for unopened packs.",
  allBulk: "All bigger packs",
  allShelfLives: "All shelf lives, with sources",
  columns: {
    stock_up: ["Stock up", "Keeps for years, so a big pack is safe."],
    buy_to_use: ["Buy to use", "Fine in bulk if you get through it in time."],
    buy_small: ["Buy small", "Goes off or weakens, so skip the big pack."],
  } as Record<string, [title: string, body: string]>,
  allAisles: "All aisles",
  tileSwaps: (n: number) => ` swap${n === 1 ? "" : "s"}, up to `,
  tileCheaper: " cheaper",
  /** An aisle whose savings all depend on prices a store's affiliate terms withhold: the count alone. */
  tileCount: (n: number) => ` swap${n === 1 ? "" : "s"}`,
  email: "Get new swaps by email",
  questions: "Questions",
  missing: "Know a swap we're missing?",
  suggestIt: "Suggest it",
  faq: (aisles: string[], earns: boolean): { q: string; a: string }[] => {
    const names = aisles.map(inSentence);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
    return [
      {
        q: "What do you compare?",
        a: `Everyday products where you can pay less for the same job. Today that means ${list}. Prices are compared per unit, so a big pack and a small pack can be judged fairly.`,
      },
      {
        q: "If two products do the same job, why does one cost more?",
        a: "A brand's price also pays for advertising, packaging and its place on the shelf. Sometimes the brand does earn the extra, and we show where it's better.",
      },
      {
        q: "How do you decide two products match?",
        a: "Most swaps meet one of four standards: the same active ingredient at the same strength, the same formula per the label, the same manufacturer, or doing the same job to a comparable standard. Some have nothing compared on both sides, so they say \"Same kind of product\" and claim no more than that. Every swap says which of these it is, lists what differs and links to at least two sources.",
      },
      {
        q: "Should I buy the biggest pack?",
        a: "Only if it's cheaper per unit and you'll use it before it goes off. Bigger packs usually cost less per unit, but not always.",
      },
      {
        q: "How do you make money?",
        a: `${earns ? "Some links are affiliate links, so we may earn a small commission if you buy, at no extra cost to you." : "We don't, for now. No link on this site earns us anything."} No brand or store pays to be listed or ranked. Swaps are ranked by how much you save, and we show where the brand is better too.`,
      },
      {
        q: "Are the prices current?",
        a: "Prices are typical shelf prices from the month shown on each swap, and they change often. Check the price at the store before you buy.",
      },
      {
        q: "Is any of this medical advice?",
        a: "No. For medicines and supplements, read the label and ask a pharmacist or doctor.",
      },
    ];
  },
};

type MatchText = { label: string; short: string; description: string };

const MATCH_PHRASE: [MatchType, string][] = [
  ["identical_active", "the same active ingredients"],
  ["identical_formula", "the same formula on the label"],
  ["same_manufacturer", "the same manufacturer"],
  ["equivalent_spec", "comparable specs or tests"],
];

export const match: Record<MatchType, MatchText> & { sentence: (types: MatchType[]) => string } = {
  identical_active: {
    label: "Same active ingredient",
    short: "Same active",
    description: "Same active ingredient(s), same strength, same dosage form, confirmed from the official label.",
  },
  identical_formula: {
    label: "Same formula per label",
    short: "Same formula",
    description: "The full ingredient list on the label matches, in the same order.",
  },
  same_manufacturer: {
    label: "Same manufacturer",
    short: "Same maker",
    description:
      "Public records (recalls, regulatory filings, plant codes) or an on-record statement from one of the companies show the same company makes both.",
  },
  equivalent_spec: {
    label: "Does the same job",
    short: "Same job",
    description: "Published specs, certifications or independent tests show they do the same job to a comparable standard.",
  },
  same_kind: {
    label: "Same kind of product",
    short: "Same kind",
    description:
      "The same kind of product, priced from real sources. What we have doesn't show that they match on what's inside or how well they work.",
  },
  /** One or two sentences on what a group of swaps can claim, so a page promises no more than its weakest swap shows. */
  sentence: (types) => {
    const phrases = MATCH_PHRASE.filter(([type]) => types.includes(type)).map(([, phrase]) => phrase);
    const list = phrases.length < 2 ? phrases.join("") : `${phrases.slice(0, -1).join(", ")}, or ${phrases[phrases.length - 1]}`;
    if (!types.includes("same_kind")) return list ? `Each has ${list}.` : "";
    if (!list) return "Each is the same kind of product. Our records don't show that the two match on what's inside or how well they work.";
    return `Some have ${list}, and the rest are only the same kind of product. Each swap says which.`;
  },
};
