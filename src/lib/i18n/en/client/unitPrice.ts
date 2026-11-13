/** A unit price pair (UnitPrice.tsx), on swap pages, cards and rows. Its own section so a swap page doesn't load the cards' words. */
export const unitPrice = {
  vs: "vs",
  /** What a screen reader hears for the drawn arrow. */
  to: " to ",
  priceSr: (about: boolean, cheaper: string, dearer: string, unit: string) =>
    `${about ? "About: " : ""}Cheaper one ${cheaper} ${unit}, brand ${dearer} ${unit}.`,
  /** A unit price's label ("per 100 g"); German pages translate it. */
  unitLabel: (u: { english: string; unit: string }) => u.english,
};
