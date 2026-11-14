import type { Shape } from "../t";
import type * as en from "../en/tools";

export const checkPage: Shape<typeof en.checkPage> = {
  metaTitle: "Produkt prüfen: Inhaltsstoffe, Anwendung und günstigere Alternativen",
  metaDescription:
    "Such nach einem Produktnamen, scanne den Barcode oder fotografiere das Etikett. Sieh, was drin ist, wofür es gedacht ist und welche günstigeren Produkte in dein Land geliefert werden, jeweils mit dem, worin sie übereinstimmen.",
  eyebrow: "Produkt prüfen",
  h1: "Was drin ist, wofür es gedacht ist und was weniger kostet",
  intro:
    "Gib ein Produkt ein, scanne den Barcode oder fotografiere das Etikett. Wir lesen die offiziellen Etikettdaten und zeigen günstigere Produkte von Händlern, die zu dir liefern, jeweils mit dem, worin sie übereinstimmen.",
  listLink: "Eine ganze Einkaufsliste oder ein Kassenbon? Prüf alles auf einmal",
  tooMany: "Das waren viele Prüfungen in kurzer Zeit.",
  tooManyBody: "Warte eine Minute und versuch es dann noch einmal.",
  inDatabases: "Dasselbe Produkt in Etikett-Datenbanken",
  inCatalogue: "Vergleiche, die schon in unserem Katalog sind",
  pick: "Wähl dein Produkt, um zu sehen, was drin ist",
  resultsFor: (q) => `Treffer für „${q}“ aus öffentlichen Etikett-Datenbanken.`,
  failed: (sources) => `Manche Datenbanken haben gerade nicht geantwortet (${sources}). Versuch es in einer Minute noch einmal, um mehr Treffer zu bekommen.`,
  thatProduct: "dieses Produkt",
  barcode: (digits) => `den Barcode ${digits}`,
  quoted: (q) => `„${q}“`,
  invalid: (what) => `${what} ist keine gültige Barcode-Nummer.`,
  notFound: (what) => `Wir haben ${what} nicht gefunden.`,
  checkDigits: "Prüf die Ziffern unter dem Barcode oder such nach dem Produktnamen.",
  notInDatabases: "Er ist noch nicht in den offenen Etikett-Datenbanken. Such stattdessen nach dem Produktnamen oder fotografiere das Etikett, damit wir es lesen können.",
  tryName: "Versuch es mit Marke und Produktname, wie sie auf der Packung stehen, zum Beispiel „Nurofen 400 mg“ oder „Nivea Creme“.",
  tellUs: "Sag uns, wonach du gesucht hast",
  wellResearch: "und wir recherchieren es.",
  steps: () => [
    { title: "Suchen, scannen oder fotografieren", text: "Gib den Namen ein, scanne den Barcode oder fotografiere das Etikett. Barcodes werden auf deinem Handy gelesen." },
    { title: "Wir lesen das offizielle Etikett", text: "US-Arzneimitteletiketten der FDA, die Etikett-Datenbank der NIH für Nahrungsergänzungsmittel und die offenen Datenbanken für Kosmetik und Lebensmittel." },
    { title: "Sieh, was wirklich drin ist", text: "Wirkstoffe und Stärken, wofür es gedacht ist, wie man es anwendet und die wichtigsten Warnhinweise." },
    {
      title: "Finde, was weniger kostet",
      text: "Vergleiche aus unserem Katalog, Eigenmarken mit denselben Wirkstoffen laut Etikett und Händler, die in dein Land liefern.",
    },
  ],
  tryOne: "Probier eins aus:",
  onPhone: "Auf dem Handy öffnet „Barcode scannen“ deine Kamera.",
  checking: "Wir durchsuchen die Etikett-Datenbanken",
  yourProduct: "Dein Produkt",
};

export const checkList: Shape<typeof en.checkList> = {
  metaTitle: "Einkauf prüfen: was dir ein Wechsel im Jahr spart",
  metaDescription:
    "Füg eine Einkaufsliste oder einen Kassenbon ein. Sieh, für welche deiner Marken es ein günstigeres Produkt für denselben Zweck gibt und was dir der Wechsel im Jahr spart.",
  crumb: "Produkt prüfen",
  here: "/ Dein Einkauf",
  h1: "Füg deine Einkaufsliste ein. Sieh, was du im Jahr sparst.",
  intro:
    "Füg eine Liste oder den Text eines Kassenbons ein. Wir ordnen jeder Marke ein günstigeres Produkt für denselben Zweck zu, von Händlern, die bei dir verkaufen, und rechnen zusammen, was der Wechsel spart. Wenn wir nicht erkennen, welches Produkt eine Zeile meint, fragen wir nach.",
};

