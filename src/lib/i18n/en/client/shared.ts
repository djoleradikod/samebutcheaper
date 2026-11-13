import { country } from "./util";

export const shared = {
  about: "about",
  delivery: {
    home: (fee: string, freeOver: string, pickup: boolean) => `Delivery ${fee} on its own, free over ${freeOver}${pickup ? ", or free store pickup" : ""}`,
    notChecked: (to: string) => `Delivery to ${country(to)} not checked`,
    free: (to: string) => `Delivery to ${country(to)} free on this order`,
    abroad: (to: string, fee: string, freeOver: string | null) => `Delivery to ${country(to)} ${fee} on its own${freeOver ? `, free over ${freeOver}` : ""}`,
  },
  pharmacy: "Most medicines there are sold only by pharmacies (Apotheke), including online pharmacies.",
  onAmazon: "on Amazon",
  atStore: (store: string) => `at ${store}`,
  theStore: "the store",
};
