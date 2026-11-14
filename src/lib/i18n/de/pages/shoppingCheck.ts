import type { Shape } from "../../t";
import type { pageShoppingCheck as en } from "../../en/pages/shoppingCheck";
import { formatPercent } from "../../format";

export const pageShoppingCheck: Shape<typeof en> = {
  emptyList: "Füg zuerst eine Liste oder einen Kassenbon ein.",
  checking: "Wir gleichen deine Liste mit dem Katalog ab…",
  failed: "Das hat nicht geklappt. Versuch es gleich noch einmal.",
  unreachable: "Wir konnten die Website nicht erreichen. Prüf deine Verbindung und versuch es noch einmal.",
  reading: "Wir lesen deinen Kassenbon…",
  unreadable: "Wir konnten das Foto nicht lesen. Tipp die Liste stattdessen ein.",
  photoWrong: "Mit dem Foto ist etwas schiefgelaufen. Versuch es noch einmal oder tipp die Liste ein.",
  label: "Deine Einkaufsliste oder dein Kassenbon",
  help: "Ein Artikel pro Zeile, so wie du ihn schreibst oder wie die Kasse ihn gedruckt hat. Preise, Summen und Bonuspunkte überspringen wir.",
  submit: "Einkauf prüfen",
  readPhoto: "Foto vom Kassenbon lesen",
  tryExample: "Beispiel ausprobieren",
  privacy: (photo) =>
    `Wir lesen deine Liste${photo ? " oder dein Foto" : ""} nur, um sie zuzuordnen, und speichern sie nicht. Wir zählen nur die Namen von Produkten, für die wir keine Alternative haben, nie Preise, damit wir wissen, was wir als Nächstes recherchieren.`,
  hiddenShared: (n) =>
    n === 1
      ? "Eine Alternative auf der geteilten Liste gibt es dort, wo du bist, nicht zu kaufen. Deshalb fehlt sie hier."
      : `${n} Alternativen auf der geteilten Liste gibt es dort, wo du bist, nicht zu kaufen. Deshalb fehlen sie hier.`,
  keepHeading: "Was du sparen würdest",
  assumes: (assumed, total, often) => {
    const which =
      assumed === total
        ? total === 1
          ? "Das setzt voraus, dass du die Markenpackung"
          : "Das setzt voraus, dass du jede Markenpackung"
        : `Bei ${assumed} der ${total} Alternativen setzt das voraus, dass du die Markenpackung`;
    return `${which} ${often} kaufst. Das können wir nicht wissen, also stell unten ein, wie oft.`;
  },
  chosen: "So oft, wie du nach eigener Angabe jede Markenpackung kaufst, zu den datierten Preisen auf der Seite jeder Alternative.",
  plusOnce: (amount, n) => `Dazu einmalig ${amount} ${n === 1 ? "für etwas, das du nur einmal kaufst" : `für ${n} Dinge, die du nur einmal kaufst`}.`,
  perAmount: (n) =>
    n === 1
      ? "Eine Alternative hat einen Preis pro Waschgang oder pro Menge, ohne Packung zum Zählen, deshalb ist sie nicht enthalten."
      : `${n} Alternativen haben einen Preis pro Waschgang oder pro Menge, ohne Packung zum Zählen, deshalb sind sie nicht enthalten.`,
  switchingThese: (n) => (n === 1 ? "Mit diesem Wechsel sparst du" : `Mit diesen ${n} Wechseln sparst du`),
  switching: "Mit dem Wechsel sparst du",
  perYear: (amount) => `${amount} im Jahr`,
  onceAmount: (amount) => `${amount} einmalig`,
  checkSuggestions: "Sieh dir die Vorschläge unten an, um zu sehen, was du sparen würdest.",
  nothingFound: "Für nichts auf deiner Liste haben wir bisher eine günstigere Alternative.",
  savedSee: "Gespeichert. Meine Liste ansehen",
  saveAll: "Alle auf meine Liste",
  linkCopied: "Link kopiert",
  copyLink: "Link zu diesem Ergebnis kopieren",
  print: "Drucken",
  copyThis: "Kopier diesen Link:",
  linkHolds: "Der Link enthält nur die Alternativen und wie oft du sie kaufst, nicht deine Liste.",
  swapsFor: (n) => (n === 1 ? "Eine Alternative für deinen Einkauf" : `${n} Alternativen für deinen Einkauf`),
  didYouMean: "Meintest du?",
  didYouMeanNote: "Diese Zeilen nennen eine Marke, die wir haben, aber wir wissen nicht, welches Produkt. Sag nur Ja, wenn du genau das kaufst.",
  couldBe: (to) => `könnte ${to} sein, {amount} weniger pro Packung`,
  yesIBuy: (product) => `Ja, ich kaufe ${product}`,
  yesThatsIt: "Ja, genau das",
  notThis: (product) => `Nein, nicht ${product}`,
  no: "Nein",
  nothingCheaper: "Noch nichts Günstigeres erfasst",
  chooseTitle: "Welches kaufst du?",
  chooseNote: "Diese Zeilen nennen eine Marke, von der wir mehr als ein Produkt haben, und nichts in der Zeile sagt, welches gemeint ist. Wähl deins aus, dann zählen wir nur dieses.",
  chooseFits: (line) => `Produkte, die zu ${line} passen`,
  chooseIBuy: (product) => `Ich kaufe ${product}`,
  chooseThis: "Dieses",
  chooseNone: "Keins davon",
  countNote: (example) =>
    `Produkte, für die wir nichts hatten, zählen wir nur unter ihrem bereinigten Namen, etwa „${example}“, damit die meistgesuchten zuerst recherchiert werden. `,
  wantSooner: "Soll es schneller gehen?",
  suggestIt: "Schlag es vor",
  own: (n) => (n === 1 ? "Eine Zeile ist schon eine Eigenmarke oder eine günstigere Wahl aus unserer Liste." : `${n} Zeilen sind schon Eigenmarken oder günstigere Produkte aus unserer Liste.`),
  skipped: (n) =>
    `Wir haben ${n === 1 ? "eine Zeile" : `${n} Zeilen`} übersprungen, die keine Produkte waren, etwa Summen, Zahlungen und Bonuspunkte.`,
  lessPer: (pack, pct) => `{amount} weniger ${pack ? `je Packung (${pack})` : "pro Packung"}, ${formatPercent(pct, "de")} günstiger`,
  moreOptions: (n) => (n === 1 ? "1 weitere Option" : `${n} weitere Optionen`),
  youBuyIt: "Du kaufst es",
  howOften: (product) => `Wie oft du ${product} kaufst`,
  assumed: "Angenommen",
  noYearly: (per) => `Preis ${per ?? "pro Menge"}, kein Betrag pro Jahr`,
  aYear: "im Jahr",
  once: "einmalig",
};
