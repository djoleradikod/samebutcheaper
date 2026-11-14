/** The German trust and account pages (see ../en/trust.ts): du-form, sober. */
import type { Shape } from "../t";
import type * as en from "../en/trust";

export const consent: Shape<typeof en.consent> = {
  heading: "Händlerlinks und Tracking",
  body: (stores) =>
    `${stores} bezahlen uns für einen Kauf nur, wenn ihr Tracking mit eigenen Cookies sieht, dass du von uns kommst, und bitten uns, vorher deine Einwilligung einzuholen. Wenn du es nicht erlaubst, funktionieren ihre Links trotzdem und die Preise sind dieselben. Sie wissen dann nur nicht, dass du von uns kommst.`,
  allow: "Erlauben",
  decline: "Nicht erlauben",
  policy: "Datenschutzerklärung",
  footer: "Datenschutz-Einstellungen",
};

export const newsletterPages: Shape<typeof en.newsletterPages> = {
  loading: "Wird geladen …",
  tooMany: "Das waren viele Versuche in kurzer Zeit. Warte bitte ein paar Minuten und öffne den Link dann noch einmal.",
  ourSide: "Bei uns ist etwas schiefgelaufen. Versuch den Link bitte in ein paar Minuten noch einmal.",
  homePage: "Startseite",
  backHome: "Zurück zur Startseite",
  seeBiggest: "Die größten Ersparnisse ansehen",

  confirmTitle: "E-Mail-Adresse bestätigen",
  confirmIntro: "Noch ein Schritt: Tippe zum Bestätigen auf die Schaltfläche.",
  confirmLetter: "Du bestätigst, dass {email} unseren wöchentlichen Newsletter bekommen soll: neue Vergleiche, die wir geprüft haben, höchstens eine E-Mail pro Woche.",
  confirmWatch: "Du bestätigst, dass {email} eine E-Mail bekommen soll, wenn sich der Preis im Vergleich {swap} um 5 % oder mehr ändert, die Ersparnis unter 5 % fällt oder wir den Vergleich zurückziehen.",
  confirmWish: (query) => `Du bestätigst, dass {email} eine E-Mail bekommen soll, wenn wir einen Vergleich für „${query}“ aufnehmen.`,
  yesLetter: "Ja, schickt mir neue Vergleiche",
  yesWatch: "Ja, diesen Vergleich beobachten",
  yesWish: "Ja, sagt mir Bescheid",
  notAsked: "Du hast das nicht angefordert? Schließ diese Seite, dann passiert nichts. Die Anfrage wird nach 30 Tagen gelöscht.",
  usedLink: "Dieser Link wurde schon benutzt, ist abgelaufen oder wurde durch eine neuere E-Mail ersetzt. Wenn du mehrmals angefragt hast, nimm den Link aus der neuesten E-Mail.",
  askAgain: "Schon bestätigt? Dann musst du nichts mehr tun. Sonst kannst du es auf der {home} oder auf der Seite des Vergleichs noch einmal anfordern, und wir schicken dir einen neuen Link.",

  confirmedTitle: "Du bist angemeldet",
  confirmedIntro: "Deine E-Mail-Adresse ist bestätigt.",
  confirmedBody: "Wir schreiben dir, wenn wir neue Vergleiche geprüft haben. Jede E-Mail enthält einen Abmeldelink, mit einem Klick bist du abgemeldet.",
  confirmedNext: "{biggest} oder {check}.",
  checkProduct: "ein Produkt prüfen, das du kaufst",

  watchTitle: "Du beobachtest diesen Vergleich",
  watchIntro: "Deine E-Mail-Adresse ist für diese Preisbeobachtung bestätigt.",
  watchBody:
    "Wir schreiben dir einmal, wenn sich der Preis der Alternative um 5 % oder mehr ändert, die Ersparnis unter 5 % fällt oder wir den Vergleich zurückziehen. Preise ändern sich bei uns, wenn wir sie neu prüfen. Zwischen zwei E-Mails können also Wochen liegen, oder es kommt gar keine.",
  watchOnly: "Damit meldest du dich für nichts anderes an. Jede E-Mail enthält einen Link, der die Beobachtung mit einem Klick beendet.",

  wishTitle: "Anfrage bestätigt",
  wishIntro: "Deine E-Mail-Adresse ist für diese Anfrage bestätigt.",
  wishBody:
    "Wir zählen jede Anfrage wie deine, und die Produkte, nach denen die meisten fragen, recherchieren wir zuerst. Einen Vergleich nehmen wir erst auf, wenn mindestens zwei Quellen ihn belegen. Wann oder ob das geschieht, können wir deshalb nicht versprechen.",
  wishOnly: "Damit meldest du dich für nichts anderes an.",
  suggest: "Du kennst ein günstigeres Produkt, das dasselbe leistet? Sag es uns",

  invalidTitle: "Dieser Link hat nicht funktioniert",
  invalidIntro: "Vielleicht wurde er schon benutzt, ist abgelaufen oder wurde unvollständig kopiert.",
  invalidBody:
    "Ein Bestätigungslink funktioniert einmal, 30 Tage lang, und eine neuere E-Mail ersetzt ihn. Wenn du schon bestätigt hast, musst du nichts mehr tun. Sonst kannst du es auf der {home} oder auf der Seite des Vergleichs noch einmal anfordern, und wir schicken dir einen neuen Link.",
  invalidUnsubscribe: "Du willst dich abmelden? Schreib an {mail} von der Adresse, mit der du dich angemeldet hast, dann löschen wir sie.",

  stoppedTitle: "Beendet",
  stoppedIntro: "Dazu schreiben wir dir nicht mehr.",
  stoppedBody: "Alles andere, worum du uns gebeten hast, läuft weiter. Um alles zu beenden, nimm den Link „Von allem abmelden“ unten in einer unserer E-Mails.",

  unsubscribeTitle: "Abmelden",
  unsubscribeIntro: "Keine E-Mails mehr von SameButCheaper an diese Adresse.",
  incomplete: "Dieser Abmeldelink ist unvollständig. Öffne den Link aus einer unserer E-Mails noch einmal.",
  unknownLink: "Diesen Link kennen wir nicht. Wenn du trotzdem gelöscht werden willst, schreib an {mail} von der Adresse, an die wir schreiben.",
  alreadyOff: "{email} ist schon abgemeldet. Wir schicken dorthin nichts.",
  thisIsFor: "Das gilt für {email}.",
  watchOn: (title) => `Die erste Schaltfläche beendet die Preisbeobachtung für „${title}“.`,
  watchOff: (title) => `Die Preisbeobachtung für „${title}“ ist schon beendet.`,
  wishOn: (query) => `Die erste Schaltfläche beendet deine Anfrage zu „${query}“.`,
  wishOff: (query) => `Deine Anfrage zu „${query}“ ist schon beendet.`,
  letterOn: "Die erste Schaltfläche beendet den wöchentlichen Newsletter. Preisbeobachtungen, die du eingerichtet hast, laufen weiter.",
  letterOff: "Der wöchentliche Newsletter ist schon abgeschaltet.",
  everything: "„Von allem abmelden“ beendet alle E-Mails, die wir an diese Adresse schicken.",
  stopLetter: "Newsletter beenden",
  stopWatch: "Beobachtung beenden",
  stopWish: "Anfrage beenden",
  stopEverything: "Von allem abmelden",
  stopMe: "Abmelden",

  unsubscribedTitle: "Du bist abgemeldet",
  unsubscribedIntro: "Wir schreiben dieser Adresse nicht mehr.",
  unsubscribedBody: "Doch anders entschieden? Du kannst dich jederzeit wieder auf der {home} anmelden.",
};
