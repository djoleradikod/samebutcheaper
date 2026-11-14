/**
 * Kit and basket pages, on the server (KitView.tsx, BundleBuy.tsx, BundleCheckout.tsx, BasketView.tsx, basket-view.ts).
 * Their client parts read the page sections in ./pages/. "{price}" and the like are where rich() puts a piece of the page.
 */
import { MARKETS, type MarketCode } from "../../markets";
import { MARKET_ADJECTIVE } from "../../localize";
import { country, s } from "./client/util";

export const kitPage = {
  notFound: "Kit not found",
  crumb: "Baskets and kits",
  theKit: (brand: string) => `The ${brand} kit`,
  perShipment: "Per shipment",
  onePrice: "One price",
  supply: (days: number) => `, about ${days} days' supply`,
  aMonth: (amount: string) => `about ${amount} a month`,
  less: (pct: number) => `${pct}% less`,
  builtFrom: (n: number) => `Built from ${n} cheaper item${s(n)}`,
  sameAmountHolds: "The same amount as the kit holds",
  match: "Match",
  evidence: "Evidence",
  seeKitAt: (store: string) => `See the kit at ${store}`,
  pieceByPiece: "Piece by piece",
  insteadOf: "Instead of {name}, {pack}",
  packOf: "Pack of {pack}, {price}",
  photo: "Photo:",
  sameAmount: "Same amount",
  goToStore: "Go to the store",
  sameAmountAsKit: "Same amount as the kit",
  differs: "Where the kit differs",
  alsoComes: "The kit also comes with: ",
  howChecked: "How we checked each item",
  earns: "Some of these are affiliate links, so we may earn a commission at no extra cost to you.",
  searchMayEarn: "These links don't earn us anything. A store search further down may.",
  noEarn: "We don't earn anything from these links.",
  details: "Details",
  moreKits: "More kits",
  allBasketsKits: "All baskets and kits",
  piecesName: (name: string) => `${name}, rebuilt from cheaper items`,

  // The buy box (BundleBuy.tsx)
  startWith: (store: string) => `Start with ${store}`,
  seeList: "See the buying list",
  thenTick: "Then tick off the buying list",
  // The box's sums (KitSums.tsx)
  sumKit: "The kit",
  sumRebuilt: "Same amount, rebuilt",
  sumExtraDelivery: "Extra delivery for the extra orders",
  sumSaving: (unchecked: boolean, extra: boolean): string =>
    unchecked ? "Saving, before delivery we haven't checked" : extra ? "Saving after delivery" : "Saving",
  sumCheckout: (unchecked: boolean) => `You pay at checkout, ${unchecked ? "plus delivery we haven't checked" : "delivered"}`,
  sumHoldsMore: "The cheaper packs hold more than the kit.",
  orders: "Orders",
  oneAt: (store: string | null) => `One, at ${(store ?? "one store").replace(/^A /, "a ")}`,
  stores: (n: number) => `${n} stores`,
  costsMore: (amount: string) => `Rebuilding costs ${amount} more today`,
  smallSaving: "Only a small saving",
  payMore: (amount: string, delivered: boolean) =>
    `You pay ${amount} more at the till than for the kit${delivered ? ", delivered" : ""}, because the cheaper packs hold more. `,
  savingIs: (amount: string, thinPct: number | null, more: boolean) =>
    `The ${amount} saving${thinPct !== null ? `, ${thinPct}% of the kit's price,` : ""} is for the same amount as the kit${more ? ", so you only see it once you use the extra" : ""}.`,
  noSaving: "After delivery there is no saving.",
  simpler: " If one order matters more to you, the kit is the simpler buy.",
  rebuildTitle: (brand: string, name: string) => `Rebuild the ${brand} kit: ${name}`,
  sticky: (items: number, stores: number) => `Rebuild this kit: ${items} item${s(items)}, ${stores === 1 ? "1 store" : `${stores} stores`},`,

  // What you pay at checkout (BundleCheckout.tsx)
  checkout: "What you pay at checkout",
  oneOrder: "Everything comes from one store, so it's one order, like the kit.",
  manyOrders: (n: number) => `The pieces come from ${n} stores, so it's ${n} orders where the kit is one. Each store's delivery is counted below.`,
  abroad: (to: string) => ` Delivery is counted to ${country(to)}, and only where the store's own page gives a price for it.`,
  kitIs: "The kit: {price}",
  plusDelivery: " plus {fee} delivery",
  withFree: " with free delivery",
  kitUnchecked: ", and we haven't checked its delivery",
  moreToday: (more: string, net: string) => `You pay ${more} more today, because the packs hold more than the kit. For the same amount you still save ${net}.`,
  keep: (amount: string, unchecked: boolean, holdsMore: boolean) =>
    `You keep ${amount} today${unchecked ? ", before delivery we haven't checked" : ""}${holdsMore ? ", and the packs hold more than the kit" : ""}.`,
  extraTakenOff: (amount: string) => `The saving at the top already takes off the ${amount} of extra delivery.`,
  /** A store that doesn't sell in the shopper's country, unnamed. `n` tells two of them apart. */
  unnamedStore: (market: MarketCode, n: number | null) => `A ${MARKET_ADJECTIVE[market]} store${n ? ` (${n})` : ""}`,
};

export const basketPage = {
  notFound: "Basket not found",
  crumb: "Baskets and kits",
  pricedIn: (market: MarketCode) => `Priced in ${MARKETS[market].short}`,
  photos: "Photos",
  bothTotals: "Both totals buy the same amount of each product, added up from each swap's price per unit. Stores sell whole packs, so the till figures count the packs you'd buy.",
  dated: (market: MarketCode, dates: string) => ` Prices are from ${MARKETS[market].short}, dated ${dates}, so check them before you buy.`,
  alsoPricedIn: "Also priced in",
  whatsInIt: "What's in it",
  changeQty: "Change a quantity and both sides scale, so you still compare the same amount. Set it to zero to leave an item out.",
  howChosen: "How this list was chosen",
  onEachSwap: "Prices and evidence are on each swap, with their own sources and dates.",
  howWeCheck: "How we check",
  guides: "Guides and checklists we read",
  otherBaskets: "Other baskets",
  allBasketsKits: "All baskets and kits",
  otherStores: "Other stores",
  marketStores: (market: MarketCode) => `${MARKET_ADJECTIVE[market]} stores`,
  dateRange: (first: string, last: string) => `${first} to ${last}`,
};
