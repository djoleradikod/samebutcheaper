/** The delivery line under a store's price (deliveryNote in src/lib/delivery-abroad.ts). */
export const delivery = {
  home: (cost: string, freeOver: string, pickup: boolean) => `Delivery ${cost} on its own, free over ${freeOver}${pickup ? ", or free store pickup" : ""}`,
  notChecked: (country: string) => `Delivery to ${country} not checked`,
  free: (country: string) => `Delivery to ${country} free on this order`,
  abroad: (country: string, cost: string, freeOver: string | null) =>
    `Delivery to ${country} ${cost} on its own${freeOver !== null ? `, free over ${freeOver}` : ""}`,
};
