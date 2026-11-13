import type { Shape } from "../../t";
import type { pageKitWhere as en } from "../../en/pages/kitWhere";
import { countryAt, countryTo } from "../client";

/** "aus Deutschland": where a market's prices come from. */
const FROM: Record<string, string> = { US: "aus den USA", GB: "aus dem Vereinigten Königreich", CA: "aus Kanada", DE: "aus Deutschland", IE: "aus Irland" };

export const pageKitWhere: Shape<typeof en> = {
  allSell: (c) => `Alle Händler auf dieser Liste verkaufen ${countryAt(c)}. Prüf bei jedem den Versand.`,
  allDeliver: (c) => `Alle Händler auf dieser Liste liefern laut eigener Versandseite ${countryTo(c)}. Der Versand dorthin kostet je nach Händler extra.`,
  buyingIn: (c) => `Kaufen ${countryAt(c)}`,
  checkedIn: (m, c) => `Diese Preise stammen ${FROM[m] ?? m}, und einige der Händler liefern nicht ${countryTo(c)}. Such vor Ort nach diesen Produkten:`,
  insteadOf: (what) => `Statt ${what}`,
  storeIn: (store, c) => `${store} ${countryAt(c)}`,
  search: (store) => `Bei ${store} suchen`,
  medicine: (m) => `Die Regeln für Arzneimittel sind von Land zu Land verschieden. Was ${countryAt(m)} frei verkäuflich ist, kann bei dir apothekenpflichtig oder verschreibungspflichtig sein.`,
};
