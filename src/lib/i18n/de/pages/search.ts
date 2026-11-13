import type { Shape } from "../../t";
import type { pageSearch as en } from "../../en/pages/search";

export const pageSearch: Shape<typeof en> = {
  placeholder: "Marke, Produkt oder Inhaltsstoff",
  label: "Vergleiche nach Marke, Produkt oder Inhaltsstoff durchsuchen",
  startTyping: "Tipp los, um {n} Vergleiche zu durchsuchen.",
  didntLoad: "Die Suche wurde nicht geladen. Prüf deine Verbindung und",
  tryAgain: "versuch es noch einmal",
  looking: "Wir durchsuchen die Vergleiche.",
  results: (n) => `${n} Treffer`,
  forTerm: (term) => `für „${term}“.`,
  notChecked: (term) => `Für „${term}“ haben wir noch keine Alternative geprüft.`,
  tryBrand: "Versuch es nur mit dem Markennamen oder prüf die Schreibweise.",
  suggest: (term) => `Schlag „${term}“ vor`,
  lookInto: "und wir sehen es uns an.",
  showMore: (n) => `${n} weitere zeigen`,
  showing: (shown, total) => `${shown} von ${total}`,
};
