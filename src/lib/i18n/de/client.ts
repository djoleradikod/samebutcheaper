import type { Shape } from "../t";
import type * as en from "../en/client";
import type { CategorySlug, MatchType } from "../../types";
import { dateDe, formatNumber } from "../format";
import { unitLabelDe } from "../units";
import { rate } from "../../localize";
import { money, type Currency } from "../../format";
import fx from "../../../../data/fx/ecb-reference-rates.json";

/**
 * A country in German grammar: its name, "in X" (where something is), "nach X" (where something goes) and "aus X"
 * (where it comes from). Most countries take no article; those that do ("die USA", "die Schweiz") are spelled out.
 */
type CountryDe = [name: string, at: string, to: string, from: string];
const plain = (name: string): CountryDe => [name, `in ${name}`, `nach ${name}`, `aus ${name}`];
const COUNTRY_DE: Record<string, CountryDe> = {
  US: ["USA", "in den USA", "in die USA", "aus den USA"],
  CA: plain("Kanada"),
  GB: ["Vereinigtes Königreich", "im Vereinigten Königreich", "ins Vereinigte Königreich", "aus dem Vereinigten Königreich"],
  DE: plain("Deutschland"),
  IE: plain("Irland"),
  AT: plain("Österreich"),
  CH: ["Schweiz", "in der Schweiz", "in die Schweiz", "aus der Schweiz"],
  FR: plain("Frankreich"),
  BE: plain("Belgien"),
  NL: ["Niederlande", "in den Niederlanden", "in die Niederlande", "aus den Niederlanden"],
  LU: plain("Luxemburg"),
  IT: plain("Italien"),
  ES: plain("Spanien"),
  PT: plain("Portugal"),
  SE: plain("Schweden"),
  PL: plain("Polen"),
  DK: plain("Dänemark"),
  FI: plain("Finnland"),
  NO: plain("Norwegen"),
  CZ: plain("Tschechien"),
  SK: ["Slowakei", "in der Slowakei", "in die Slowakei", "aus der Slowakei"],
  HU: plain("Ungarn"),
  SI: plain("Slowenien"),
  HR: plain("Kroatien"),
  RO: plain("Rumänien"),
  BG: plain("Bulgarien"),
  GR: plain("Griechenland"),
  RS: plain("Serbien"),
  BA: plain("Bosnien und Herzegowina"),
  ME: plain("Montenegro"),
  MK: plain("Nordmazedonien"),
  AL: plain("Albanien"),
  UA: ["Ukraine", "in der Ukraine", "in die Ukraine", "aus der Ukraine"],
  TR: ["Türkei", "in der Türkei", "in die Türkei", "aus der Türkei"],
  IL: plain("Israel"),
  AE: ["Vereinigte Arabische Emirate", "in den Vereinigten Arabischen Emiraten", "in die Vereinigten Arabischen Emirate", "aus den Vereinigten Arabischen Emiraten"],
  SA: plain("Saudi-Arabien"),
  IN: plain("Indien"),
  JP: plain("Japan"),
  SG: plain("Singapur"),
  PH: ["Philippinen", "auf den Philippinen", "auf die Philippinen", "von den Philippinen"],
  MY: plain("Malaysia"),
  AU: plain("Australien"),
  NZ: plain("Neuseeland"),
  MX: plain("Mexiko"),
  BR: plain("Brasilien"),
  AR: plain("Argentinien"),
  ZA: plain("Südafrika"),
};
const c = (code: string) => COUNTRY_DE[code] ?? plain(code);
const at = (code: string) => c(code)[1];
const to = (code: string) => c(code)[2];
/** "nach Irland", "in die USA". */
export const countryTo = to;
/** "in Irland", "in den USA". */
export const countryAt = at;
const from = (code: string) => c(code)[3];

