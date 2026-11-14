import { hostname } from "./format";
import type { ProductSide } from "./types";

/**
 * Store names, kept apart from affiliate.ts so the catalogue build can name a store before the files it generates exist.
 */

export const RETAILER_LABEL: Record<string, string> = {
  amazon: "Amazon",
  // Brand and beauty stores that rows mark "other" but sellers.ts names from the link, for store-by-store checkouts.
  ulta: "Ulta Beauty",
  anker: "Anker",
  logitech: "Logitech",
  ugreen: "UGREEN",
  chipolo: "Chipolo",
  belkin: "Belkin",
  theordinary: "The Ordinary",
  lookfantastic: "LOOKFANTASTIC",
  maybelline: "Maybelline",
  dermstore: "Dermstore",
  thorne: "Thorne",
  livemomentous: "Momentous",
  walmart: "Walmart",
  target: "Target",
  costco: "Costco",
  bestbuy: "Best Buy",
  apple: "Apple",
  cvs: "CVS",
  walgreens: "Walgreens",
  boots: "Boots",
  superdrug: "Superdrug",
  tesco: "Tesco",
  asda: "Asda",
  sainsburys: "Sainsbury's",
  shoppers: "Shoppers Drug Mart",
  canadiantire: "Canadian Tire",
  loblaws: "Loblaws",
  dm: "dm",
  rossmann: "Rossmann",
  mueller: "Müller",
  shopapotheke: "Shop Apotheke",
  docmorris: "DocMorris",
  aponeo: "Aponeo",
  "medikamente-per-klick": "medikamente-per-klick",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  staples: "Staples",
  officedepot: "Office Depot",
  autozone: "AutoZone",
  kroger: "Kroger",
  aldi: "Aldi",
  lidl: "Lidl",
  morrisons: "Morrisons",
  waitrose: "Waitrose",
  ocado: "Ocado",
  wilko: "Wilko",
  argos: "Argos",
  screwfix: "Screwfix",
  toolstation: "Toolstation",
  bandq: "B&Q",
  halfords: "Halfords",
  ryman: "Ryman",
  rewe: "REWE",
  edeka: "EDEKA",
  kaufland: "Kaufland",
  hornbach: "Hornbach",
  obi: "OBI",
  bauhaus: "Bauhaus",
  atu: "A.T.U",
  ikea: "IKEA",
  chewy: "Chewy",
  petsathome: "Pets at Home",
  fressnapf: "Fressnapf",
  safeway: "Safeway",
  wholefoods: "Whole Foods Market",
  sprouts: "Sprouts",
  winco: "WinCo Foods",
  batteryjunction: "Battery Junction",
  netto: "Netto",
  penny: "Penny",
  tegut: "tegut",
  zooplus: "zooplus",
  pollin: "Pollin",
  alternate: "Alternate",
  sevendayshop: "7dayshop",
  viking: "Viking",
  crocus: "Crocus",
  coop: "Co-op",
  marksandspencer: "Marks & Spencer",
  iceland: "Iceland",
};

/** A store's name: ours when we have one, or else its web address, so two unnamed shops stay two shops. */
export function storeName(retailer: string, url: string) {
  return RETAILER_LABEL[retailer] ?? hostname(url);
}

/** Whose site a link really opens: any Amazon URL is Amazon, whichever retailer the record names. */
export function linkStoreName(p: Pick<ProductSide, "retailer" | "url">) {
  return hostname(p.url).startsWith("amazon.") ? "Amazon" : storeName(p.retailer, p.url);
}
