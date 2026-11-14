/**
 * Checkout cards and the kit's buying list (CheckoutCard.tsx, BundleBuyList.tsx, buyListText in buy-list.ts). Shared by
 * kit and basket pages. Sentences with a price in them are templates: "{fee}" is where rich() puts the amount.
 */
import { s } from "../client/util";

export const pageCheckout = {
  /** "A, B and C". */
  and: "and",
  freeDelivery: "Free delivery.",
  /** {fee}: the delivery; {more}: the free-delivery part, or nothing. */
  delivery: "Delivery {fee}{more}.",
  /** {over}: the free-delivery line; {add}: what to add to reach it. */
  freeOverAdd: " (free over {over}: add {add} of anything you need{pickup})",
  orPickUp: ", or pick up in store for free",
  /** {over}: the free-delivery line. */
  freeOver: "Free delivery over {over}{pickup}.",
  freePickup: "Free pickup in store.",
  noneChecked: "We haven't checked delivery at any of these stores yet, so the total leaves it out. Check each store before you order.",
  someUnchecked: (names: string, n: number) => `We haven't checked delivery at ${names} yet, so the total leaves ${n === 1 ? "it" : "them"} out.`,
  /** {price}: the membership's price. */
  membership: (name: string, per: string) => `Needs a ${name} ({price} a ${per})`,
  surcharge: (pct: number) => `, or pay ${pct}% more online without one. We've counted the surcharge.`,
  payToday: (unchecked: boolean) => `You pay today${unchecked ? ", plus delivery we haven't checked" : ", delivered"}`,

  // The buying list
  buyingList: "Buying list",
  allInBasket: (total: number) => `All ${total} in your basket`,
  someInBasket: (done: number, total: number) => `${done} of ${total} in your basket`,
  done: ", done",
  addAll: (n: number, store: string) => `Add all ${n} to your ${store} basket`,
  inMyBasket: (piece: string, store: string) => `${piece}: in my ${store} basket`,
  insteadOf: (what: string) => `, instead of ${what}`,
  total: (unchecked: boolean): string => (unchecked ? "Total, plus delivery we haven't checked" : "Total, delivered"),
  copied: "Copied",
  copy: "Copy the list",
  clearTicks: "Clear ticks",
  copiedNote: "The list is copied.",
  copyFailedNote: "Your browser didn't let us copy. Select the list and copy it instead.",
  copyFailed: "Your browser didn't let us copy. Try again, or use the store links above.",
  ticksHere: "Ticks stay on this device only.",

  // The list as text (buyListText)
  text: {
    free: "free delivery",
    fee: (fee: string) => `delivery ${fee}`,
    notChecked: "delivery not checked",
    total: (unchecked: boolean, amount: string) => `Total${unchecked ? ", plus delivery we haven't checked" : " with delivery"}: ${amount}`,
    checked: (when: string) => `Prices checked ${when}. Check them before you buy.`,
  },
  items: (n: number) => `${n} item${s(n)}`,
};
