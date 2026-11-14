import type { Shape } from "../t";
import type * as en from "../en/swap";
import { countryAt, countryTo } from "./client";

/** "ein britischer Händler" (nominative, masculine) and "mit britischen Preisen" (dative plural). */
const ADJ_MASC: Record<string, string> = { US: "US-amerikanischer", GB: "britischer", CA: "kanadischer", DE: "deutscher", IE: "irischer" };
const ADJ_DATIVE_PLURAL: Record<string, string> = { US: "US-amerikanischen", GB: "britischen", CA: "kanadischen", DE: "deutschen", IE: "irischen" };

/** Credits as the image records write them, in German. A credit not listed here is a name and stays as written. */
const CREDIT_DE: Record<string, string> = {
  "Open Food Facts contributors": "Open-Food-Facts-Mitwirkende",
  "Open Food Facts contributors, background removed": "Open-Food-Facts-Mitwirkende, Hintergrund entfernt",
  "Open Food Facts contributors, background removed, straightened": "Open-Food-Facts-Mitwirkende, Hintergrund entfernt, begradigt",
  "Open Food Facts contributors, straightened": "Open-Food-Facts-Mitwirkende, begradigt",
  "Open Beauty Facts contributors": "Open-Beauty-Facts-Mitwirkende",
  "Open Beauty Facts contributors, background removed": "Open-Beauty-Facts-Mitwirkende, Hintergrund entfernt",
  "Open Beauty Facts contributors, background removed, straightened": "Open-Beauty-Facts-Mitwirkende, Hintergrund entfernt, begradigt",
  "Open Pet Food Facts contributors": "Open-Pet-Food-Facts-Mitwirkende",
  "Open Pet Food Facts contributors, background removed": "Open-Pet-Food-Facts-Mitwirkende, Hintergrund entfernt",
  "Open Pet Food Facts contributors, background removed, straightened": "Open-Pet-Food-Facts-Mitwirkende, Hintergrund entfernt, begradigt",
  "Open Products Facts contributors": "Open-Products-Facts-Mitwirkende",
  "Open Products Facts contributors, background removed": "Open-Products-Facts-Mitwirkende, Hintergrund entfernt",
  "Open Products Facts contributors, background removed, straightened": "Open-Products-Facts-Mitwirkende, Hintergrund entfernt, begradigt",
};