/** "britische Preise": a market's prices, nominative plural. */
const PRICES_ADJ: Record<string, string> = { US: "US-Preise", GB: "Britische Preise", CA: "Kanadische Preise", DE: "Deutsche Preise", IE: "Irische Preise" };
const PRICES_ADJ_INLINE: Record<string, string> = { US: "US-Preise", GB: "britische Preise", CA: "kanadische Preise", DE: "deutsche Preise", IE: "irische Preise" };

const CURRENCY_DE: Partial<Record<Currency, string>> = {
  EUR: "Euro",
  GBP: "Pfund",
  USD: "US-Dollar",
  CAD: "kanadischen Dollar",
  CHF: "Schweizer Franken",
};

/** "1 £ = 1,20 €", at the committed ECB rate. */
const rateTextDe = (f: Currency, t: Currency) => `${money(1, f, "de").replace(/,00(?=\s)/, "")} = ${money(rate(f, t), t, "de")}`;

export const shared: Shape<typeof en.shared> = {
  about: "etwa",
  delivery: {
    home: (fee, freeOver, pickup) => `Versand ${fee} bei Einzelbestellung, ab ${freeOver} versandkostenfrei${pickup ? ", oder kostenlos im Markt abholen" : ""}`,
    notChecked: (dest) => `Versand ${to(dest)} nicht geprüft`,
    free: (dest) => `Versand ${to(dest)} bei dieser Bestellung kostenlos`,
    abroad: (dest, fee, freeOver) => `Versand ${to(dest)} ${fee} bei Einzelbestellung${freeOver ? `, ab ${freeOver} kostenlos` : ""}`,
  },
  pharmacy: "Die meisten Arzneimittel gibt es dort nur in der Apotheke, auch online nur bei Apotheken.",
  onAmazon: "bei Amazon",
  atStore: (store) => `bei ${store}`,
  theStore: "beim Händler",
};

export const picker: Shape<typeof en.picker> = {
  country: "Land",
  label: "Land, in dem du einkaufst",
  choose: "Wähle dein Land",
  name: (code, english) => COUNTRY_DE[code]?.[0] ?? english,
  pricesCheckedIn: (m) => `Preise bei Händlern ${at(m)} geprüft`,
  marketPrices: (m) => PRICES_ADJ[m] ?? m,
};

export const marketTag: Shape<typeof en.marketTag> = {
  these: (m, converted) => `Das sind ${PRICES_ADJ_INLINE[m] ?? m}${converted}.`,
  converted: (f, t) => `, umgerechnet in ${CURRENCY_DE[t] ?? t} zum EZB-Referenzkurs vom ${dateDe(fx.date)} (${rateTextDe(f, t)})`,
  lookFor: "Wonach du bei dir suchen kannst",
};