export const listErrors: Shape<typeof en.listErrors> = {
  browser: "Das funktioniert im Browser.",
  tooMany: "Das waren viele Listen in kurzer Zeit. Warte ein paar Minuten und versuch es dann noch einmal.",
  tooLong: (max) => `Das ist länger, als wir auf einmal lesen. Füg bis zu ${max.toLocaleString("de-DE")} Zeichen ein.`,
  sendText: "Schick die Liste als Text.",
  empty: "Füg zuerst eine Liste oder einen Kassenbon ein.",
  photoOff: "Das Lesen von Fotos ist noch nicht eingeschaltet.",
  tooManyPhotos: "Das waren viele Fotos. Versuch es in ein paar Minuten noch einmal.",
  tooLarge: "Das Foto ist zu groß. Nimm eines unter 5 MB.",
  sendForm: "Schick das Foto als Formular-Upload.",
  noPhoto: "Kein Foto angekommen.",
  photoType: "Nimm ein Foto im Format JPEG, PNG oder WebP.",
  unreadable: "Wir konnten das Foto nicht lesen. Tipp die Liste stattdessen ein.",
};

export const myListPage: Shape<typeof en.myListPage> = {
  metaTitle: "Meine Sparliste",
  metaDescription: "Rechne zusammen, was dir der Wechsel zu den günstigeren Produkten spart.",
  h1: "Meine Sparliste",
  intro: "Die Vergleiche, die du gespeichert hast, und was der Wechsel zusammen ausmacht.",
  detail: (subcategory, pack) => `${subcategory}, pro Packung mit ${pack}`,
  cheaperItems: (n) => `${n} günstigere Artikel`,
};

export const searchPage: Shape<typeof en.searchPage> = {
  metaTitle: "Vergleiche durchsuchen",
  metaDescription: "Günstigere Alternativen nach Marke, Produkt oder Inhaltsstoff suchen.",
  h1: "Günstiger finden",
  intro: "Gib die Marke ein, die du sonst kaufst. Wir zeigen dir das günstigere Produkt für denselben Zweck.",
  brands: "Marken mit den meisten Vergleichen",
  aisles: "Oder stöbere in einer Kategorie",
};

export const report: Shape<typeof en.report> = {
  kind: {
    medicine: "Rezeptfreies Arzneimittel",
    supplement: "Nahrungsergänzungsmittel",
    cosmetic: "Körperpflege",
    food: "Lebensmittel",
    pet: "Tiernahrung",
    other: "Produkt",
  },
  madeFor: (maker) => `Hergestellt für ${maker}`,
  barcode: (upc) => `Barcode ${upc}`,
  onSale: (countries) => `Laut Datenbank im Handel in: ${countries}`,
  whatFor: "Wofür es gedacht ist",
  doesntSay: "Die Etikettdaten sagen dazu nichts.",
  whatsIn: "Was drin ist",
  amountMissing: "Menge nicht angegeben",
  noIngredients: "Die Daten, die wir haben, enthalten keine Zutatenliste.",
  inactive: "Sonstige Bestandteile",
  fullList: "Vollständige Zutatenliste",
  howToUse: "Anwendung",
  warnings: "Wichtigste Warnhinweise",
  readFull: (host) => `Den vollständigen Eintrag auf ${host} lesen`,
  cheaper: "Günstigere Optionen",
  compared: "Vergleiche, die wir mit diesem Produkt angestellt haben",
  eachSays: "Jeder sagt, worin er übereinstimmt und was sich unterscheidet.",
  sameKind: "Dieselbe Art Produkt, günstiger",
  sameKindNote: "Unsere Daten zeigen nicht, dass diese bei Inhalt oder Wirkung übereinstimmen.",
  sameActive: "Günstigere wirkstoffgleiche Produkte aus unserem Katalog",
  bundles: "Sets dieser Marke, günstiger nachgebaut",
  noteActives:
    "Such eine Marke, die genau diese Wirkstoffe in derselben Stärke angibt. Darreichungsform und sonstige Bestandteile können sich trotzdem unterscheiden, und die Regeln für Arzneimittel sind von Land zu Land verschieden. Frag im Zweifel in der Apotheke.",
  noteFirstFive: (list) =>
    `Tipp: Produkte, deren erste fünf Zutaten (${list}) in derselben Reihenfolge übereinstimmen, sind sich in der Rezeptur meist ähnlich. Zutaten stehen nach Menge geordnet, die größte zuerst.`,
  noteStore: "Eigenmarken sind meist am günstigsten. Vergleich das Etikett und den Preis pro Einheit.",
  usLabel: "Dieselben Wirkstoffe laut offiziellem US-Etikett",
  usLabelNote: "Aus den Etikettdaten der FDA: dieselben Wirkstoffe, dieselbe Stärke, dieselbe Darreichungsform. Eigenmarken sind meist am günstigsten.",
  storeBrand: (name) => `Eigenmarke: ${name}`,
  label: "Etikett",
  noMatch: "Für dieses Produkt haben wir noch keine günstigere Alternative mit Preisen. Wir zählen jede Suche, und die meistgesuchten Produkte recherchieren wir zuerst.",
  knowMatch: "Du kennst eine Alternative? Sag es uns",
  fda: "Etikettdaten von openFDA und DailyMed (U.S. National Library of Medicine). ",
  dsld: "Etikettdaten aus der Label Database des NIH Office of Dietary Supplements. ",
  odbl: (source) => `Daten von ${source}, verfügbar unter der Open Database License. `,
  photo: "Aus deinem Foto gelesen, vergleich es also mit der Packung. ",
  notAdvice: "Das sind Angaben vom Etikett, keine medizinische Beratung. Lies immer das Etikett und frag im Zweifel in der Apotheke oder Arztpraxis nach.",
};
