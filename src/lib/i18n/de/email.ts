import type { Shape } from "../t";
import type * as en from "../en/email";

export const mailCommon: Shape<typeof en.mailCommon> = {
  unsubscribeAll: "Von allen E-Mails abmelden",
  impressum: "Impressum",
};

export const mailConfirm: Shape<typeof en.mailConfirm> = {
  heading: "Bitte bestätige deine E-Mail-Adresse",
  askedLetter: "neue Vergleiche von SameButCheaper per E-Mail zu bekommen",
  askedWatch: (title) => `eine E-Mail von SameButCheaper zu bekommen, wenn sich der Preis beim Vergleich „${title}“ ändert oder wir den Vergleich zurückziehen`,
  askedWish: (query) => `eine E-Mail von SameButCheaper zu bekommen, sobald wir eine Alternative für „${query}“ aufnehmen`,
  subjectLetter: "Bestätige deine E-Mail-Adresse für SameButCheaper",
  subjectWatch: "Bestätige deine Preisbeobachtung bei SameButCheaper",
  subjectWish: "Bestätige deine Anfrage bei SameButCheaper",
  someone: (asked, host) => `Jemand, hoffentlich du, hat mit dieser Adresse darum gebeten, ${asked} (${host}).`,
  openLink: "Öffne diesen Link und tipp dann auf der Seite auf die Schaltfläche, um zu bestätigen:",
  openPage: "Öffne die Seite unten und tipp dort auf die Schaltfläche, um zu bestätigen.",
  button: "Bestätigungsseite öffnen",
  orPaste: "Oder kopier diesen Link in deinen Browser:",
  notYou: "Wenn du das nicht warst, ignorier diese E-Mail. Du hörst dazu nichts mehr von uns, und die Anfrage wird nach 30 Tagen gelöscht.",
};

export const mailWatch: Shape<typeof en.mailWatch> = {
  why: "Du bekommst diese E-Mail, weil du uns gebeten hast, dir zu schreiben, wenn sich dieser Vergleich ändert. Wir schreiben nur, wenn sich ein Preis um 5 % oder mehr ändert, die Ersparnis unter 5 % fällt oder wir den Vergleich zurückziehen.",
  stopThis: "Diesen Vergleich nicht mehr beobachten",
  withdrawnSubject: "Wir haben einen Vergleich zurückgezogen, den du beobachtest",
  withdrawn: (title) => `Wir haben „${title}“ aus unserem Katalog genommen. Deine Preisbeobachtung endet damit.`,
  noMore: "Wir schreiben dir dazu nicht mehr.",
  findAnother: "Eine andere Alternative finden",
  moved: (alt, up, pct, now, before) => `${alt} ist um ${pct} % ${up ? "teurer" : "günstiger"} geworden: jetzt ${now} statt ${before}.`,
  repriced: (alt, now) => `Wir haben den Preis von ${alt} neu erfasst: jetzt ${now}.`,
  savingDropped: (brand, now, before) => `Die Ersparnis gegenüber ${brand} ist von ${before} % auf ${now} % gesunken und liegt damit unter 5 %.`,
  cheaperThan: (now, brand, before) => `Es ist ${now} % günstiger als ${brand} (zuvor ${before} %).`,
  pricesAsOf: (month) =>
    `${month ? `Preise laut unserer Prüfung im ${month}` : "Preise laut unserer letzten Prüfung"}. Beim Händler können sie sich zwischen unseren Prüfungen ändern.`,
  subjectDropped: "Die Ersparnis bei einem beobachteten Vergleich liegt jetzt unter 5 %",
  subjectChange: (alt) => `Preisänderung bei einem beobachteten Vergleich: ${alt}`,
  seeSwap: "Zum Vergleich",
};

export const mailLetter: Shape<typeof en.mailLetter> = {
  newOnSite: "Neu auf der Website",
  bigSavings: "Große Ersparnisse, die du von uns noch nicht bekommen hast",
  kits: "Sets, günstiger nachgebaut",
  leadNone: "Neue Vergleiche diese Woche",
  leadPair: (alt, brand, pct) => `${alt} statt ${brand}, ${pct} % günstiger`,
  leadKit: (kit, pct) => `${kit}, ${pct} % günstiger`,
  andMore: (n) => ` und ${n} weitere`,
  test: "[Test] ",
  priceNote: (currency) =>
    `Die Preise sind so, wie wir sie zuletzt beim Händler geprüft haben. Wo „etwa“ vor einem Preis steht, haben wir ihn zum EZB-Referenzkurs in ${currency ?? "deine Währung"} umgerechnet. Preise ändern sich zwischen unseren Prüfungen: Den aktuellen Preis findest du beim Händler.`,
  why: "Du bekommst diese E-Mail, weil du den Newsletter von SameButCheaper abonniert und deine Adresse bestätigt hast. Höchstens eine E-Mail pro Woche.",
  stopThis: "Vom wöchentlichen Newsletter abmelden",
  intro: (total, hasKits) =>
    `${total} ${hasKits ? (total === 1 ? "Set" : "Vergleiche und Sets") : total === 1 ? "Vergleich" : "Vergleiche"}, ${total !== 1 ? "die" : hasKits ? "das" : "den"} du von uns noch nicht bekommen hast, jeweils anhand von mindestens zwei Quellen geprüft.`,
  heading: "Die Vergleiche dieser Woche",
  seeEvery: "Alle Vergleiche ansehen",
  instead: (name) => `statt ${name}`,
  facts: (match, pct, alt, brand, per) => `${match}. ${pct} % günstiger: ${alt} statt ${brand} ${per}.`,
  whatMatches: "Was übereinstimmt und was sich unterscheidet",
  rebuilt: (pieces, pct, same, kit) => `Aus ${pieces} günstigeren ${pieces === 1 ? "Teil" : "Teilen"} nachgebaut, ${pct} % günstiger: ${same} für die gleiche Menge statt ${kit} für das Set.`,
  seePieces: "Zu den Teilen",
  yearly: (brand, often, amount) =>
    `Wenn du ${often} eine Packung ${brand} kaufst, sparst du mit der Alternative ${amount} im Jahr. Wie oft du sie kaufst, stellst du auf der Seite des Vergleichs ein.`,
};

export const mailWish: Shape<typeof en.mailWish> = {
  subject: (query) => `Wir haben eine Alternative für „${query}“ aufgenommen`,
  intro: (query, n) => `Du hast uns gebeten, dir Bescheid zu geben, sobald wir eine Alternative für „${query}“ aufnehmen. Jetzt gibt es ${n > 1 ? `${n} davon` : "eine"}:`,
  why: (query) =>
    `Du bekommst diese E-Mail, weil du uns gebeten hast, dir zu schreiben, sobald wir eine Alternative für „${query}“ aufnehmen, und deine Adresse bestätigt hast. Die Anfrage ist damit erledigt: Das ist die einzige E-Mail dazu.`,
  seeAll: "Alles zu dieser Suche ansehen",
  priceNote: "Die Preise sind so, wie wir sie zuletzt beim Händler geprüft haben. Preise ändern sich zwischen unseren Prüfungen: Den aktuellen Preis findest du beim Händler.",
  preheader: (alt, brand) => `${alt} statt ${brand}`,
};