export const where: Shape<typeof en.where> = {
  pick: (m) => `Diese Preise stammen ${from(m)}. Wähle dein Land, dann zeigen wir dir, wonach du dort suchen kannst.`,
  sellsHere: (store, m) => `${store} verkauft das ${at(m)}. Lieferung oder Abholung siehst du beim Händler.`,
  deliversFrom: (store, m, dest) =>
    `${store} liefert laut eigener Versandseite ${from(m)} ${to(dest)}. Dafür gilt ein eigener Versandpreis, prüf ihn also an der Kasse.`,
  maybe: (store, m) =>
    `${store} ${at(m)} verschickt viele Artikel ins Ausland, prüf also Versand und Einfuhrabgaben an der Kasse. Meist ist es günstiger, im eigenen Land zu kaufen.`,
  ownSite: (store, place, m) =>
    `${store} verkauft ${at(place)} nur über einen eigenen Shop mit anderem Sortiment und anderen Preisen. Das Angebot, das wir ${at(m)} geprüft haben, gibt es dort also nicht. Such dort oder bei den Händlern unten nach dem gleichen Produkt.`,
  sellsToo: (store, m, place) =>
    `Wir haben den Preis bei ${store} ${at(m)} geprüft. ${store} verkauft auch ${at(place)}, such es also dort und prüf den Preis, denn Sortiment und Preise können abweichen.`,
  noDelivery: (m, dest, actives) =>
    `Der Händler, bei dem wir ${at(m)} den Preis geprüft haben, liefert nicht ${to(dest)}. ${
      actives ? "Das Gleiche steht dort meist unter einem anderen Namen im Regal." : "Such dort danach oder nach dem gleichen Produkt unter einem anderen Namen."
    }`,
  buyingIn: (place) => `Kaufen ${at(place)}`,
  lookForIn: (place) => `Wonach du ${at(place)} suchen kannst`,
  sameActives:
    "Jedes Präparat, das genau diese Wirkstoffe in derselben Stärke angibt, ist wirkstoffgleich. Eigenmarken sind meist am günstigsten.",
  compareLabel: (brand) => `Vergleich vor dem Kauf das Etikett mit ${brand}. Eigenmarken sind meist am günstigsten.`,
  storeBrands: "Eigenmarken sind meist am günstigsten.",
  medicineRules: (m) =>
    ` Für Arzneimittel gelten in jedem Land eigene Regeln: Was ${at(m)} frei verkäuflich ist, kann bei dir apothekenpflichtig oder verschreibungspflichtig sein.`,
  searchStores: (dest) => `Bei Händlern suchen, die ${to(dest)} liefern`,
  goTo: (store, site) => `Zu ${store} auf ${site}`,
  search: (store) => `Bei ${store} suchen`,
  noBigStore: (dest) =>
    `Wir kennen noch keinen großen Onlinehändler, der ${to(dest)} liefert. Deine Apotheke oder dein Supermarkt vor Ort hat das Gleiche unter eigenem Namen.`,
  checkedIn: (m) => `Die Preise auf dieser Seite wurden ${at(m)} geprüft.`,
};

export const yearly: Shape<typeof en.yearly> = {
  perAmount: (per) => `Diese Preise gelten ${per}, nicht pro Packung. Deshalb rechnen wir keine Packungen aufs Jahr hoch.`,
  saves: "Spart",
  once: "einmalig",
  notRegular: "Kein regelmäßiger Einkauf, deshalb nennen wir keinen Betrag pro Jahr.",
  aYear: "im Jahr",
  ifYouBuy: (brand, pack) => `beim Kauf der Packung ${brand} (${pack})`,
  howOften: (brand) => `Wie oft du die Packung ${brand} kaufst`,
  yourChoice: "Deine Auswahl, nur auf diesem Gerät gespeichert.",
  assumption: "Unsere Annahme, nicht deine. Wähl aus, wie oft du es kaufst.",
  frequencies: {
    "1w": "jede Woche",
    "2w": "alle 2 Wochen",
    "1m": "jeden Monat",
    "2m": "alle 2 Monate",
    "3m": "alle 3 Monate",
    "6m": "zweimal im Jahr",
    "1y": "einmal im Jahr",
  },
};

