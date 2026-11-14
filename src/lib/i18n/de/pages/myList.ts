import type { Shape } from "../../t";
import type { pageMyList as en } from "../../en/pages/myList";
import { formatPercent } from "../../format";

export const pageMyList: Shape<typeof en> = {
  nothingSaved: "Noch nichts gespeichert. Tipp bei einem Vergleich oder Set auf {button} oder speichere einen ganzen Einkaufskorb, und diese Seite rechnet zusammen, was der Wechsel spart.",
  addButton: "Auf meine Liste",
  seeBaskets: "Zu den Einkaufskörben",
  seeBiggest: "Zu den größten Ersparnissen",
  kit: "Set: ",
  youBuyIt: "Du kaufst es",
  howOften: (from) => `Wie oft du ${from} kaufst`,
  assumed: "Angenommen",
  remove: (from) => `${from} von meiner Liste entfernen`,
  restocking: (n) => (n === 1 ? "Wenn du das einmal nachkaufst" : `Wenn du alle ${n} einmal nachkaufst`),
  saveAmount: (amount) => `Spare ${amount}`,
  perPackNote: "Pro Markenpackung bei einem Vergleich und pro Set bei einem Set, zu den datierten Preisen auf jeder Seite.",
  saveThese: "Auf meine Liste übernehmen",
  linkCopied: "Link kopiert",
  copyList: "Link zu dieser Liste kopieren",
  staysHere: "Deine Liste und wie oft du etwas kaufst, bleiben in diesem Browser. Wir speichern sie nicht.",
  yearLess: (pct) => `im Jahr, ${formatPercent(pct, "de")} weniger`,
  onceLess: (pct) => `einmalig, ${formatPercent(pct, "de")} weniger`,
  perLess: (per, pct) => `${per}, ${formatPercent(pct, "de")} weniger`,
  assumes: (assumed, total, often) => {
    const which =
      assumed === total
        ? total === 1
          ? "Das setzt voraus, dass du die Markenpackung"
          : "Das setzt voraus, dass du jede Markenpackung"
        : `Bei ${assumed} der ${total} Vergleiche setzt das voraus, dass du die Markenpackung`;
    return `${which} ${often} kaufst. Das können wir nicht wissen, also stell unten ein, wie oft.`;
  },
  chosen: "So oft, wie du nach eigener Angabe jede Markenpackung kaufst, zu den datierten Preisen auf jeder Seite.",
  plusOnce: (amount, kits, things) => {
    const parts = [
      kits ? (kits === 1 ? "ein Set" : `${kits} Sets`) : null,
      things ? (things === 1 ? "etwas, das du nur einmal kaufst" : `${things} Dinge, die du nur einmal kaufst`) : null,
    ].filter(Boolean);
    return `Dazu einmalig ${amount} für ${parts.join(" und ")}.`;
  },
  perAmount: (n) =>
    n === 1
      ? "Ein Vergleich hat einen Preis pro Waschladung oder pro Menge, ohne Packung zum Zählen, deshalb ist er nicht enthalten."
      : `${n} Vergleiche haben einen Preis pro Waschladung oder pro Menge, ohne Packung zum Zählen, deshalb sind sie nicht enthalten.`,
  listSaves: "Deine Liste spart",
  perYear: (amount) => `${amount} im Jahr`,
  onceAmount: (amount) => `${amount} einmalig`,
  nothingToCount: "Nichts auf deiner Liste hat eine Packung, die sich aufs Jahr hochrechnen lässt.",
};