export const swap: Shape<typeof en.swap> = {
  home: "Startseite",
  breadcrumb: "Navigationspfad",
  title: (brand, alt) => `${brand} vs. ${alt}`,
  notFound: "Vergleich nicht gefunden",
  verdict: {
    identical_active: (brand) => `ist wirkstoffgleich mit ${brand}`,
    identical_formula: (brand) => `hat laut Etikett dieselbe Rezeptur wie ${brand}`,
    same_manufacturer: (brand) => `stammt vom selben Hersteller wie ${brand}`,
    equivalent_spec: (brand) => `erfüllt denselben Zweck wie ${brand}`,
    same_kind: (brand) => `ist dieselbe Art Produkt wie ${brand}`,
    line: (alt, what, pct, per) => `${alt} ${what} und kostet ${pct} % weniger${per ? ` ${per}` : ""}.`,
  },
  sameLicence: (id) => `Dasselbe zugelassene Arzneimittel, ${id}`,
  share: (alt, brand, pct) => `${alt} erfüllt denselben Zweck wie ${brand}, für ${pct} % weniger.`,
  details: "Details",
  againstIt: "Dagegen spricht: ",
  whatDiffers: "Was sich unterscheidet",
  brandWinsOn: (list) => `Bei ${list} liegt die Marke vorn.`,
  buyingWhereYouLive: "Kaufen in deinem Land",
  thisStore: "Dieser Händler",
  moreSwaps: (aisle) => `Mehr günstige Alternativen: ${aisle}`,
  allCheaperMatches: (brand) => `Alle günstigeren Alternativen zu ${brand}`,
  brandProducts: (n, brand) => `${n} Produkte von ${brand} mit günstigeren Alternativen`,
  seeItOnline: "Online ansehen",
  seeItAt: (atStore) => `${atStore} ansehen`,
  seeBrandOnline: (brand) => `${brand} online ansehen`,
  seeItAtStore: (store) => `Bei ${store} ansehen`,
  seeBrandAt: (brand, atStore) => `${brand} ${atStore} ansehen`,
  seeIt: "Ansehen",
  whereToBuy: "Wo kaufen",
  shelf: { cheaper: "Günstige Alternative", brand: "Markenprodukt" },
  offers: {
    label: "Preise und Händler",
    product: "Produkt",
    store: "Händler",
    price: "Preis",
    pack: "Packung",
    unitPrice: "Grundpreis",
    link: "Link",
    biggerPack: "Die größere Packung",
    elsewhere: (market) => `Ein ${ADJ_MASC[market] ?? market} Händler`,
  },
  sameAmount: {
    each: (unit, saved) => `Pro ${unit} sparst du ${saved}.`,
    once: (saved) => `Du kaufst es nur einmal und sparst einmalig ${saved}.`,
    pack: (saved) => `Eine Packung dieser Größe kostet ${saved} weniger.`,
    forSame: (pack, altCost, alt, brandCost, brand) =>
      `Für die gleiche Menge (${pack}) zahlst du mit ${alt} etwa ${altCost} und mit ${brand} ${brandCost}.`,
  },
  disclosure: {
    noneHereSomeBelow: "An diesen beiden Links verdienen wir nichts. Ein Link weiter unten auf dieser Seite kann uns eine Provision bringen.",
    none: "An diesen Links verdienen wir nichts.",
    both: "Affiliate-Links. Wir erhalten eventuell eine Provision, für dich ohne Mehrkosten.",
    one: (store) => `Der Link zu ${store} ist ein Affiliate-Link. Wir erhalten eventuell eine Provision, für dich ohne Mehrkosten.`,
  },
  adLabel: (market) => (market === "DE" || market === "GB" || market === "IE" ? "Anzeige" : undefined),
  ticket: (pct) => `${pct} % günstiger`,
  pricedAt: (market) => `Diesen Vergleich haben wir bei ${ADJ_DATIVE_PLURAL[market] ?? market} Händlern geprüft.`,
  sameSwapAt: (market) => `Denselben Vergleich mit ${ADJ_DATIVE_PLURAL[market] ?? market} Preisen ansehen`,
  notListed: (market, country) =>
    `Diesen Vergleich haben wir bei ${ADJ_DATIVE_PLURAL[market] ?? market} Händlern geprüft und konnten nicht bestätigen, dass du ihn ${countryAt(country)} kaufen kannst. Deshalb steht er dort in keiner Liste.`,
};

export const compare: Shape<typeof en.compare> = {
  verdicts: {
    same: "Gleich",
    about_same: "Etwa gleich",
    alt_better: "Vorteil Alternative",
    brand_better: "Vorteil Marke",
    different: "Unterschiedlich",
    check: "Etikett prüfen",
    unknown: "Keine Angabe",
    neutral: "",
  },
  heading: "Gleich oder anders?",
  counted: (same, of) => `${same} von ${of} gleich.`,
  brandWins: (n) => ` Vorteil Marke: ${n}.`,
  showMore: (n) => `${n} weitere zeigen`,
  showFewer: "Weniger zeigen",
  continued: (label) => `${label}, Fortsetzung`,
  everythingElse: "Alles andere",
  whatWeCompared: "Was wir verglichen haben",
  what: "Was",
  verdictColumn: "Ergebnis",
  source: "Quelle",
  sourceFor: (aspect) => `Quelle zu ${aspect}`,
  showAll: "Alles zeigen",
  showLess: "Weniger zeigen",
  from: "Aus",
  peopleEnter: ". Diese Einträge pflegen Freiwillige, prüf deshalb die Packung. Einträge:",
};

