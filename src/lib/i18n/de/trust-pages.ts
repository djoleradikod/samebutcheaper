/**
 * The German /de/disclosure, /de/about and /de/how-we-verify (src/app/country/[country]/disclosure and the rest). They
 * say what the English pages say, from the same settings and the same catalogue, in their own words: du-form, sober.
 * Not part of the dictionary, since the English pages keep their own text; scripts/tests/i18n-de-dictionary.test.ts
 * checks these against the glossary and German typography all the same.
 *
 * {name} is a piece of the page put in by rich(): a link, mostly. A link to a page that exists only in English says so.
 */
import type { MatchType } from "../../types";

export const disclosureDe = {
  titleNone: "Offenlegung",
  titleEarns: "Affiliate-Offenlegung",
  descriptionNone: "SameButCheaper verdient derzeit an keinem seiner Links, und keine Marke und kein Händler zahlt dafür, gelistet zu werden.",
  descriptionEarns: "Wie SameButCheaper über Affiliate-Links Geld verdient.",
  noneLead: "Derzeit bringt uns kein Link auf dieser Website etwas ein.",
  noneBody: "Keiner trägt eine Affiliate-Kennung. Wenn du also zu einem Händler klickst und etwas kaufst, bekommen wir nichts davon.",
  noneChange: "Ändert sich das, sagen es diese Seite und der Hinweis neben den Links auf jedem Vergleich.",
  decidesHeading: "Was entscheidet, was wir zeigen",
  decides: [
    "Jeder Vergleich muss unsere Prüfkriterien erfüllen.",
    "Die Reihenfolge richtet sich nur nach der Ersparnis und danach, wie stark die Belege sind.",
    "Keine Marke und kein Händler kann dafür bezahlen, gelistet, bewertet oder besser platziert zu werden.",
  ],
  amazon: "SameButCheaper nimmt am Amazon-Partnerprogramm teil, einem Affiliate-Programm, über das Websites eine Werbekostenerstattung verdienen können, indem sie auf Amazon verlinken.",
  amazonLead: "Als Amazon-Partner verdienen wir an qualifizierten Verkäufen.",
  others: "Wir nehmen möglicherweise auch an Partnerprogrammen anderer Händler teil. Wenn du zu einem Händler klickst und dort etwas kaufst, bekommen wir vielleicht eine Provision. Du zahlst denselben Preis.",
  affectsHeading: "Was das beeinflusst und was nicht",
  affects: [
    "Es beeinflusst nicht, welche Vergleiche wir zeigen. Jeder Vergleich muss unsere Prüfkriterien erfüllen.",
    "Es beeinflusst nicht die Reihenfolge. Sie richtet sich nur nach der Ersparnis und danach, wie stark die Belege sind.",
    "Wir verlinken auch das Markenprodukt und zeigen beide Preise, egal welcher Link uns etwas einbringt.",
    "Keine Marke und kein Händler kann dafür bezahlen, gelistet, bewertet oder besser platziert zu werden.",
  ],
  pricesHeading: "Preise",
  prices: "Die Preise auf dieser Website sind übliche Preise aus dem Monat, der bei jedem Vergleich steht. Sie sind nicht live, und es gilt der Preis, den der Händler an der Kasse verlangt.",
};

