import type { Shape } from "../t";
import type * as en from "../en/site";
import type { MatchType } from "../../types";
import { countryAt } from "./client";

export const layout: Shape<typeof en.layout> = {
  skip: "Zum Inhalt springen",
};

export const header: Shape<typeof en.header> = {
  home: "SameButCheaper Startseite",
  searchPlaceholder: "Alternativen nach Marke oder Produkt suchen",
  search: "Suchen",
  check: "Produkt prüfen",
  myList: "Meine Liste",
  menu: "Menü",
  aisles: "Kategorien",
  links: {
    "/check": "Produkt prüfen (Englisch)",
    "/my-list": "Meine Sparliste (Englisch)",
    "/biggest-savings": "Größte Ersparnisse",
    "/bundles": "Sets",
    "/bulk": "Großpackungen (Englisch)",
    "/why": "Warum zu viel zahlen? (Englisch)",
    "/brands": "Nach Marke (Englisch)",
    "/how-we-verify": "So prüfen wir (Englisch)",
    "/suggest": "Alternative vorschlagen (Englisch)",
  },
  aisleShort: {
    "food-pantry": "Lebensmittel",
    household: "Haushalt",
    "skincare-personal-care": "Hautpflege",
    "beauty-hair": "Beauty",
    baby: "Baby",
    pet: "Tier",
    kitchen: "Küche",
    "tech-tools": "Technik",
    batteries: "Batterien",
    "tools-diy": "Werkzeug",
    office: "Büro",
    car: "Auto",
    garden: "Garten",
    supplements: "Nahrungsergänzung",
    "otc-medicine": "Arzneimittel",
  },
};

export const footer: Shape<typeof en.footer> = {
  about:
    "Wir finden günstigere Produkte, die denselben Zweck erfüllen wie die Markenprodukte, zeigen, was sich unterscheidet, und verlinken die Belege. Keine Marke zahlt dafür, gelistet oder weiter oben gezeigt zu werden.",
  amazon:
    "Als Amazon-Partner verdienen wir an qualifizierten Verkäufen. Das ändert nie, welche Alternativen wir zeigen oder in welcher Reihenfolge.",
  someLinks: "Manche Links sind Affiliate-Links. Das ändert nie, welche Alternativen wir zeigen oder in welcher Reihenfolge.",
  noLinks: "Derzeit bringt uns kein Link auf dieser Website etwas ein.",
  readDisclosure: "Unsere Offenlegung lesen (Englisch)",
  aisles: "Kategorien",
  links: {
    "/check": "Produkt prüfen (Englisch)",
    "/biggest-savings": "Größte Ersparnisse",
    "/bundles": "Sets",
    "/bulk": "Großpackungen (Englisch)",
    "/why": "Warum sich der Wechsel lohnt (Englisch)",
    "/brands": "Nach Marke (Englisch)",
    "/ingredients": "Nach Inhaltsstoff (Englisch)",
    "/my-list": "Meine Sparliste (Englisch)",
    "/how-we-verify": "So prüfen wir (Englisch)",
    "/suggest": "Alternative vorschlagen (Englisch)",
    "/about": "Über uns (Englisch)",
    "/credits": "Bildnachweise (Englisch)",
    "/disclosure": "Offenlegung (Englisch)",
    "/privacy": "Datenschutz",
    "/impressum": "Impressum",
  },
  affiliateDisclosure: "Affiliate-Offenlegung (Englisch)",
  privacyHref: "/datenschutz",
  bottom:
    "Preise ändern sich oft, prüf deshalb den aktuellen Preis beim Händler. Markennamen und Verpackungsdesigns gehören ihren Inhabern und dienen nur dazu, die verglichenen Produkte zu benennen. Nichts hier ist medizinische Beratung: Lies bei Arzneimitteln und Nahrungsergänzungsmitteln die Packungsbeilage oder das Etikett und frag in der Apotheke oder Arztpraxis nach.",
  pricesByCountry: "Preise nach Land",
  englishOnly: (label) => `${label} (Englisch)`,
};

export const markets: Shape<typeof en.markets> = {
  name: { US: "USA", GB: "Vereinigtes Königreich", CA: "Kanada", DE: "Deutschland", IE: "Irland" },
};

