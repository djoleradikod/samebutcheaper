/**
 * Which store chain a source's store name belongs to, so a price from a Netto doesn't update a record
 * priced at REWE. Names are compared folded (lower case, no accents, "&" as "and", other marks as spaces).
 */

/** Names a chain trades under, beyond its own id. A name matches when it equals one of these or starts with one and a space. */
export const CHAIN_NAMES: Record<string, string[]> = {
  aldi: ["aldi", "aldi sud", "aldi nord", "aldi talk"],
  asda: ["asda", "asda superstore", "asda supercentre", "asda express"],
  bandq: ["b and q", "bandq"],
  boots: ["boots", "boots pharmacy"],
  coop: ["co op", "coop", "the co operative", "co operative food"],
  dm: ["dm", "dm drogerie markt"],
  edeka: ["edeka", "nah und gut", "e center", "marktkauf"],
  iceland: ["iceland", "the food warehouse"],
  kaufland: ["kaufland"],
  lidl: ["lidl"],
  marksandspencer: ["marks and spencer", "m and s", "m and s simply food", "marks and spencer simply food"],
  morrisons: ["morrisons", "morrisons daily"],
  mueller: ["muller", "mueller"],
  netto: ["netto", "netto marken discount", "netto city"],
  penny: ["penny", "penny markt"],
  rewe: ["rewe", "rewe city", "rewe center", "rewe to go"],
  rossmann: ["rossmann", "dirk rossmann"],
  sainsburys: ["sainsburys", "sainsburys local"],
  superdrug: ["superdrug"],
  tegut: ["tegut", "tegut teo"],
  tesco: ["tesco", "tesco express", "tesco extra", "tesco superstore", "tesco metro"],
  waitrose: ["waitrose", "waitrose and partners", "little waitrose"],
  kroger: ["kroger"],
  safeway: ["safeway"],
  wholefoods: ["whole foods", "whole foods market"],
  sprouts: ["sprouts", "sprouts farmers market"],
  winco: ["winco", "winco foods"],
  walgreens: ["walgreens"],
  cvs: ["cvs", "cvs pharmacy"],
  loblaws: ["loblaws"],
  shoppers: ["shoppers drug mart"],
  fressnapf: ["fressnapf", "maxi zoo"],
  petsathome: ["pets at home"],
};

export function fold(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when a store name (an OSM brand, a store's own name, an affiliate merchant name) is this retailer's. */
export function isChain(storeName: string | null | undefined, retailer: string) {
  if (!storeName) return false;
  const name = fold(storeName);
  const names = CHAIN_NAMES[retailer] ?? [fold(retailer)];
  return names.some((n) => name === n || name.startsWith(n + " "));
}