export const aboutDe = {
  title: "Was diese Website macht",
  description: "Was SameButCheaper vergleicht, woher die Preise kommen und wie sich die Website finanziert.",
  intro: "Wir vergleichen Alltagsprodukte mit günstigeren, die dasselbe leisten, damit du siehst, welches du kaufen kannst und warum.",
  question:
    "Ein Preisvergleich zeigt, wer ein Produkt am günstigsten verkauft. Wir stellen eine andere Frage: Gibt es ein günstigeres Produkt, das dasselbe leistet? Dann zeigen wir den Grundpreis auf beiden Seiten, die Belege und was sich unterscheidet.",
  count: (pairs: number, aisles: string, markets: string) =>
    `Bisher gibt es ${pairs} Vergleiche aus den Kategorien ${aisles}, mit Preisen aus ${markets}. {baskets} fassen Vergleiche zu einem ganzen Einkauf zusammen, und Sets von Marken bauen wir Stück für Stück aus günstigeren Artikeln nach.`,
  baskets: "Einkaufskörbe",
  whyHeading: "Warum sich der Wechsel lohnen kann",
  testers: (publishers: string) => `Tests und Untersuchungen, etwa von ${publishers}, haben`,
  testersNone: "Unabhängige Tests haben",
  why: " günstigere Produkte gefunden, die in manchen Tests mit großen Marken mithalten oder sie schlagen und in anderen verlieren. Beide Arten von Ergebnissen sammeln wir mit Quellen auf {findings}, zusammen damit, wie lange sich Dinge halten, wenn du auf Vorrat kaufst.",
  findings: "der Seite mit den Ergebnissen (Englisch)",
  listedHeading: "So kommt ein Vergleich auf die Website",
  listed:
    "Wir lesen Etiketten, Zutatenlisten und Datenblätter, suchen nach unabhängigen Tests und verlinken mindestens zwei Quellen. Jeder Vergleich sagt, welche unserer {standards} er erfüllt. Wo die Marke besser ist, steht das auch dort.",
  standards: "Prüfkriterien",
  health:
    "Auch Arzneimittel und Nahrungsergänzungsmittel sind dabei, mit einem Gesundheitshinweis auf diesen Seiten. Nichts hier ist medizinische Beratung: Lies die Packungsbeilage oder das Etikett und frag in der Apotheke oder Arztpraxis nach.",
  pricesHeading: "Woher die Preise kommen",
  prices:
    "Preise tragen ein Datum. Sie stammen aus Regalpreisen, die Menschen in {openPrices} erfasst haben, einem Projekt von Open Food Facts, dessen Daten unter der {odbl} stehen, aus den Produktseiten der Händler und aus veröffentlichten Tests. Preise ändern sich, prüf deshalb vor dem Kauf beim Händler. {more}.",
  odbl: "Open Database Licence (ODbL)",
  more: "Mehr zu Preisen",
  photos: "Produktfotos stammen aus offenen Datenbanken wie Open Food Facts, und jedes steht auf der {credits}.",
  credits: "Seite mit den Bildnachweisen (Englisch)",
  fundedHeading: "Wie wir uns finanzieren",
  fundedEarns: "Manche Links sind Affiliate-Links. Wenn du über einen davon kaufst, zahlt uns der Händler vielleicht eine kleine Provision, ohne Mehrkosten für dich.",
  fundedNone: "Derzeit finanziert nichts diese Website: Kein Link bringt uns etwas ein.",
  funded: " Keine Marke und kein Händler zahlt dafür, gelistet oder besser platziert zu werden. Vergleiche werden danach sortiert, wie viel du sparst und wie stark die Belege sind. Mehr dazu in der {disclosure}.",
  disclosureEarns: "Affiliate-Offenlegung",
  disclosureNone: "Offenlegung",
  wrongHeading: "Wenn wir etwas falsch machen",
  wrong: "Sag es uns über das {suggest}, mit einem Link zu deinen Belegen. Wir prüfen es und korrigieren den Vergleich.",
  suggest: "Vorschlagsformular (Englisch)",
};

