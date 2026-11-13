/** Where to buy a kit's pieces from another country (BundleWhereToBuy.tsx). */
import { country, market } from "../client/util";

export const pageKitWhere = {
  allSell: (c: string) => `Every store on this list sells in ${country(c)}. Check each one for delivery.`,
  allDeliver: (c: string) => `Every store on this list delivers to ${country(c)}, by its own delivery page. Delivery there is charged at its own rate.`,
  buyingIn: (c: string) => `Buying in ${country(c)}`,
  checkedIn: (m: string, c: string) => `These prices were checked in ${market(m)}, and some of the stores don't deliver to ${country(c)}. Look for these locally:`,
  insteadOf: (what: string) => `Instead of ${what}`,
  storeIn: (store: string, c: string) => `${store} in ${country(c)}`,
  search: (store: string) => `Search ${store}`,
  medicine: (m: string) => `Medicine rules differ by country. Something sold off the shelf in ${market(m)} may need a pharmacist or a prescription where you live.`,
};