export const why: Shape<typeof en.why> = {
  headingSameKind: "Was wir bisher wissen",
  heading: "Warum sich der Aufpreis kaum lohnt",
  whatWeChecked: "Was wir geprüft haben",
  worthKnowing: "Gut zu wissen: ",
  allFindings: "Alle unsere Belege",
  acrossAisle: "Für die ganze Kategorie",
  sources: (n) => `${n} ${n === 1 ? "Quelle" : "Quellen"}`,
  readMore: (sources) => `Weiterlesen und ${sources} ansehen`,
  see: (sources) => `${sources} ansehen`,
  evidenceStops: "Wo die Belege enden: ",
  brandWinsHeading: "Wo die Marke vorn liegt und was sich unterscheidet",
  brandWinsIntro: (alt) => `Worin ${alt} nicht mithält, aus denselben Unterlagen wie die Ersparnis.`,
  source: "Quelle",
  sourceFor: (aspect) => `Quelle zu ${aspect}`,
};

export const evidence: Shape<typeof en.evidence> = {
  sources: "Quellen",
  sourcesIntro: "Was wir geprüft haben. Schau selbst nach.",
  // The Heilmittelwerbegesetz's notice belongs to medicines. Other health aisles get the plain advice.
  healthLead: "Lies das Etikett. ",
  medicineLead: "Zu Risiken und Nebenwirkungen lesen Sie die Packungsbeilage und fragen Sie Ihre Ärztin, Ihren Arzt oder in Ihrer Apotheke. ",
  healthBody:
    "Dieser Vergleich stützt sich auf Packungsangaben und veröffentlichte Belege und ist keine medizinische Beratung. Hilfsstoffe (Füllstoffe, Farbstoffe, Aromen) können sich unterscheiden, was bei Allergien wichtig ist. Frag im Zweifel in der Apotheke oder in der Arztpraxis nach.",
  healthBodyPet:
    "Dieser Vergleich stützt sich auf Packungsangaben und veröffentlichte Belege und ist keine tierärztliche Beratung. Hilfsstoffe (Füllstoffe, Farbstoffe, Aromen) können sich unterscheiden, was bei Allergien deines Tiers wichtig ist. Frag im Zweifel in der Tierarztpraxis oder in der Apotheke nach.",
  photos: "Fotos: ",
  by: "von",
  noPhotoOf: (names) => `Noch kein lizenziertes Foto von ${names.join(" oder ")}.`,
  photoCredits: "Bildnachweise",
  whereItCameFrom: "Herkunft",
  adapted: "Bearbeitet: zugeschnitten und auf weißen Hintergrund gesetzt.",
  noPhoto: "Noch kein lizenziertes Foto. Die Zeichnung ist nur ein Platzhalter.",
  trademarks: "Verpackungsdesigns und Marken gehören ihren Inhabern.",
  allCredits: "Alle Bildnachweise",
  credit: (credit) => CREDIT_DE[credit] ?? credit,
};

export const prices: Shape<typeof en.prices> = {
  checked: (day) => `Preise geprüft: ${day}.`,
  checkedEach: (brand, brandDay, alt, altDay) => `Preis für ${brand} geprüft: ${brandDay}, für ${alt}: ${altDay}.`,
  checkedOne: (brand, day) => `Preis für ${brand} geprüft: ${day}.`,
  checkedWithheld: (day) => `Die Preise des Händlers zeigen wir hier nicht. Zuletzt von uns geprüft: ${day}.`,
  history: "Preisverlauf",
  ageing: "Vor über 3 Monaten geprüft, schau deshalb beim Händler nach dem aktuellen Preis.",
  stale: "Vor über 6 Monaten geprüft, schau deshalb beim Händler nach dem aktuellen Preis.",
  oldestChecked: "Ältester Preis geprüft",
  pricesChecked: "Preise geprüft",
  everyCheck: (amount) => `${amount} bei jeder Prüfung`,
  lowHigh: (lo, hi) => `Tiefstwert ${lo}, Höchstwert ${hi}`,
  checksSince: (summary, n, first) => `${summary}, ${n} Prüfungen seit ${first}`,
  pricesWeSaw: (name) => `${name}: Preise, die wir gesehen haben`,
  date: "Datum",
  price: "Preis",
  outOfStock: (name, store, day) => `${name} war bei ${store} nicht vorrätig, als wir am ${day} die Produktdaten des Händlers abgerufen haben.`,
};