export const categories: Shape<typeof en.categories> = {
  "otc-medicine": {
    name: "Rezeptfreie Arzneimittel",
    short: "Schmerzen, Allergie, Magen, Schlaf",
    description:
      "Mittel gegen Schmerzen, Allergien und Magenbeschwerden, verglichen pro Tablette oder pro Dosis. Jeder Vergleich zeigt, was auf den Packungen steht. Frag im Zweifel in der Apotheke.",
  },
  supplements: {
    name: "Nahrungsergänzung & Vitamine",
    short: "Kreatin, Fischöl, Multivitamine",
    description: "Vitamine, Mineralstoffe und andere Nahrungsergänzungsmittel, verglichen pro Portion. Jeder Vergleich zeigt, was auf den Etiketten steht.",
  },
  "skincare-personal-care": {
    name: "Haut- & Körperpflege",
    short: "Cremes, Akne, Zähne, Rasur",
    description: "Dieselbe Art Produkt, mit Inhaltsstoffen und Wirkstoffanteilen vom Etikett.",
  },
  "beauty-hair": {
    name: "Beauty & Haare",
    short: "Haarpflege, Make-up-Entferner, Lippen",
    description: "Dieselbe Art Produkt, mit beiden Inhaltsstofflisten nebeneinander. Keine Duftzwillinge.",
  },
  household: {
    name: "Haushalt & Reinigung",
    short: "Wäsche, Geschirr, Papier, Putzen",
    description:
      "Waschmittel, Spülmittel, Papier und Reiniger, verglichen pro Waschgang, pro Blatt oder pro Liter, mit Testergebnissen, wo es welche gibt.",
  },
  baby: {
    name: "Baby",
    short: "Säuglingsnahrung und Hautpflege",
    description:
      "Dieselbe Art Produkt, verglichen pro Einheit. Sprich mit deiner Ärztin, deinem Arzt oder deiner Hebamme, bevor du die Säuglingsnahrung wechselst.",
  },
  pet: {
    name: "Tier",
    short: "Futter, Katzenstreu, Floh- und Zeckenschutz",
    description: "Dieselbe Art Futter oder Behandlung, verglichen pro Kilo oder pro Dosis. Frag im Zweifel in der Tierarztpraxis.",
  },
  "food-pantry": {
    name: "Lebensmittel & Vorrat",
    short: "Grundnahrungsmittel, Süßes, Getränke",
    description: "Eigenmarken neben dem Markenprodukt, verglichen pro 100 g oder pro Liter, mit Geschmackstests, wo es welche gibt.",
  },
  "tech-tools": {
    name: "Technik-Zubehör",
    short: "Ladegeräte, Kabel, Tastaturen",
    description: "Ladegeräte, Kabel, Speicher und Tastaturen, verglichen pro Stück, mit Labortests, wo es welche gibt.",
  },
  kitchen: {
    name: "Küche",
    short: "Folie, Beutel, Filter, Wasserkocher",
    description: "Alufolie, Frischhaltefolie, Beutel und Grundausstattung, verglichen pro Meter oder pro Stück, mit Testergebnissen, wo es welche gibt.",
  },
  batteries: {
    name: "Batterien",
    short: "AA, AAA, Knopfzellen, Akkus",
    description: "AA, AAA, Knopfzellen und Akkus, verglichen pro Batterie, mit Testergebnissen, wo es welche gibt.",
  },
  "tools-diy": {
    name: "Werkzeug & Heimwerken",
    short: "Handwerkzeug, Kleber, Dichtmasse, Handschuhe",
    description: "Handwerkzeug, Kleber, Dichtmasse und Handschuhe, verglichen pro Stück, mit Testergebnissen, wo es welche gibt.",
  },
  office: {
    name: "Büro & Schule",
    short: "Papier, Stifte, Tinte, Etiketten",
    description: "Papier, Stifte, Tinte und Etiketten, verglichen pro Blatt oder pro Stück.",
  },
  car: {
    name: "Auto",
    short: "Scheibenreiniger, Wischer, Autopflege",
    description: "Flüssigkeiten und Autopflege, verglichen pro Liter oder pro Stück, mit Ergebnissen aus Vergleichstests, wo es welche gibt.",
  },
  garden: {
    name: "Garten",
    short: "Erde, Dünger, Schläuche, Gartenscheren",
    description: "Dieselbe Art Produkt, verglichen pro Liter oder pro Stück, mit Testergebnissen, wo es welche gibt.",
  },
};

