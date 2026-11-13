import { market, country } from "./util";

export const where = {
  pick: (m: string) => `These prices are from ${market(m)}. Pick your country to see what to look for there.`,
  sellsHere: (store: string, m: string) => `${store} sells this in ${market(m)}. Check the store for delivery or collection.`,
  deliversFrom: (store: string, m: string, to: string) =>
    `${store} delivers from ${market(m)} to ${country(to)}, by its own delivery page. Delivery there is charged at its own rate, so check it at checkout.`,
  maybe: (store: string, m: string) =>
    `${store} in ${market(m)} ships many items abroad, so check delivery and import fees at checkout. It's usually cheaper to buy locally.`,
  ownSite: (store: string, at: string, m: string) =>
    `${store} sells in ${country(at)} only through its own site there, with a different range and prices, so the listing we priced in ${market(m)} isn't sold there. Look for the same thing there or at the stores below.`,
  sellsToo: (store: string, m: string, at: string) =>
    `We priced this at ${store} in ${market(m)}. ${store} sells in ${country(at)} too, so look for it there and check the price, as its range and prices can differ.`,
  noDelivery: (m: string, to: string, actives: boolean) =>
    `The store we priced this at in ${market(m)} doesn't deliver to ${country(to)}. ${
      actives ? "The same thing is usually on the shelf there under another name." : "Look for it there, or for the same thing under another name."
    }`,
  buyingIn: (at: string) => `Buying in ${country(at)}`,
  lookForIn: (at: string) => `What to look for in ${country(at)}`,
  sameActives: "Any brand that lists exactly these active ingredients at the same strength is the same product. Store brands are usually the cheapest.",
  compareLabel: (brand: string) => `Compare the label with ${brand} before you buy. Store brands are usually the cheapest.`,
  storeBrands: "Store brands are usually the cheapest.",
  medicineRules: (m: string) =>
    ` Medicine rules differ by country: something sold off the shelf in ${market(m)} may need a pharmacist or a prescription where you live.`,
  searchStores: (to: string) => `Search stores that deliver to ${country(to)}`,
  goTo: (store: string, site: string) => `Go to ${store} at ${site}`,
  search: (store: string) => `Search ${store}`,
  noBigStore: (to: string) =>
    `We don't know a big online store that delivers to ${country(to)} yet. Your local pharmacy or supermarket will have the same thing under its own label.`,
  checkedIn: (m: string) => `Prices on this page were checked in ${market(m)}.`,
};
