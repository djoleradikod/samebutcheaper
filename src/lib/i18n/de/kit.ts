import type { Shape } from "../t";
import type * as en from "../en/kit";
import { formatNumber, formatPercent } from "../format";
import { countryTo } from "./client";

/** "aus Deutschland", "aus dem Vereinigten Königreich": where a market's prices come from. */
const FROM: Record<string, string> = { US: "aus den USA", GB: "aus dem Vereinigten Königreich", CA: "aus Kanada", DE: "aus Deutschland", IE: "aus Irland" };
/** A store from a market, unnamed: "Ein britischer Händler". */
const STORE: Record<string, string> = { US: "Ein US-Händler", GB: "Ein britischer Händler", CA: "Ein kanadischer Händler", DE: "Ein deutscher Händler", IE: "Ein irischer Händler" };
/** "Britische Händler". */
const STORES: Record<string, string> = { US: "US-Händler", GB: "Britische Händler", CA: "Kanadische Händler", DE: "Deutsche Händler", IE: "Irische Händler" };

/** "bei einem britischen Händler" for an unnamed store, "bei dm" for a named one. */
const atStore = (store: string) => {
  const m = /^Ein (US-Händler|(\S+)er Händler)/.exec(store);
  if (!m) return `bei ${store}`;
  return `bei einem ${m[2] ? `${m[2]}en Händler` : m[1]}${store.slice(m[0].length)}`;
};

export const kitPage: Shape<typeof en.kitPage> = {
  notFound: "Set nicht gefunden",
  crumb: "Einkaufskörbe und Marken-Sets",
  theKit: (brand) => `Das Set von ${brand}`,
  perShipment: "Pro Lieferung",
  onePrice: "Ein Preis",
  supply: (days) => `, reicht etwa ${days} Tage`,
  aMonth: (amount) => `etwa ${amount} im Monat`,
  less: (pct) => `${formatPercent(pct, "de")} weniger`,
  builtFrom: (n) => `Aus ${n} günstigeren ${n === 1 ? "Produkt" : "Produkten"}`,
  sameAmountHolds: "Die gleiche Menge, wie im Set steckt",
  match: "Übereinstimmung",
  evidence: "Nachweis",
  seeKitAt: (store) => `Das Set bei ${store} ansehen`,
  pieceByPiece: "Stück für Stück",
  insteadOf: "Statt {name}, {pack}",
  packOf: "Packung mit {pack}, {price}",
  photo: "Foto:",
  sameAmount: "Gleiche Menge",
  goToStore: "Zum Händler",
  sameAmountAsKit: "Gleiche Menge wie im Set",
  differs: "Worin sich das Set unterscheidet",
  alsoComes: "Im Set ist außerdem: ",
  howChecked: "So haben wir jedes Teil geprüft",
  earns: "Einige dieser Links sind Affiliate-Links. Wir bekommen dann eventuell eine Provision, für dich ändert sich am Preis nichts.",
  searchMayEarn: "An diesen Links verdienen wir nichts. An einer Händlersuche weiter unten eventuell schon.",
  noEarn: "An diesen Links verdienen wir nichts.",
  details: "Details",
  moreKits: "Weitere Sets",
  allBasketsKits: "Alle Einkaufskörbe und Marken-Sets",
  piecesName: (name) => `${name}, aus günstigeren Produkten zusammengestellt`,

  startWith: (store) => `Mit ${store} anfangen`,
  seeList: "Zur Einkaufsliste",
  thenTick: "Dann die Einkaufsliste abhaken",
  kitDelivered: (delivered) => `Das Set${delivered ? ", mit Versand" : ""}`,
  rebuilt: (unchecked) => `Selbst zusammengestellt, ${unchecked ? "ohne ungeprüften Versand" : "mit Versand"}`,
  saving: (unchecked) => (unchecked ? "Ersparnis, ohne ungeprüften Versand" : "Ersparnis nach Versand"),
  orders: "Bestellungen",
  oneAt: (store) => (store ? `Eine, ${atStore(store)}` : "Eine, bei einem Händler"),
  stores: (n) => `${n} Händler`,
  costsMore: (amount) => `Selbst zusammenstellen kostet heute ${amount} mehr`,
  smallSaving: "Nur eine kleine Ersparnis",
  payMore: (amount, delivered) =>
    `An der Kasse zahlst du ${amount} mehr als für das Set${delivered ? " mit Versand" : ""}, weil die günstigeren Packungen mehr enthalten. `,
  savingIs: (amount, thinPct, more) =>
    `Die Ersparnis von ${amount}${thinPct !== null ? ` (${formatNumber(thinPct, "de")} % vom Preis des Sets)` : ""} gilt für die gleiche Menge wie im Set${more ? ", du merkst sie also erst, wenn du den Rest aufbrauchst" : ""}.`,
  noSaving: "Nach dem Versand bleibt keine Ersparnis.",
  simpler: " Wenn dir eine einzige Bestellung wichtiger ist, ist das Set der einfachere Kauf.",
  rebuildTitle: (brand, name) => `Das Set von ${brand} selbst zusammenstellen: ${name}`,
  sticky: (items, stores) => `Set selbst zusammenstellen: ${items} Artikel, ${stores === 1 ? "1 Händler" : `${stores} Händler`},`,

  checkout: "Was du an der Kasse zahlst",
  oneOrder: "Alles kommt von einem Händler, also ist es eine Bestellung, wie beim Set.",
  manyOrders: (n) => `Die Teile kommen von ${n} Händlern, also sind es ${n} Bestellungen statt einer für das Set. Der Versand jedes Händlers ist unten eingerechnet.`,
  abroad: (to) => ` Der Versand ist ${countryTo(to)} gerechnet, und nur dort, wo die Seite des Händlers einen Preis dafür nennt.`,
  kitIs: "Das Set: {price}",
  plusDelivery: " plus {fee} Versand",
  withFree: " mit kostenlosem Versand",
  kitUnchecked: ", den Versand dafür haben wir nicht geprüft",
  moreToday: (more, net) => `Heute zahlst du ${more} mehr, weil die Packungen mehr enthalten als das Set. Für die gleiche Menge sparst du trotzdem ${net}.`,
  keep: (amount, unchecked, holdsMore) =>
    `Du sparst heute ${amount}${unchecked ? ", ohne den ungeprüften Versand" : ""}${holdsMore ? ", und die Packungen enthalten mehr als das Set" : ""}.`,
  extraTakenOff: (amount) => `Von der Ersparnis oben sind die ${amount} für zusätzlichen Versand schon abgezogen.`,
  unnamedStore: (market, n) => `${STORE[market] ?? "Ein Händler"}${n ? ` (${n})` : ""}`,
};