export const lists: Shape<typeof en.lists> = {
  home: "Startseite",
  breadcrumb: "Navigationspfad",
  howWeCheck: "So prüfen wir (Englisch)",
  photos: "Bildnachweise (Englisch)",
  averageSaving: "Durchschnittliche Ersparnis",
  pricesChecked: (month) => `Preise zuletzt im ${month} geprüft.`,
  biggestSaving: "größte Ersparnis",
  upTo: (n) => `Bis zu ${n} % günstiger pro Einheit`,
  noneHere: (country) => `Für keinen dieser Vergleiche haben wir bisher einen Preis bei einem Händler erfasst, der ${countryAt(country)} verkauft.`,
  noneHereMore: (more, country) =>
    ` Die ${more}, die wir anderswo erfasst haben, findest du oben auf der Seite unter „Vergleiche aus anderen Ländern zeigen“. Jeder sagt, worauf du in Geschäften ${countryAt(country)} achten kannst.`,
  category: {
    notFound: "Kategorie nicht gefunden",
    cheaper: (name) => `${name} günstiger`,
    metaTitle: (name, count) => (count ? `${name} günstiger: ${count} Alternativen zu Markenprodukten` : `${name} günstiger`),
    metaLead: (name, count) => `${count} günstigere Alternativen zu Markenprodukten in der Kategorie „${name}“, pro Einheit verglichen und mit Quellen belegt.`,
    emptyTitle: "In dieser Kategorie haben wir noch keine Vergleiche geprüft.",
    emptyBody: "Sag uns, was du hier kaufst, und wir sehen es uns an. Oder schau in eine andere Kategorie.",
    suggest: "Alternative vorschlagen (Englisch)",
  },
  biggest: {
    title: "Größte Ersparnisse",
    intro: (sources) => `Alle Vergleiche, die wir geprüft haben, mit der größten Ersparnis pro Einheit zuerst. ${sources} Quellen belegen sie.`,
    metaTitle: "Größte Ersparnisse: alle Vergleiche nach Ersparnis sortiert",
    metaDescription: "Jede günstigere Alternative zu einem Markenprodukt in unserem Katalog, sortiert danach, wie viel du pro Einheit sparst.",
  },
};

export const bundlesPage: Shape<typeof en.bundlesPage> = {
  metaTitle: "Einkaufskörbe und Marken-Sets, auf beide Arten berechnet",
  metaDescription:
    "Ganze Einkaufskörbe und Marken-Sets, nachgebaut aus günstigeren Produkten. Beide Summen kaufen dieselbe Menge, und jeder Artikel verlinkt auf das, was uns dazu vorliegt.",
  both: "Einkaufskörbe und Marken-Sets",
  kitsOnly: "Marken-Sets",
  none: "Noch ist keines gelistet. Die einzelnen Vergleiche sind fertig, und wenn dir ein Set zu teuer ist, sag uns, welches.",
  seeBiggest: "Die größten Ersparnisse ansehen",
  suggestKit: "Set vorschlagen (Englisch)",
  baskets: (n) => ` ${n === 1 ? "Einkaufskorb" : "Einkaufskörbe"} für einen Lebensabschnitt, zusammengestellt aus Vergleichen, die wir geprüft haben. Beide Summen kaufen dieselbe Menge. `,
  kits: (n) => ` ${n === 1 ? "Marken-Set" : "Marken-Sets"}, zerlegt und Stück für Stück aus günstigeren Artikeln nachgebaut.`,
  onThisPage: "Auf dieser Seite",
  basketsJump: "Einkaufskörbe",
  aisleKits: (aisle) => `Sets: ${aisle}`,
  pricedIn: (market) => `Einkaufskörbe mit Preisen ${market}`,
  kitsHeading: "Marken-Sets, aus günstigeren Artikeln nachgebaut",
  kitsIntro:
    "Marken verkaufen Pflegeserien, Kombipacks und Geschenksets zu einem Preis. Wir stellen jedem Teil ein günstigeres Produkt gegenüber und rechnen dieselbe Menge zusammen.",
};

export const subscribe: Shape<typeof en.subscribe> = {
  thanks: "Danke!",
  validEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
  tooMany: "Das waren viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten.",
  notOpen: "Anmeldungen sind noch nicht geöffnet. Bitte schau bald wieder vorbei.",
  almost: "Fast geschafft. Wir haben dir eine E-Mail geschickt: Klick auf den Link darin, um zu bestätigen.",
  onList: "Du stehst auf der Liste. Wir schreiben dir einmal zur Bestätigung, bevor wir zum ersten Mal etwas schicken.",
  wrong: "Etwas ist schiefgelaufen. Bitte versuch es noch einmal.",
};

