import type { Shape } from "../../t";
import type { pageCheckout as en } from "../../en/pages/checkout";

const PER: Record<string, string> = { year: "Jahr", month: "Monat", week: "Woche" };

export const pageCheckout: Shape<typeof en> = {
  and: "und",
  freeDelivery: "Kostenloser Versand.",
  delivery: "Versand {fee}{more}.",
  freeOverAdd: " (ab {over} versandkostenfrei: noch {add} von etwas, das du ohnehin brauchst{pickup})",
  orPickUp: ", oder kostenlos im Markt abholen",
  freeOver: "Ab {over} versandkostenfrei{pickup}.",
  freePickup: "Kostenlose Abholung im Markt.",
  noneChecked: "Den Versand dieser Händler haben wir noch bei keinem geprüft, deshalb fehlt er in der Summe. Prüf ihn bei jedem Händler, bevor du bestellst.",
  someUnchecked: (names) => `Den Versand bei ${names} haben wir noch nicht geprüft, deshalb fehlt er in der Summe.`,
  membership: (name, per) => `Nur mit Mitgliedschaft (${name}, {price} pro ${PER[per] ?? per})`,
  surcharge: (pct) => `, oder ohne Mitgliedschaft online ${pct} % teurer. Den Aufschlag haben wir eingerechnet.`,
  payToday: (unchecked) => `Du zahlst heute${unchecked ? ", zuzüglich Versand, den wir nicht geprüft haben" : ", mit Versand"}`,

  buyingList: "Einkaufsliste",
  allInBasket: (total) => `Alle ${total} im Warenkorb`,
  someInBasket: (done, total) => `${done} von ${total} im Warenkorb`,
  done: ", erledigt",
  addAll: (n, store) => `Alle ${n} in den Warenkorb bei ${store}`,
  inMyBasket: (piece, store) => `${piece}: in meinem Warenkorb bei ${store}`,
  insteadOf: (what) => `, statt ${what}`,
  total: (unchecked) => (unchecked ? "Summe, zuzüglich Versand, den wir nicht geprüft haben" : "Summe, mit Versand"),
  copied: "Kopiert",
  copy: "Liste kopieren",
  clearTicks: "Häkchen entfernen",
  copiedNote: "Die Liste ist kopiert.",
  copyFailedNote: "Dein Browser hat das Kopieren nicht erlaubt. Markier die Liste und kopier sie selbst.",
  copyFailed: "Dein Browser hat das Kopieren nicht erlaubt. Versuch es noch einmal oder nimm die Links zu den Händlern oben.",
  ticksHere: "Die Häkchen bleiben nur auf diesem Gerät.",

  text: {
    free: "Versand kostenlos",
    fee: (fee) => `Versand ${fee}`,
    notChecked: "Versand nicht geprüft",
    total: (unchecked, amount) => `Summe${unchecked ? ", zuzüglich Versand, den wir nicht geprüft haben," : " mit Versand"}: ${amount}`,
    checked: (when) => `Preise geprüft im ${when}. Prüf sie vor dem Kauf.`,
  },
  items: (n) => `${n} Artikel`,
};