export const bulk: Shape<typeof en.bulk> = {
  heading: "Auf Vorrat kaufen",
  advice: {
    stock_up: "Lohnt sich als Vorrat. Hält sich jahrelang.",
    buy_to_use: "Nur groß kaufen, wenn du es rechtzeitig aufbrauchst.",
    buy_small: "Lieber klein kaufen. Es verdirbt oder verliert an Wirkung.",
  },
  keeps: "Wie lange es hält",
  unopened: "Ungeöffnet",
  opened: "Nach dem Öffnen",
  storage: "Lagerung",
  fromRecord: (label) => `Aus unserem Eintrag zu ${label}.`,
  paysAfter: (shown, pack) => `Diese Packung rechnet sich nach ${shown} von ${pack}.`,
  atBrandPrice: (brand) => `Zum Grundpreis von ${brand} bekommst du für `,
  buys: (shown, words) => ` ${shown} ${words}.`,
  restIsSaving: "Alles danach in dieser Packung ist Ersparnis.",
  youPay: "Du zahlst an der Kasse ",
  moreAtTill: (brand, times) => ` mehr als für die Packung von ${brand}, bekommst aber ${times}-mal so viel.`,
  biggerPack: "Die größere Packung",
  biggerLess: (pct, label, pack, vsBrand, brand) =>
    `${pct} % weniger ${label} als die Packung mit ${pack} und ${vsBrand} % weniger als ${brand}.`,
  biggerNoLess: (label, pack) => `Sie kostet ${label} nicht weniger als die Packung mit ${pack}.`,
  noShelfRecord: "Zur Haltbarkeit haben wir hierzu noch keinen Eintrag. Prüf vor einem Großeinkauf das Datum auf der Packung.",
};

export const faq: Shape<typeof en.faq> = {
  heading: "Fragen",
  more: "Mehr zu diesem Vergleich",
  allCheaperMatches: (brand) => `Alle günstigeren Alternativen zu ${brand}`,
  every: (brand) => `Alle Alternativen zu ${brand}`,
  cheapest: (ingredient) => `${ingredient} am günstigsten`,
  aisle: (aisle) => `Kategorie ${aisle}`,
  twin: (market) => `Dieser Vergleich mit ${ADJ_DATIVE_PLURAL[market] ?? market} Preisen`,
  q: {
    same: (alt, brand) => `Ist ${alt} dasselbe wie ${brand}?`,
    different: (alt) => `Was ist bei ${alt} anders?`,
    cheaper: (alt, brand) => `Wie viel günstiger ist ${alt} als ${brand}?`,
    buy: (alt) => `Wo kann ich ${alt} kaufen?`,
  },
  confidenceHigh: " Beide Etiketten wurden anhand von Primärquellen bestätigt.",
  confidenceMedium: " Die Belege sind stark, aber nicht jedes Detail stammt aus einer Primärquelle.",
  sameKind: (claim, subcategory) =>
    `Das können wir nicht sagen. ${claim} (${subcategory}), mit Preisen aus echten Quellen. Unsere Daten zeigen nicht, dass beide im Inhalt oder in der Wirkung übereinstimmen.`,
  actives: (claim, actives) => `${claim}${actives ? `: ${actives}` : ""}.`,
  inactiveDiffer: " Die sonstigen Bestandteile können sich unterscheiden. Lies deshalb bei Allergien die Packungsbeilage.",
  inactiveSame: " Laut Etikett sind auch die sonstigen Bestandteile gleich.",
  notSame: (claim) => `Nicht dasselbe Produkt, aber ${claim}.`,
  matchOn: (list, more) => ` Übereinstimmung bei: ${list}${more > 0 ? ` und ${more} weiteren Punkten` : ""}.`,
  claimSentence: (claim) => `${claim}.`,
  brandWinsOn: (brand, list) => `Bei ${list} liegt ${brand} vorn.`,
  noDifference: (alt, brand) => `Laut unseren Unterlagen unterscheiden sich ${alt} und ${brand} nur bei Packung und Preis.`,
  differencesOnPage: "Die Unterschiede, die wir kennen, stehen auf dieser Seite, mit den Preisen in deiner Währung.",
  when: (market, month) => `bei den ${ADJ_DATIVE_PLURAL[market] ?? market} Preisen, die wir im ${month} geprüft haben`,
  old: " Diese Preise sind über ein Jahr alt, prüf sie deshalb vor dem Kauf.",
  cheaperPlain: (alt, pct, per, brand, when) => `${alt} kostet ${per ? `${per} ` : ""}${pct} % weniger als ${brand}, ${when}.`,
  cheaperLocal: (alt, altUnit, per, brandUnit, brand, pct, when) =>
    `${alt} kostet ${altUnit}${per ? ` ${per}` : ""}, ${brand} ${brandUnit}. Das sind ${pct} % weniger, ${when}.`,
  section: "Unter „Kaufen in deinem Land“ auf dieser Seite stehen Händler, bei denen du dort suchen kannst.",
  checkedAtA: (market, month) => `Wir haben den Preis im ${month} bei einem ${ADJ_DATIVE_PLURAL[market] ?? market} Händler geprüft.`,
  checkedAt: (store, month) => `Wir haben den Preis im ${month} bei ${store} geprüft.`,
  mayShip: (store, country) => ` ${store} liefert eventuell ${countryTo(country)}, prüf das an der Kasse.`,
  pricesChange: " Preise ändern sich, prüf den Preis deshalb vor dem Kauf beim Händler.",
  noDelivery: (market, country, query) =>
    `Wir haben den Preis bei einem ${ADJ_DATIVE_PLURAL[market] ?? market} Händler geprüft, der nicht ${countryTo(country)} liefert. Such dort im Handel nach „${query}“.`,
  pharmacy: (country) =>
    country === "DE" || country === "AT" || country === "CH" ? "Die meisten Arzneimittel gibt es dort nur in Apotheken, auch online." : null,
};

