/**
 * /datenschutz: the German privacy policy, a faithful translation of /privacy (src/app/privacy/page.tsx). Same facts,
 * same periods (read from the server's settings), nothing added or left out. When /privacy changes, this changes with it.
 *
 * Text in `backticks` renders as code. {mail} and {impressum} are the two links.
 */
import type { retention } from "../../maintenance";

type Keep = ReturnType<typeof retention>;

/** After a period, in the dative: "nach 180 Tagen", "nach einem Jahr", "nach 2 Jahren". */
function nach(days: number) {
  if (days % 365 === 0) return days === 365 ? "einem Jahr" : `${days / 365} Jahren`;
  return `${days} Tagen`;
}

export const meta = {
  title: "Datenschutz",
  description: "Was SameButCheaper erhebt und warum.",
};

export const page = {
  title: "Datenschutzerklärung",
  intro: "Wir erheben so wenig wie möglich.",
  loading: "Wird geladen …",
  collectHeading: "Was wir erheben",
  cookiesHeading: "Cookies",
  processorsHeading: "Wer deine Daten für uns verarbeitet",
  choicesHeading: "Deine Wahlmöglichkeiten",
};

/** The list under "Was wir erheben": a bold lead, then the text. */
export function collected(keep: Keep): { lead: string; text: string }[] {
  return [
    {
      lead: "Klicks auf Händlerlinks.",
      text: `Wenn du auf einen Link zu einem Händler klickst, speichern wir, welcher Vergleich es war, welcher Händler, das von dir gewählte Land, die Seite, von der du kamst, und die Website, über die du zuerst zu uns gekommen bist. Um einzelne Besucher zu zählen, ohne deine IP-Adresse zu speichern, behalten wir einen Einweg-Hash, der sich jeden Tag ändert. Nach ${nach(keep.clickDetail)} löschen wir den Hash und die Seite, von der du kamst.`,
    },
    {
      lead: "Verkäufe.",
      text: "Wenn uns das Affiliate-Netzwerk eines Händlers mitteilt, dass ein Klick zu einem Kauf geführt hat, speichern wir die Bestellnummer, den Bestellwert und unsere Provision. Wir erfahren nicht, wer du bist oder was du gekauft hast, und wir behalten nichts Persönliches, das ein Netzwerk mitschickt.",
    },
    {
      lead: "E-Mail-Adresse,",
      text: `nur wenn du sie uns gibst: um unseren wöchentlichen Brief zu bekommen, um den Preis eines Vergleichs zu beobachten, um benachrichtigt zu werden, wenn wir einen Vergleich für etwas hinzufügen, das du gesucht hast, oder mit einem Vorschlag. Jedes davon wird einzeln bestätigt: Wir schicken eine E-Mail, in der wir dich bitten, genau diese eine Sache zu bestätigen, und schicken dazu nichts, bis du es tust. Wenn du eines bestätigst, meldest du dich damit nie für etwas anderes an. Das Öffnen des Links zeigt nur, was du bestätigst: Nichts ändert sich, bis du auf der Seite den Knopf drückst, sodass ein Mail-Scanner, der Links öffnet, dich nicht anmelden kann. Wenn du nicht bestätigst, wird die Anfrage nach ${keep.unconfirmed} Tagen gelöscht, und eine Adresse ohne Bestätigung gleich mit. Sobald für deine Adresse nichts mehr eingeschaltet ist (kein Brief, keine Beobachtung, keine wartende Anfrage), löschen wir sie ${keep.unconfirmed} Tage später. Wir speichern, wann du bestätigt hast, als Nachweis, dass du es angefordert hast. Wir speichern das Land, das du gewählt hattest, damit wir Preise in deiner Währung zeigen können. Wir nutzen deine Adresse nur, um zu schicken, was du angefordert hast, und wir verkaufen oder teilen sie nie.`,
    },
    {
      lead: "Preisbeobachtungen.",
      text: `Wenn du einen Vergleich beobachtest, speichern wir, welcher Vergleich es ist und seine Preise in diesem Moment, damit wir dir sagen können, wenn sie sich ändern. Eine Beobachtung, die du beendest oder die endet, weil wir den Vergleich zurückgezogen haben, wird nach ${keep.unconfirmed} Tagen gelöscht.`,
    },
    {
      lead: "„Sag mir Bescheid, wenn ihr es hinzufügt“.",
      text: `Wir speichern die Suche und dein Land mit deiner Adresse. Wenn wir einen Vergleich hinzufügen, dessen Marken- oder Produktname dazu passt, schreiben wir dir einmal, und die Anfrage endet. Wir löschen sie ${keep.unconfirmed} Tage, nachdem sie endet oder du sie beendest, oder nach ${nach(keep.wishes)}, wenn sie noch wartet.`,
    },
    {
      lead: "Die E-Mails, die wir senden.",
      text: `Wir führen ein Protokoll über jede E-Mail, die wir dir senden (was es war und wann, und beim wöchentlichen Brief, welche Vergleiche er enthielt), damit niemand dieselbe zweimal bekommt. Das Protokoll wird nach ${nach(keep.sends)} gelöscht. Unsere E-Mails enthalten keine Zählpixel, und wir erfassen nicht, ob du sie öffnest. Links auf unsere eigenen Seiten tragen \`utm_source=newsletter\`. Das sagt uns, dass ein Besuch aus einer E-Mail kam, nicht, wer du bist.`,
    },
    {
      lead: "Vorschläge,",
      text: "die du über das Vorschlagsformular schickst.",
    },
    {
      lead: "Meldungen über „Stimmt etwas nicht?“.",
      text: `Wenn du uns sagst, dass ein Preis, ein Lagerbestand oder ein Produkt auf einer Seite falsch ist, speichern wir, was du ausgewählt hast, deine Notiz (wir entfernen alles, was wie eine E-Mail-Adresse oder Telefonnummer aussieht), das von dir gewählte Land und denselben täglich wechselnden Hash wie bei Klicks, damit eine Person nicht als mehrere zählt. Den Hash löschen wir nach ${keep.reportHash} Tagen, die Meldung nach ${nach(keep.reports)}. Wenn drei oder mehr Personen innerhalb von zwei Wochen einen geänderten Preis oder Lagerbestand auf derselben Seite melden, steht auf der Seite, dass Kundinnen und Kunden es gemeldet haben, bis wir es geprüft haben.`,
    },
    {
      lead: "Wonach gesucht wurde, das wir nicht hatten.",
      text: `Wenn eine Suche auf unserer Website nichts findet oder die Produktprüfung ein Produkt liest, für das wir keinen Vergleich haben, zählen wir die gesuchten Wörter (in Kleinbuchstaben, gekürzt und nie etwas, das wie eine E-Mail-Adresse, Webadresse oder Telefonnummer aussieht) mit dem Land und dem Tag. Nichts darüber, wer gesucht hat, wird mit der Zählung gespeichert. Wir löschen diese Zählungen nach ${nach(keep.wanted)}.`,
    },
    {
      lead: "Produktprüfungen.",
      text: `Wenn du auf der Seite zur Produktprüfung ein Produkt suchst, scannst oder fotografierst, speichern wir, was nachgeschlagen wurde, dein Land und ob wir einen Vergleich dazu hatten, mit demselben täglich wechselnden Hash. So sehen wir, welche Produkte wir als Nächstes recherchieren sollten. Wir löschen diese Einträge nach ${nach(keep.lookups)}.`,
    },
    {
      lead: "Fotos.",
      text: "Barcodes werden auf deinem eigenen Gerät gelesen. Wenn ein Foto keinen lesbaren Barcode hat, wird es an unseren Etikettenleser (Claude von Anthropic) geschickt, um den Text auf der Packung zu lesen, und danach verworfen. Wir speichern deine Fotos nicht.",
    },
    {
      lead: "Einkaufslisten und Kassenbons.",
      text: "Wenn du auf der Seite zur Produktprüfung eine Einkaufsliste einfügst oder einen Kassenbon hochlädst, lesen wir sie, um Treffer zu finden, und verwerfen sie danach. Wir behalten nur die bereinigten Namen von Produkten, die wir nicht zuordnen konnten, ohne Preise und ohne etwas, das dich identifiziert.",
    },
  ];
}