export const verifyDe = {
  title: "So prüfen wir jeden Vergleich",
  description: "Die Kriterien hinter jedem Vergleich, woher unsere Preise kommen, wie wir die Ersparnis rechnen und was wir weglassen.",
  intro: (pairs: number, aisles: number) =>
    `Jeder Vergleich trägt eine Kennzeichnung, wie weit seine Belege reichen, nennt, was sich unterscheidet, und verlinkt mindestens zwei Quellen. Heute sind es ${pairs} Vergleiche in ${aisles} Kategorien.`,
  labelsHeading: "Was jede Kennzeichnung bedeutet",
  count: (n: number) => (n === 1 ? "1 Vergleich" : `${n} Vergleiche`),
  standards: {
    equivalent_spec:
      "Für Dinge, die eine Aufgabe erfüllen, etwa Batterien, Ladegeräte, Kabel, Folie, Waschmittel und viele Lebensmittel. Wir vergleichen veröffentlichte Spezifikationen, Güteklassen, Zertifizierungen und Zutatenlisten und suchen nach unabhängigen Tests.",
    identical_formula:
      "Für Lebensmittel, Kosmetik und Körperpflege. Wir vergleichen die vollständige Zutatenliste auf beiden Etiketten. Die Zutaten stehen in absteigender Menge, dieselbe Liste in derselben Reihenfolge deutet also auf dieselbe Rezeptur hin. Ein ausgetauschter oder fehlender Inhaltsstoff schließt das Paar aus.",
    same_manufacturer:
      "Wir akzeptieren nur öffentliche Belege, die du selbst prüfen kannst: Rückrufe, die beide Marken nennen, behördliche Unterlagen, Betriebs- oder Registriernummern oder eine Aussage des Händlers oder Herstellers. Gerüchte aus Foren und „das weiß doch jeder“ zählen nicht.",
    identical_active:
      "Für Hautpflege, Haarpflege, Mittel für Haustiere, Nahrungsergänzungsmittel und rezeptfreie Arzneimittel. Wir lesen die Angaben auf beiden Etiketten, vom Hersteller oder aus einer öffentlichen Etikettendatenbank. Wirkstoff, Menge pro Dosis und Darreichungsform müssen übereinstimmen.",
    same_kind:
      "Die schwächste Kennzeichnung, und das sagen wir auch. Beide sind dieselbe Art von Produkt, mit Preisen aus echten Quellen, aber was wir haben, zeigt nicht, dass sie beim Inhalt oder in der Wirkung übereinstimmen. Es ist also eine günstigere Möglichkeit zum Ausprobieren, keine belegte Entsprechung. Jeder Vergleich, bei dem nichts auf beiden Seiten verglichen wurde, bekommt diese Kennzeichnung automatisch.",
  } satisfies Record<MatchType, string>,
  sureHeading: "Wie sicher wir sind",
  high: ": Wir haben beide Produkte aus Primärquellen bestätigt, etwa dem Etikett, dem Hersteller oder einer öffentlichen Datenbank.",
  medium:
    ": Die Übereinstimmung ist gut belegt, aber mindestens ein Detail stammt aus einer verlässlichen Sekundärquelle, etwa einem großen unabhängigen Test. Der Vergleich sagt, welches.",
  weaker: "Alles, was schwächer belegt ist, nehmen wir nicht auf.",
  pricesHeading: "Woher die Preise kommen",
  pricesIntro: "Jeder Preis trägt ein Datum, das beim Vergleich steht. Die Preise stammen aus drei Quellen:",
  openPricesLead: "Regalpreise aus Open Prices.",
  openPrices: "Menschen erfassen, was sie in einem Geschäft gesehen haben, mit Datum und Geschäft. {openPrices} ist ein Projekt von Open Food Facts, und seine Daten stehen unter der {odbl}. Dank an alle, die dazu beitragen.",
  storesLead: "Händlerseiten.",
  stores: "Preis und Packungsgröße auf der Produktseite des Händlers, an dem Tag, an dem wir nachgesehen haben.",
  testsLead: "Veröffentlichte Tests.",
  tests: "Der Preis, den ein Test angibt, mit dem Datum des Tests.",
  checkPrice: "Preise ändern sich oft, prüf deshalb vor dem Kauf den Preis beim Händler.",
  savingHeading: "So rechnen wir die Ersparnis",
  unitPrice:
    "Wir vergleichen den {unitPrice}, etwa pro 100 g, pro Waschladung, pro Blatt oder pro Tablette, damit sich eine große und eine kleine Packung fair vergleichen lassen. Die Ersparnis pro Packung ist das, was du sparst, wenn du dieselbe Menge kaufst wie in einer Packung der Marke.",
  unitPriceWord: "Grundpreis",
  basket:
    "Ein {basket} rechnet seine Vergleiche genauso zusammen. Beide Summen kaufen dieselbe Menge, mit den datierten Grundpreisen jedes Vergleichs. Die günstigere Packung kann eine andere Größe haben, an der Kasse kann der Betrag also abweichen.",
  basketWord: "Einkaufskorb",
  bulk: "Beim Kauf auf Vorrat zeigen wir, wie viel von der günstigeren Packung du verbrauchen musst, bevor sie sich lohnt, und {keeps}, mit Quellen.",
  keeps: "wie lange sich das Produkt hält (Englisch)",
  brandHeading: "Wo die Marke gewinnt",
  brand:
    "Derselbe Wirkstoff oder dieselbe Spezifikation macht zwei Produkte nicht in jeder Hinsicht gleich. Hilfsstoffe, Geschmack, Überzüge, Packungsgrößen und Garantien können sich unterscheiden, und manchmal ist die Marke besser. Jeder Vergleich sagt das ausdrücklich, und {lost} sammelt die Tests, die anders ausgingen.",
  lost: "„Wo die günstige Wahl verloren hat“ (Englisch)",
  leaveHeading: "Was wir weglassen",
  leave: [
    "Duft- oder Optik-Kopien („Dupes“), etwa Parfum-Nachahmungen",
    "Fälschungen und Verkäufer, die für gefälschte Angebote bekannt sind",
    "Verschreibungspflichtige Arzneimittel, außer Parasitenmitteln für Haustiere, die wir deutlich kennzeichnen",
    "Alles, was nur durch Erfahrungsberichte oder Bewertungen gestützt ist",
  ],
  rankHeading: "Reihenfolge und Fotos",
  rank: "Vergleiche werden danach sortiert, wie viel du sparst und wie stark die Belege sind. Keine Marke und kein Händler zahlt dafür, gelistet oder besser platziert zu werden.",
  rankEarns: " Manche Links sind {affiliate}.",
  affiliate: "Affiliate-Links",
  rankNone: " Derzeit bringt uns kein Link etwas ein, wie unsere {disclosure} sagt.",
  disclosure: "Offenlegung",
  photos:
    "Produktfotos stammen aus offenen Datenbanken wie Open Food Facts, und jedes steht mit seiner Lizenz auf der {credits}. Wo wir kein Foto verwenden können, drucken wir den Namen auf eine schlichte Kachel und sagen das. Bei vielen Fotos ist der Hintergrund entfernt oder die Packung gerade gerückt, und der Nachweis sagt, bei welchen.",
  credits: "Seite mit den Bildnachweisen (Englisch)",
  mistakeHeading: "Einen Fehler gefunden?",
  mistake: "Nutze das {suggest} und füge einen Link zu deinen Belegen bei. Wir prüfen es und korrigieren den Vergleich.",
  suggest: "Vorschlagsformular (Englisch)",
};