const PRICES_INLINE: Record<string, string> = { US: "US-Preise", GB: "britische Preise", CA: "kanadische Preise", DE: "deutsche Preise", IE: "irische Preise" };

export const seo: Shape<typeof en.seo> = {
  vs: (brand, alt) => `${brand} vs. ${alt}`,
  cheaper: (pct) => `${pct} % günstiger`,
  marketPrices: (market) => PRICES_INLINE[market] ?? market,
  question: (alt, brand) => `Ist ${alt} dasselbe wie ${brand}?`,
  costsLess: (pct, per, market, month) => `kostet ${per ? `${per} ` : ""}${pct} % weniger, bei ${ADJ_DATIVE_PLURAL[market] ?? market} Preisen vom ${month}`,
  lead: (claim, actives, price) => `${claim}${actives ? ` (${actives})` : ""} und ${price}.`,
  sameKindLead: (claim, pct, per, market) =>
    `${claim} und kostet ${per ? `${per} ` : ""}${pct} % weniger bei ${ADJ_DATIVE_PLURAL[market] ?? market} Preisen. Unsere Daten zeigen aber nicht, dass beide im Inhalt übereinstimmen.`,
  more: "Was sich unterscheidet, die Quellen und wo du es kaufst.",
  leadNoPrice: (claim, actives) => `${claim}${actives ? ` (${actives})` : ""}.`,
  sameKindNoPrice: (claim) => `${claim}. Unsere Daten zeigen aber nicht, dass beide im Inhalt übereinstimmen.`,
};