export const cookies =
  "Wir setzen zwei kleine eigene Cookies. `sbc_country` enthält einen Ländercode, damit wir Händler zeigen können, die in dein Land liefern; du kannst ihn jederzeit ändern. `sbc_src` enthält 30 Tage lang den Namen der Website oder Kampagne, die dich zuerst hierher gebracht hat (zum Beispiel „google“), damit wir sehen, welche Quellen Kundinnen und Kunden bringen, die einen Vergleich nützlich finden. Keines davon identifiziert dich, und wir setzen keine Werbe-Cookies. Wenn du über unsere Links einen Händler wie Amazon besuchst, kann dieser Händler nach seiner eigenen Datenschutzerklärung eigene Cookies setzen. So werden Affiliate-Käufe zugeordnet.";

export const processors =
  "Unser Server und unsere Datenbank werden von Hetzner betrieben. E-Mails werden über Resend versendet. Fotos, die du lesen lassen möchtest, gehen wie oben beschrieben an Anthropic.";

export const choices =
  "Jede E-Mail, die wir senden, enthält Abmeldelinks, die mit einem Klick funktionieren: Einer beendet nur diesen Brief oder diese Beobachtung, der andere beendet alles, was wir an deine Adresse schicken. Wenn du deine E-Mail-Adresse oder einen Vorschlag löschen lassen möchtest oder wissen willst, was wir über dich gespeichert haben, schreib uns an {mail}.";

export const whoRuns = "Wer diese Website betreibt: siehe {impressum}.";
export const impressumLink = "Impressum";