export const basketPage: Shape<typeof en.basketPage> = {
  notFound: "Einkaufskorb nicht gefunden",
  crumb: "Einkaufskörbe und Marken-Sets",
  pricedIn: (market) => `Preise ${FROM[market] ?? ""}`.trim(),
  photos: "Fotos",
  bothTotals: "Beide Summen kaufen die gleiche Menge von jedem Produkt, zusammengerechnet aus dem Preis pro Einheit jedes Vergleichs. Händler verkaufen ganze Packungen, deshalb zählen die Beträge an der Kasse die Packungen, die du kaufen würdest.",
  dated: (market, dates) => ` Die Preise stammen ${FROM[market] ?? ""}, Stand ${dates}. Prüf sie also vor dem Kauf.`,
  alsoPricedIn: "Auch mit Preisen aus",
  whatsInIt: "Was drin ist",
  changeQty: "Ändere eine Menge, dann ändern sich beide Seiten mit, und du vergleichst weiter die gleiche Menge. Bei null fällt ein Artikel heraus.",
  howChosen: "So ist diese Liste entstanden",
  onEachSwap: "Preise und Nachweise stehen bei jedem Vergleich, mit eigenen Quellen und Daten.",
  howWeCheck: "So prüfen wir",
  guides: "Ratgeber und Checklisten, die wir gelesen haben",
  otherBaskets: "Weitere Einkaufskörbe",
  allBasketsKits: "Alle Einkaufskörbe und Marken-Sets",
  otherStores: "Andere Händler",
  marketStores: (market) => STORES[market] ?? "Andere Händler",
  dateRange: (first, last) => `${first} bis ${last}`,
};