export const actions: Shape<typeof en.actions> = {
  tooMany: "Das waren viele Versuche in kurzer Zeit. Bitte warte ein paar Minuten.",
  thanksReport: "Danke. Wir prüfen es beim Händler und korrigieren die Seite, falls etwas nicht stimmt.",
  pickKind: "Wähl zuerst aus, was nicht stimmt.",
  noRecord: "Wir konnten den Eintrag zu dieser Seite nicht finden.",
  reportsClosed: "Meldungen sind noch nicht möglich. Bitte versuch es später noch einmal.",
  wrong: "Da ist etwas schiefgegangen. Bitte versuch es noch einmal.",
  almostThere: (what) => `Fast geschafft. Wir haben dir eine E-Mail geschickt: Klick auf den Link darin, um ${what}. Bis dahin schicken wir nichts weiter.`,
  saved: "Gespeichert. Wir schreiben dir einmal, damit du bestätigst, bevor wir etwas schicken.",
  thanks: "Danke.",
  validEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
  noSwap: "Wir konnten diesen Vergleich nicht finden.",
  watchesClosed: "Die Preisbeobachtung ist noch nicht verfügbar. Schau bald wieder vorbei.",
  watchBarred: "Die Partnerbedingungen dieses Händlers erlauben keine Preisalarme, deshalb lässt sich dieser Vergleich nicht beobachten.",
  startWatching: "diesen Vergleich zu beobachten",
  searchFirst: "Such zuerst nach einem Produktnamen.",
  notOpen: "Das ist noch nicht verfügbar. Schau bald wieder vorbei.",
  confirm: "zu bestätigen",
  reportedOut: "Nutzerinnen und Nutzer melden, dass es beim Händler ausverkauft ist. Wir prüfen das gerade.",
  reportedEither: "Nutzerinnen und Nutzer melden, dass sich der Preis geändert hat oder es ausverkauft ist. Wir prüfen das gerade.",
  reportedPrice: "Nutzerinnen und Nutzer melden, dass sich der Preis geändert hat. Wir prüfen das gerade.",
  reportedBy: "Von Nutzerinnen und Nutzern gemeldet: ",
  untilWe: "Bis dahin prüf Preis und Verfügbarkeit vor dem Kauf direkt beim Händler.",
};

export const record: Shape<typeof en.record> = {
  pricesByCountry: "Preise nach Land",
  pricesByCountryColon: "Preise nach Land:",
  inEnglish: "Auf Englisch",
};

export const rows: Shape<typeof en.rows> = {
  words: {
    activeIngredients: "Wirkstoffe",
    specs: "Technische Daten",
    fullFormula: "Vollständige Rezeptur",
    sameIngredientList: "Gleiche Zutatenliste",
    sameIngredientListOrder: "Gleiche Zutatenliste, gleiche Reihenfolge",
    inactiveIngredients: "Sonstige Bestandteile",
    sameListPerLabel: "Laut Etikett dieselbe Liste",
    canDiffer: "Können sich unterscheiden. Bei Allergien das Etikett lesen",
    whoMakesIt: "Hersteller",
    sameMaker: "Gleicher Hersteller",
    sameMakerSources: "Gleicher Hersteller (siehe Quellen)",
    pack: "Packung",
    licenceNumber: "Zulassungsnummer",
    notRecorded: "Nicht erfasst",
    shopperRating: "Kundenbewertung",
    notComparedHere: "Hier nicht verglichen",
    noRating: "Noch keine Bewertung gefunden",
    notListed: "Nicht angegeben",
    yes: "Ja",
    energy: "Energie",
    fat: "Fett",
    saturates: "davon gesättigte Fettsäuren",
    sugars: "davon Zucker",
    salt: "Salz",
    protein: "Eiweiß",
    fibre: "Ballaststoffe",
    ingredients: "Zutaten",
    aboutTheSame: "Etwa gleich",
    sameList: "Gleiche Liste",
    wordedDifferently: "Unterschiedlich erfasst, auf der Packung nachsehen",
    listsDiffer: "Listen unterscheiden sich",
    lowerGradesBetter: "Niedrigere Noten sind besser",
  },
  inactive: {
    "otc-medicine": "Füllstoffe, Überzug, Farbstoffe und Aromen",
    supplements: "Füllstoffe, Kapselhülle, Überzug und Aromen",
    "skincare-personal-care": "Grundlage, Duftstoffe und Konservierungsmittel",
    "beauty-hair": "Grundlage, Duftstoffe und Konservierungsmittel",
    household: "Duftstoffe, Farbstoffe und Stabilisatoren",
    baby: "Grundlage, Aromen und Konservierungsmittel",
    pet: "sonstige Zutaten und Aromen",
    "food-pantry": "sonstige Zutaten",
    other: "sonstige Bestandteile",
  },
  per100: { "per 100 ml": "pro 100 ml", "per 100 g": "pro 100 g", "per 100 g or 100 ml": "pro 100 g bzw. 100 ml" },
  grades: { "very good": "sehr gut", good: "gut", satisfactory: "befriedigend", sufficient: "ausreichend", poor: "mangelhaft" },
  rating: {
    outOf: (score, of) => `${score} von ${of}`,
    grade: (score) => `Note ${score}`,
    fromRatings: (score, count) => `${score} aus ${count} Bewertungen`,
  },
  canDifferMedicine: "Können sich unterscheiden. Bei Allergien die Packungsbeilage lesen",
  ownWords: (words) => `Eigene ${words}`,
  higher: (name) => `Bei ${name} höher`,
  score: (publisher) => `Bewertung bei ${publisher}`,
  pricePer: (label) => `Preis ${label}`,
  less: (value, pct) => `${value} (${pct} % weniger)`,
  people: (when, n) => `${when}, ${n} Personen`,
  caption: (per, nutrition) => (nutrition ? `Nährwerte ${per} und Zutaten` : "Zutaten"),
  intro: {
    nothingInside:
      "Abgesehen von Packungsgröße und Grundpreis haben wir nur Angaben, die die jeweils andere Seite nicht macht. Nichts hier vergleicht den Inhalt.",
    onlyPack: "Für diesen Vergleich haben wir nur die Packungsgröße und den Grundpreis. Nichts hier vergleicht den Inhalt.",
    onFile: (list) => `Für diesen Vergleich liegen vor: ${list}, Packungsgröße und Grundpreis.`,
    test: (name) => `das Ergebnis von ${name}`,
    tests: (n) => `${n} Testergebnisse`,
    nutrition: "Nährwerte und Zutaten aus von Freiwilligen gepflegten Einträgen",
    communityIngredients: "Zutaten aus von Freiwilligen gepflegten Einträgen",
    ingredientList: "die Zutatenliste",
    maker: "der Hersteller",
    others: (n) => (n === 1 ? "1 weiterer Punkt" : `${n} weitere Punkte`),
    licences: "Zulassungsnummern",
    ratings: "Bewertungen",
  },
};