export const notFound: Shape<typeof en.notFound> = {
  title: "Diese Seite haben wir nicht gefunden",
  body: "Vielleicht ist der Vergleich umgezogen, oder wir haben ihn noch nicht geprüft.",
  search: "Vergleiche durchsuchen (Englisch)",
  suggest: "Einen vorschlagen (Englisch)",
};

export const home: Shape<typeof en.home> = {
  metaTitle: "SameButCheaper: Macht dasselbe. Kostet weniger.",
  metaDescription:
    "Günstigere Produkte, die denselben Zweck erfüllen wie Markenprodukte, von Lebensmitteln und Putzmitteln bis Baby, Tier und Technik. Pro Einheit verglichen, mit Quellen und einer ehrlichen Liste der Unterschiede.",
  h1: "Macht dasselbe. Kostet weniger.",
  swapsSources: (n) => ` ${n === 1 ? "Vergleich" : "Vergleiche"}, jeder mit mindestens zwei Quellen`,
  typically: ", meist ",
  cheaperPerUnit: " günstiger pro Einheit.",
  noBrandPays: "Keine Marke zahlt dafür, gelistet zu werden.",
  someEarn: "Manche Links bringen uns eine Provision.",
  noneEarn: "Derzeit bringt uns kein Link etwas ein.",
  howWeCheck: "So prüfen wir (Englisch)",
  cta: "Füg deine Einkaufsliste ein. Sieh, was du im Jahr sparst.",
  ctaSub: "Eine Liste oder ein Kassenbon: Wir ordnen zu, was wir können, und fragen beim Rest nach. Die Seite ist auf Englisch.",
  basket: "Den ganzen Einkauf umstellen",
  biggest: "Größte Ersparnisse",
  allSwaps: "Alle Vergleiche",
  photos: "Bildnachweise (Englisch)",
  why: "Warum sich der Wechsel lohnt",
  allFindings: "Alle Belege (Englisch)",
  bulk: "Großpackungen",
  bulkBody:
    "Eine größere Packung spart nur Geld, wenn sie pro Einheit günstiger ist und du sie aufbrauchst, bevor sie verdirbt. Die Angaben gelten für ungeöffnete Packungen.",
  allBulk: "Alle Großpackungen (Englisch)",
  allShelfLives: "Alle Haltbarkeiten mit Quellen (Englisch)",
  columns: {
    stock_up: ["Vorrat anlegen", "Hält jahrelang, eine große Packung ist also kein Risiko."],
    buy_to_use: ["Nach Bedarf kaufen", "Als Großpackung in Ordnung, wenn du sie rechtzeitig aufbrauchst."],
    buy_small: ["Klein kaufen", "Verdirbt oder lässt nach, also lieber keine Großpackung."],
  },
  allAisles: "Alle Kategorien",
  tileSwaps: (n) => ` ${n === 1 ? "Vergleich" : "Vergleiche"}, bis zu `,
  tileCheaper: " günstiger",
  email: "Neue Vergleiche per E-Mail",
  questions: "Häufige Fragen",
  missing: "Kennst du einen Vergleich, der hier fehlt?",
  suggestIt: "Schlag ihn vor (Englisch)",
  faq: (aisles, earns) => {
    const list = aisles.length > 1 ? `${aisles.slice(0, -1).join(", ")} und ${aisles[aisles.length - 1]}` : aisles.join("");
    return [
      {
        q: "Was vergleicht ihr?",
        a: `Alltagsprodukte, bei denen du für denselben Zweck weniger zahlen kannst. Derzeit sind das ${list}. Wir vergleichen die Preise pro Einheit, damit sich große und kleine Packungen fair beurteilen lassen.`,
      },
      {
        q: "Wenn zwei Produkte denselben Zweck erfüllen, warum kostet eines mehr?",
        a: "Mit dem Preis einer Marke bezahlst du auch Werbung, Verpackung und ihren Platz im Regal. Manchmal ist die Marke den Aufpreis wert, und wir zeigen, wo sie besser ist.",
      },
      {
        q: "Wie entscheidet ihr, ob zwei Produkte übereinstimmen?",
        a: "Die meisten Vergleiche erfüllen einen von vier Maßstäben: gleicher Wirkstoff in gleicher Stärke, laut Etikett dieselbe Rezeptur, derselbe Hersteller oder derselbe Zweck in vergleichbarer Qualität. Bei manchen ist nichts auf beiden Seiten verglichen. Sie heißen deshalb „Gleiche Produktart“ und behaupten nicht mehr. Jeder Vergleich sagt, welcher Maßstab gilt, nennt die Unterschiede und verlinkt mindestens zwei Quellen.",
      },
      {
        q: "Soll ich die größte Packung kaufen?",
        a: "Nur wenn sie pro Einheit günstiger ist und du sie aufbrauchst, bevor sie verdirbt. Größere Packungen kosten pro Einheit meist weniger, aber nicht immer.",
      },
      {
        q: "Wie verdient ihr Geld?",
        a: `${earns ? "Manche Links sind Affiliate-Links. Wenn du darüber kaufst, bekommen wir eventuell eine kleine Provision, ohne Mehrkosten für dich." : "Derzeit gar nicht. Kein Link auf dieser Website bringt uns etwas ein."} Keine Marke und kein Händler zahlt dafür, gelistet oder weiter oben gezeigt zu werden. Die Vergleiche sind danach sortiert, wie viel du sparst, und wir zeigen auch, wo die Marke besser ist.`,
      },
      {
        q: "Sind die Preise aktuell?",
        a: "Es sind übliche Regalpreise aus dem Monat, der bei jedem Vergleich steht, und sie ändern sich oft. Prüf den Preis vor dem Kauf beim Händler.",
      },
      {
        q: "Ist das hier medizinische Beratung?",
        a: "Nein. Lies bei Arzneimitteln und Nahrungsergänzungsmitteln die Packungsbeilage oder das Etikett und frag in der Apotheke oder Arztpraxis nach.",
      },
    ];
  },
};