export const calculator: Shape<typeof en.calculator> = {
  underWeek: "Weniger als eine Woche",
  aboutWeek: "Etwa eine Woche",
  weeks: (n) => `Etwa ${n} Wochen`,
  aboutMonth: "Etwa einen Monat",
  months: (n) => `Etwa ${n} Monate`,
  years: (n) => `Etwa ${formatNumber(n, "de")} Jahre`,
  days: (n) => `etwa ${n} ${n === 1 ? "Tag" : "Tage"}`,
  // German nouns keep their capital; only the first word drops it.
  midSentence: (s) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`,
  outlasts: (pack, keeps) => `Bei diesem Verbrauch reicht ${pack} länger, als sie haltbar ist. Der kürzeste Wert in unseren Daten: ${keeps} ungeöffnet.`,
  openTooLong: (pack, keeps) =>
    `Wenn ${pack} ein einzelnes Gefäß ist, bleibt sie länger offen, als sie nach dem Öffnen hält. Der kürzeste Wert in unseren Daten: ${keeps} nach dem Öffnen.`,
  thisPack: "diese Packung",
  biggerPackName: "die größere Packung",
  heading: "Wie lange eine Packung bei dir reicht",
  youUse: "Du verbrauchst",
  aWeek: "pro Woche",
  perWeekText: (n, word) => `${formatNumber(n, "de")} ${word} pro Woche`,
  number: (n) => formatNumber(n, "de"),
  lasts: (alt) => `Packung ${alt} reicht`,
  biggerLasts: "Größere Packung reicht",
  yearOf: (name) => `Ein Jahr ${name}`,
  atThisRate: "im Jahr bei diesem Verbrauch",
  workedOut: "Berechnet aus den Grundpreisen auf dieser Seite. Deine Preise können abweichen.",
  sumsOnly: " Das ist nur eine Rechnung. Wie viel du nimmst oder verwendest, steht in der Packungsbeilage oder auf dem Etikett.",
  save: "Du sparst",
};

export const save: Shape<typeof en.save> = {
  onList: "Auf meiner Liste",
  saveToList: "Auf meine Liste",
  view: "Ansehen",
  copied: "Link kopiert",
  share: "Vergleich teilen",
  copyThis: "Diesen Link kopieren",
};

export const feedback: Shape<typeof en.feedback> = {
  kinds: { price: "Preis hat sich geändert", stock: "Nicht vorrätig", product: "Nicht dasselbe Produkt", other: "Etwas anderes" },
  watchHeading: "Schreib mir, wenn sich etwas ändert",
  watchIntro:
    "Eine E-Mail, wenn sich der Preis des günstigeren Produkts um 5 % oder mehr ändert, die Ersparnis unter 5 % fällt oder wir diesen Vergleich zurückziehen. Vorher bitten wir dich, deine Adresse zu bestätigen.",
  email: "E-Mail-Adresse",
  saving: "Wird gespeichert …",
  watch: "Vergleich beobachten",
  watchIdle: "Nur zu diesem Vergleich. Jede E-Mail enthält einen Link, mit dem du dich mit einem Klick abmeldest.",
  howWeUse: "Wie wir deine Adresse verwenden",
  somethingWrong: "Stimmt etwas auf dieser Seite nicht?",
  whatsWrong: "Was stimmt nicht?",
  anything: "Sollten wir noch etwas wissen?",
  optional: "(optional)",
  placeholder: "Zum Beispiel den Preis, den du gesehen hast, und wo",
  sending: "Wird gesendet …",
  send: "Senden",
  noAccount: "Kein Konto und keine E-Mail-Adresse nötig. Wir speichern deine IP-Adresse nie.",
};

const swapsWord = (n: number) => `${n} ${n === 1 ? "Vergleich" : "Vergleiche"}`;

const MATCH_DE: Record<MatchType, [label: string, short: string, description: string]> = {
  identical_active: [
    "Gleicher Wirkstoff",
    "Wirkstoffgleich",
    "Gleiche Wirkstoffe, gleiche Stärke, gleiche Darreichungsform, bestätigt anhand der offiziellen Packungsangaben.",
  ],
  identical_formula: ["Gleiche Rezeptur laut Etikett", "Gleiche Rezeptur", "Die vollständige Zutatenliste auf dem Etikett stimmt überein, in derselben Reihenfolge."],
  same_manufacturer: [
    "Gleicher Hersteller",
    "Gleicher Hersteller",
    "Öffentliche Unterlagen (Rückrufe, Behördenakten, Werkscodes) oder eine öffentliche Aussage eines der Unternehmen zeigen, dass dieselbe Firma beide herstellt.",
  ],
  equivalent_spec: [
    "Erfüllt denselben Zweck",
    "Gleicher Zweck",
    "Veröffentlichte technische Daten, Zertifizierungen oder unabhängige Tests zeigen, dass beide denselben Zweck in vergleichbarer Qualität erfüllen.",
  ],
  same_kind: [
    "Gleiche Produktart",
    "Gleiche Art",
    "Dieselbe Art Produkt, mit Preisen aus echten Quellen. Was uns vorliegt, zeigt nicht, dass beide beim Inhalt oder in der Wirkung übereinstimmen.",
  ],
};

const AISLE_DE: Record<CategorySlug, string> = {
  "otc-medicine": "Rezeptfreie Arzneimittel",
  supplements: "Nahrungsergänzung & Vitamine",
  "skincare-personal-care": "Haut- & Körperpflege",
  "beauty-hair": "Beauty & Haare",
  household: "Haushalt & Reinigung",
  baby: "Baby",
  pet: "Tier",
  "food-pantry": "Lebensmittel & Vorrat",
  "tech-tools": "Technik-Zubehör",
  kitchen: "Küche",
  batteries: "Batterien",
  "tools-diy": "Werkzeug & Heimwerken",
  office: "Büro & Schule",
  car: "Auto",
  garden: "Garten",
};

export const unitPrice: Shape<typeof en.unitPrice> = {
  vs: "statt",
  to: " zu ",
  priceSr: (about, cheaper, dearer, unit) => `${about ? "Ungefähr: " : ""}Günstigeres Produkt ${cheaper} ${unit}, Marke ${dearer} ${unit}.`,
  unitLabel: (u) => unitLabelDe(u.english, u.unit),
};

export const cards: Shape<typeof en.cards> = {
  moreSwaps: "Weitere Vergleiche",
  cheaperPct: (n) => `${n} % günstiger`,
  save: "Spare",
  noRating: "Noch keine Bewertung gefunden",
  matchShort: (type) => (type === "identical_active" ? MATCH_DE[type][0] : MATCH_DE[type][1]),
  matchLabel: (type) => MATCH_DE[type][0],
  matchShortPlain: (type) => MATCH_DE[type][1],
  noPhoto: (name) => `${name}: noch kein Foto`,
  confidence: {
    high: "Etikett geprüft",
    highTitle: "Beide Etiketten wurden anhand von Primärquellen bestätigt",
    medium: "Gute Belege",
    mediumTitle: "Gute Belege, aber nicht jedes Detail stammt aus einer Primärquelle",
  },
  matchDescription: (type) => MATCH_DE[type][2],
  aisle: (slug) => AISLE_DE[slug],
  marketLabel: (m) => c(m)[0],
};

export const delivery: Shape<typeof en.delivery> = {
  home: (cost, freeOver, pickup) => `Versand ${cost} bei Einzelkauf, ab ${freeOver} versandkostenfrei${pickup ? ", oder kostenlose Abholung im Markt" : ""}`,
  notChecked: (country) => `Versand ${to(country)} nicht geprüft`,
  free: (country) => `Versand ${to(country)} bei dieser Bestellung kostenlos`,
  abroad: (country, cost, freeOver) => `Versand ${to(country)} ${cost} bei Einzelkauf${freeOver !== null ? `, ab ${freeOver} versandkostenfrei` : ""}`,
};

export const newsletter: Shape<typeof en.newsletter> = {
  emailLabel: "E-Mail-Adresse",
  placeholder: "du@beispiel.de",
  joining: "Wird eingetragen …",
  submit: "Neue Vergleiche bekommen",
  note: "Eine E-Mail, wenn wir neue Vergleiche geprüft haben. Abmelden jederzeit möglich.",
};

export const kits: Shape<typeof en.kits> = {
  itemsStores: (items, stores) => `${items} Artikel, ${stores} Händler`,
  insteadOf: (brand) => `Statt des Sets von ${brand}`,
  andMore: (n) => `und ${n} weitere`,
  kit: "Set",
  builtYourself: "selbst zusammengestellt",
  costsMore: "Kostet heute mehr als das Set",
  smallSaving: "Nach Versandkosten kaum Ersparnis",
  saves: "Spart",
  beforeDelivery: "vor ungeprüften Versandkosten",
  afterDelivery: "nach Versandkosten",
  oneOrderAt: (store) => `Eine Bestellung bei ${store}`,
  oneStore: "Ein Händler",
  stores: (n) => `${n} Händler`,
  filterSort: "Sets filtern und sortieren",
  oneStoreOnly: "Nur ein Händler",
  aisle: "Kategorie",
  allAisles: "Alle Kategorien",
  sortKits: "Sets sortieren",
  sorts: { recommended: "Beste zuerst", amount: "Größte Ersparnis nach Versand", pct: "Höchste Ersparnis in % nach Versand" },
  count: (n) => `${n} ${n === 1 ? "Set" : "Sets"}`,
  noOneStore: "Keines dieser Sets bekommst du bei nur einem Händler.",
  showEvery: "Alle Sets zeigen",
  inEnglish: "Auf Englisch",
};

export const browse: Shape<typeof en.browse> = {
  swaps: swapsWord,
  withPhoto: "Mit Foto",
  medicineIncluded: "Mit Arzneimitteln",
  marketPrices: (m) => PRICES_ADJ[m] ?? m,
  filters: "Filter",
  removeFilter: (label) => `Filter entfernen: ${label}`,
  clearAll: "Alle entfernen",
  unitNote: "Die Einheiten unterscheiden sich zwischen Produkten, Preise pro Einheit lassen sich also am besten innerhalb einer Produktart vergleichen.",
  unitNoteFx: " Andere Währungen werden für diese Reihenfolge grob umgerechnet.",
  howWeCheck: "So prüfen wir",
  didntLoad: "Der Rest der Liste wurde nicht geladen.",
  tryAgain: "Noch einmal versuchen",
  showMore: (n) => `${n} weitere anzeigen`,
  showing: (shown, of) => `${shown} von ${of} angezeigt`,
  showSwaps: (n) => `${swapsWord(n)} anzeigen`,
  withMarket: (m) => ` mit ${PRICES_ADJ_INLINE[m] ?? m}`,
  showAllCountries: (n) => `Alle Länder anzeigen (${n})`,
  medicineLeftOut: "Arzneimittel sind ausgeblendet.",
  addIt: (n) => `Einblenden (${n})`,
  sortBy: "Sortieren nach",
  sorts: { saving: "Größte Ersparnis", unit: "Niedrigster Preis pro Einheit", newest: "Zuletzt geprüft" },
  noMatches: "Kein Vergleich passt zu allen diesen Filtern.",
  tryOne: "Nimm einen davon heraus:",
  addMedicineTo: (n) => `Arzneimittel einblenden, um ${swapsWord(n)} zu sehen`,
  removeTo: (label, n) => `„${label}“ entfernen, um ${swapsWord(n)} zu sehen`,
  clearAllFilters: "Alle Filter entfernen",
  aisle: "Kategorie",
  shelf: "Produktart",
  strength: "Wie stark die Übereinstimmung ist",
  whatTheseMean: "Was das bedeutet",
  pricesFrom: "Preise aus",
  allCountries: "Alle Länder",
  photos: "Fotos",
  fewerShelves: "Weniger Produktarten anzeigen",
  allShelves: (n) => `Alle ${n} Produktarten anzeigen`,
};

export const myList: Shape<typeof en.myList> = {
  offline: (kept) => `Du bist offline. Die Preise stammen von deinem letzten Besuch${kept ? `, ${kept}` : ""}. Prüf jeden Preis beim Händler, bevor du kaufst.`,
};

export const search: Shape<typeof en.search> = {
  elsewhere: (n, term, more) =>
    n === 1
      ? `${more ? "Ein weiterer Treffer" : "Ein Treffer"} für „${term}“ hat Preise aus anderen Ländern.`
      : `${n} ${more ? "weitere " : ""}Treffer für „${term}“ haben Preise aus anderen Ländern.`,
  showOthers: "Vergleiche aus anderen Ländern zeigen",
};