/** "Walmart erlaubt seinen Partnern ...", "Walmart und Amazon erlauben ihren Partnern ...". */
const nurEigenePreise = (stores: string) =>
  / und /.test(stores)
    ? `${stores} erlauben ihren Partnern nur Preise, die sie selbst liefern und aktuell halten.`
    : `${stores} erlaubt seinen Partnern nur Preise, die ${stores} selbst liefert und aktuell hält.`;

export const terms: Shape<typeof en.terms> = {
  seePrice: (store) => `Preis bei ${store} ansehen`,
  lastChecked: (date) => `Zuletzt von uns geprüft: ${date}`,
  why: (stores) =>
    `${nurEigenePreise(stores)} Deshalb zeigt diese Seite dafür keinen Preis und keine Ersparnis. Vergleiche den Grundpreis beim Händler.`,
  verdict: (alt, what) => `${alt} ${what}.`,
  share: (alt, brand) => `${alt} statt ${brand}: was übereinstimmt und was sich unterscheidet`,
  hub: (stores) =>
    `${nurEigenePreise(stores)} Deshalb zeigen wir hier für ${stores} keinen Preis und keine Ersparnis. Die Seite jedes Vergleichs sagt, was übereinstimmt und was sich unterscheidet.`,
  notice: {
    "store-price-applies": (store) => `Weicht der Preis bei ${store} ab, gilt der Preis von ${store}.`,
    "as-of-time": () => "Produktpreise und Verfügbarkeit gelten zum angegebenen Datum und können sich ändern.",
  },
  paidLink: "Anzeige",
  theKit: "Das Set der Marke",
  thePieces: "Die günstigeren Teile",
  replaces: (item) => `Anstelle von: ${item}`,
  insteadOf: (brand) => `statt ${brand}`,
  kit: (stores) =>
    `${nurEigenePreise(stores)} Deshalb zeigt dieses Set keine Preise und keine Summen. Jedes Teil führt zu seinem Händler.`,
  basket: (stores) =>
    `${nurEigenePreise(stores)} Deshalb zeigt dieser Einkauf keine Summen. Jede Zeile führt zu ihrem Vergleich.`,
  whyPlain:
    "Der Händler erlaubt seinen Partnern nur Preise, die er selbst liefert und aktuell hält. Deshalb zeigt diese Seite dafür keinen Preis und keine Ersparnis. Vergleiche den Grundpreis beim Händler.",
};