const MATCH_PHRASE: [MatchType, string][] = [
  ["identical_active", "dieselben Wirkstoffe"],
  ["identical_formula", "laut Etikett dieselbe Rezeptur"],
  ["same_manufacturer", "denselben Hersteller"],
  ["equivalent_spec", "vergleichbare technische Daten oder Testergebnisse"],
];

export const match: Shape<typeof en.match> = {
  identical_active: {
    label: "Gleicher Wirkstoff",
    short: "Wirkstoffgleich",
    description: "Gleiche Wirkstoffe, gleiche Stärke, gleiche Darreichungsform, bestätigt anhand der offiziellen Packungsangaben.",
  },
  identical_formula: {
    label: "Gleiche Rezeptur laut Etikett",
    short: "Gleiche Rezeptur",
    description: "Die vollständige Zutatenliste auf dem Etikett stimmt überein, in derselben Reihenfolge.",
  },
  same_manufacturer: {
    label: "Gleicher Hersteller",
    short: "Gleicher Hersteller",
    description:
      "Öffentliche Unterlagen (Rückrufe, Behördenakten, Werkskennzeichnungen) oder eine öffentliche Aussage eines der Unternehmen zeigen, dass dieselbe Firma beide herstellt.",
  },
  equivalent_spec: {
    label: "Erfüllt denselben Zweck",
    short: "Gleicher Zweck",
    description: "Veröffentlichte technische Daten, Zertifizierungen oder unabhängige Tests zeigen, dass beide denselben Zweck in vergleichbarer Qualität erfüllen.",
  },
  same_kind: {
    label: "Gleiche Produktart",
    short: "Gleiche Art",
    description:
      "Dieselbe Art Produkt, mit Preisen aus echten Quellen. Unsere Daten zeigen nicht, dass beide bei Inhalt oder Wirkung übereinstimmen.",
  },
  sentence: (types) => {
    const phrases = MATCH_PHRASE.filter(([type]) => types.includes(type)).map(([, phrase]) => phrase);
    const list = phrases.length < 2 ? phrases.join("") : `${phrases.slice(0, -1).join(", ")} oder ${phrases[phrases.length - 1]}`;
    if (!types.includes("same_kind")) return list ? `Jede Alternative hat ${list}.` : "";
    if (!list) return "Jede ist dieselbe Art Produkt. Unsere Daten zeigen nicht, dass beide bei Inhalt oder Wirkung übereinstimmen.";
    return `Manche haben ${list}, die übrigen sind nur dieselbe Art Produkt. Jeder Vergleich sagt, was zutrifft.`;
  },
};
