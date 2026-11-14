/**
 * /datenschutz: the German privacy policy, from the facts in src/lib/privacy-facts.ts (where each one comes from in
 * the code is listed there), in step with the English /privacy (src/lib/i18n/en/privacy.ts); both are checked against
 * the facts by scripts/tests/privacy-facts.test.ts. Facts only the owner can give (who is responsible) come from the
 * LEGAL_* settings and show as a visible gap until they are set. What a lawyer still has to confirm is listed in
 * docs/legal-review-de.md.
 *
 * Text in `backticks` renders as code. {mail} and {impressum} are the two links.
 */
import type { PolicyFacts, PolicyText } from "../../privacy-facts";

/** After a period, in the dative: "nach 180 Tagen", "nach einem Jahr", "nach 2 Jahren". */
function nach(days: number) {
  if (days % 365 === 0) return days === 365 ? "einem Jahr" : `${days / 365} Jahren`;
  return `${days} Tagen`;
}

/** A period in the accusative: "180 Tage", "ein Jahr". */
function dauer(days: number) {
  if (days % 365 === 0) return days === 365 ? "ein Jahr" : `${days / 365} Jahre`;
  return `${days} Tage`;
}

/** "amazon" -> "Amazon"; several joined with "und". */
function stores(list: string[]) {
  const names = list.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}` : names.join("");
}

const NETWORKS = "das Amazon-Partnerprogramm, Awin, CJ, Rakuten, Impact, Partnerize, Skimlinks oder Sovrn";

export const policy: PolicyText = {
  meta: {
    title: "Datenschutz",
    description: "Was SameButCheaper über dich speichert, warum, wie lange und wer es für uns verarbeitet.",
  },
  page: {
    eyebrow: "Datenschutz",
    title: "Datenschutzerklärung",
    intro: "Wir erheben so wenig wie möglich. Hier steht, was wir trotzdem speichern, warum und wie lange.",
    loading: "Wird geladen …",
    controllerHeading: "Verantwortlich",
    collectHeading: "Was wir erheben",
    logsHeading: "Server-Logdateien, Schutz vor Missbrauch und Sicherungskopien",
    cookiesHeading: "Cookies",
    storageHeading: "Was nur in deinem Browser bleibt",
    processorsHeading: "Wer deine Daten sonst noch sieht",
    basesHeading: "Rechtsgrundlagen",
    rightsHeading: "Deine Rechte",
    choicesHeading: "Abmelden und Löschen",
  },

  /** Who is responsible, from the LEGAL_* settings. Until they are set, the gap shows instead of a made-up name. */
  controller(notice) {
    if (!notice) {
      return [
        "[Noch nicht eingetragen: Name, Anschrift und E-Mail-Adresse der verantwortlichen Stelle. Sie kommen aus den Einstellungen LEGAL_NAME, LEGAL_ADDRESS und LEGAL_EMAIL und stehen hier, sobald sie gesetzt sind.]",
      ];
    }
    return [notice.name, ...notice.address, `E-Mail: ${notice.email}`];
  },

  collected: ({ keep, photos }: PolicyFacts) => [
    {
      lead: "Klicks auf Händlerlinks.",
      text: `Wenn du einem Link zu einem Händler folgst, speichern wir, welcher Vergleich oder welches Set es war, welcher Händler, das gewählte Land, die Seite, auf der du geklickt hast, und die Website oder Kampagne, über die du zuerst zu uns gekommen bist, wenn der Link sie mitbringt (siehe Cookies). Um einzelne Besucherinnen und Besucher zu zählen, ohne deine IP-Adresse zu speichern, bilden wir aus IP-Adresse und Browserkennung einen Einweg-Hash, der sich jeden Tag ändert, und speichern nur ihn. Nach ${nach(keep.clickDetail)} löschen wir den Hash und die Seite, auf der du geklickt hast. Wo ein Link zu einem Partnerprogramm führt, hängen wir eine zufällige Klicknummer an, damit uns das Programm einen Kauf zuordnen kann. Der Rest des Eintrags (Vergleich, Händler, Land, Herkunft und Klicknummer) bleibt, weil wir Verkäufe ihm zuordnen. Nichts davon sagt, wer du bist.`,
    },
    {
      lead: "Verkäufe.",
      text: `Wenn uns das Partnerprogramm eines Händlers mitteilt, dass ein Klick zu einem Kauf geführt hat, speichern wir die Bestellnummer, den Bestellwert und unsere Provision. Wir erfahren nicht, wer du bist oder was du gekauft hast. Was ein Programm an Persönlichem mitschickt, verwerfen wir, den Rest seiner Meldung löschen wir nach ${nach(keep.clickDetail)}.`,
    },
    {
      lead: "E-Mail-Adresse,",
      text: `nur wenn du sie uns gibst: für unseren wöchentlichen Newsletter, für die Preisbeobachtung eines Vergleichs, für eine Nachricht, sobald wir eine Alternative zu deiner Suche aufnehmen, oder mit einem Vorschlag. Jedes davon bestätigst du einzeln (Double-Opt-in): Wir schicken eine E-Mail, in der wir dich bitten, genau diese eine Sache zu bestätigen, und schicken dazu nichts weiter, bis du es tust. Eine Bestätigung meldet dich nie für etwas anderes an. Der Link in der E-Mail öffnet nur eine Seite, die zeigt, was du bestätigst. Erst wenn du dort auf die Schaltfläche tippst, ändert sich etwas, sodass ein E-Mail-Scanner, der Links öffnet, dich nicht anmelden kann. Bestätigst du nicht, löschen wir die Anfrage nach ${nach(keep.unconfirmed)}, und eine Adresse ohne jede Bestätigung gleich mit. Sobald für deine Adresse nichts mehr eingeschaltet ist (kein Newsletter, keine Preisbeobachtung, keine offene Anfrage), löschen wir sie ${keep.unconfirmed} Tage später. Wir speichern, wann du bestätigt hast, als Nachweis, dass du es angefordert hast. Außerdem speichern wir das Land, das du gewählt hattest, damit wir Preise in deiner Währung zeigen, und die Sprache der Seite, auf der du dich eingetragen hast, damit wir dir in dieser Sprache schreiben. Wir nutzen deine Adresse nur, um dir zu schicken, was du angefordert hast, und wir verkaufen sie nicht und geben sie nicht weiter, außer an den E-Mail-Dienst, der sie für uns zustellt (siehe unten).`,
    },
    {
      lead: "Preisbeobachtungen.",
      text: `Wenn du einen Vergleich beobachtest, speichern wir, welcher Vergleich es ist und seine Preise in diesem Moment, damit wir dir schreiben können, wenn sie sich ändern. Eine Beobachtung, die du beendest oder die endet, weil wir den Vergleich zurückgezogen haben, löschen wir nach ${nach(keep.unconfirmed)}.`,
    },
    {
      lead: "„Sag mir Bescheid, wenn ihr es aufnehmt“.",
      text: `Wir speichern die Suche und dein Land mit deiner Adresse. Wenn wir einen Vergleich aufnehmen, dessen Marken- oder Produktname dazu passt, schreiben wir dir einmal, und die Anfrage endet. Wir löschen sie ${keep.unconfirmed} Tage, nachdem sie endet oder du sie beendest, oder nach ${nach(keep.wishes)}, wenn sie noch offen ist.`,
    },
    {
      lead: "Die E-Mails, die wir senden.",
      text: `Wir protokollieren jede E-Mail, die wir dir senden (was es war und wann, und beim wöchentlichen Newsletter, welche Vergleiche er enthielt), damit niemand dieselbe zweimal bekommt. Das Protokoll löschen wir nach ${nach(keep.sends)}. Unsere E-Mails enthalten keine Zählpixel, und wir erfassen nicht, ob du sie öffnest. Links auf unsere eigenen Seiten tragen \`utm_source=newsletter\`. Das sagt uns, dass ein Besuch aus einer E-Mail kam, nicht, wer du bist.`,
    },
    {
      lead: "Vorschläge,",
      text: "die du über das Vorschlagsformular schickst, mit deiner E-Mail-Adresse, wenn du sie angibst. Für Vorschläge gibt es noch keine automatische Löschung: Schreib uns, dann löschen wir deinen.",
    },
    {
      lead: "Meldungen über „Stimmt etwas nicht?“.",
      text: `Wenn du uns sagst, dass ein Preis, die Verfügbarkeit oder ein Produkt auf einer Seite nicht stimmt, speichern wir, was du ausgewählt hast, deine Notiz (wir entfernen alles, was wie eine E-Mail-Adresse oder Telefonnummer aussieht), das gewählte Land und denselben täglich wechselnden Hash wie bei Klicks, damit eine Person nicht als mehrere zählt. Den Hash löschen wir nach ${nach(keep.reportHash)}, die Meldung nach ${nach(keep.reports)}. Wenn drei oder mehr Personen innerhalb von zwei Wochen auf derselben Seite einen geänderten Preis oder fehlende Ware melden, steht dort, dass Nutzerinnen und Nutzer es gemeldet haben, bis wir es geprüft haben.`,
    },
    {
      lead: "Suchen, für die wir nichts hatten.",
      text: `Wenn eine Suche auf unserer Website nichts findet oder die Produktprüfung ein Produkt liest, für das wir keinen Vergleich haben, zählen wir die gesuchten Wörter (in Kleinbuchstaben, gekürzt und nie etwas, das wie eine E-Mail-Adresse, Webadresse oder Telefonnummer aussieht) mit dem Land und dem Tag. Nichts darüber, wer gesucht hat, wird mit der Zählung gespeichert. Wir löschen diese Zählungen nach ${nach(keep.wanted)}.`,
    },
    {
      lead: "Produktprüfungen.",
      text: `Wenn du auf der Seite „Produkt prüfen“ ein Produkt suchst, scannst oder fotografierst, speichern wir, was nachgeschlagen wurde, dein Land und ob wir einen Vergleich dazu hatten, mit demselben täglich wechselnden Hash. So sehen wir, welche Produkte wir als Nächstes recherchieren sollten. Wir löschen diese Einträge nach ${nach(keep.lookups)}. Um das Produkt zu finden, schickt unser Server die Wörter oder den Barcode, nach denen du suchst, an öffentliche Produktdatenbanken (siehe unten). Sie sehen unseren Server, nicht dich.`,
    },
    {
      lead: "Fotos.",
      text: photos
        ? "Barcodes werden auf deinem eigenen Gerät gelesen. Wenn ein Foto eines Etiketts keinen lesbaren Barcode hat, und bei jedem Foto eines Kassenbons, schicken wir das Foto an einen KI-Dienst (Claude von Anthropic), der den Text darauf liest. Danach verwerfen wir es. Wir speichern deine Fotos nicht."
        : "Barcodes werden auf deinem eigenen Gerät gelesen. Das Lesen von Fotos durch einen KI-Dienst ist derzeit ausgeschaltet, kein Foto geht also an einen solchen Dienst.",
    },
    {
      lead: "Einkaufslisten und Kassenbons.",
      text: "Wenn du auf der Seite „Einkauf prüfen“ eine Liste oder den Text eines Kassenbons einfügst, liest unser Server sie, um passende Vergleiche zu finden, und verwirft sie danach. Wir behalten nur die bereinigten Namen von Produkten, die wir nicht zuordnen konnten, ohne Preise und ohne etwas, das dich identifiziert.",
    },
  ],

  /** The server's own records: the access log, the in-memory limits and the backups. */
  logs: ({ backupDays }) => [
    "Der Webserver, der unsere Seiten ausliefert, protokolliert Anfragen in Logdateien auf unserem Server, darunter deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse und die Browserkennung. Wir nutzen sie, um Fehler und Angriffe zu finden. [Noch festzulegen: wie lange diese Logdateien aufbewahrt werden.]",
    "Damit niemand unsere Formulare und die Produktprüfung in kurzer Zeit tausendfach aufruft, zählen wir Anfragen pro IP-Adresse im Arbeitsspeicher des Servers. Diese Zähler liegen nur im Arbeitsspeicher, zählen höchstens einen Tag lang und werden nie in die Datenbank oder in Dateien geschrieben. Die Protokolle unserer Anwendung enthalten keine IP-Adressen und keine E-Mail-Adressen.",
    `Von unserer Datenbank machen wir jede Nacht eine Sicherungskopie und bewahren die letzten ${backupDays} auf. Was wir löschen, verschwindet aus den Sicherungskopien also spätestens ${backupDays} Tage später.`,
  ],

  cookiesIntro: (f) =>
    f.consentStores.length > 0
      ? "Wir setzen bis zu drei kleine eigene Cookies und keine Werbe- oder Analyse-Cookies anderer Anbieter. Keines davon identifiziert dich."
      : "Wir setzen zwei kleine eigene Cookies und keine Werbe- oder Analyse-Cookies anderer Anbieter. Keines davon identifiziert dich.",
  cookie: {
    sbc_country: (days) =>
      `\`sbc_country\` enthält einen Ländercode, damit wir Preise und Händler für dein Land zeigen. Beim ersten Besuch setzen wir es aus dem Land, das dein Browser in seinen Spracheinstellungen nennt oder das uns ein vorgeschaltetes Netzwerk anhand deiner Verbindung meldet. Du kannst es jederzeit ändern. Es gilt ${dauer(days)}.`,
    sbc_others: (days) => `\`sbc_others\` merkt sich ${dauer(days)} lang, ob du Vergleiche aus anderen Ländern sehen möchtest. Wir setzen es erst, wenn du das umschaltest.`,
    sbc_consent: (days) =>
      `\`sbc_consent\` merkt sich ${dauer(days)} lang, ob du das unten beschriebene Tracking durch Händler erlaubt hast. Wir setzen es erst, wenn du dich entscheidest, und du kannst deine Wahl unter „Datenschutz-Einstellungen“ unten auf jeder Seite ändern.`,
  },
  cookiesAfter: (f) => [
    "Um zu sehen, woher Besucherinnen und Besucher kommen, nutzen wir kein Cookie und auch sonst nichts auf deinem Gerät. Wenn du über einen Link von einer anderen Website oder aus einer Kampagne gekommen bist, behält die Seite deren Namen (zum Beispiel „google.com“) im Arbeitsspeicher, solange du dich bei uns bewegst, und hängt ihn an einen Händlerlink, wenn du ihm folgst. So wird er mit diesem Klick gespeichert. Schließt du den Tab, ist er weg. Frühere Versionen unserer Website haben ihn in einem Cookie namens `sbc_src` gespeichert: Hat dein Browser noch eines, löschen wir es bei deinem nächsten Besuch.",
    f.consentStores.length > 0
      ? `Wenn du über unsere Links einen Händler besuchst, können der Händler oder das Partnernetzwerk, über das der Link läuft, nach ihrer eigenen Datenschutzerklärung eigene Cookies setzen. So werden uns Käufe zugeordnet. ${stores(f.consentStores)} ${f.consentStores.length === 1 ? "bittet" : "bitten"} uns, vorher deine Einwilligung einzuholen. Wenn du in der EU, im EWR, im Vereinigten Königreich oder in der Schweiz bist oder wir nicht erkennen, wo du bist, schicken wir dich erst über deren Tracking, wenn du es erlaubt hast. Sonst bekommst du den einfachen Link zum Händler.`
      : "Wenn du über unsere Links einen Händler besuchst, können der Händler oder das Partnernetzwerk, über das der Link läuft, nach ihrer eigenen Datenschutzerklärung eigene Cookies setzen. So werden uns Käufe zugeordnet.",
  ],

  storage: [
    "Deine Sparliste, wie oft du etwas kaufst, und die Häkchen in der Einkaufsliste eines Sets speichert dein Browser auf deinem Gerät (im „Local Storage“, unter `sbc:saved`, `sbc:how-often` und `sbc:kit-ticks:` mit dem Namen des Sets). Damit deine Sparliste auch ohne Verbindung aufgeht, legt der Browser außerdem eine Kopie dieser Seite, die Skripte und Stile, die sie braucht, unsere Offline-Seiten und die zuletzt gesehenen Produktfotos in seinem Zwischenspeicher ab (`sbc-shell-`, `sbc-static-` und `sbc-images-`).",
    "Nichts davon wird an uns geschickt, außer du teilst selbst einen Link zu deiner Liste. Du löschst es, indem du in deinem Browser die Websitedaten für diese Seite löschst.",
  ],

  processors: ({ photos, consentStores }) => [
    "Unser Server und unsere Datenbank laufen bei Hetzner. E-Mails stellt Resend für uns zu: Dafür bekommt Resend deine E-Mail-Adresse und den Inhalt der E-Mail.",
    photos
      ? "Fotos, die du lesen lässt, gehen wie oben beschrieben an Anthropic. Resend und Anthropic sitzen in den USA, die Daten können also dort verarbeitet werden."
      : "Resend sitzt in den USA, die Daten können also dort verarbeitet werden.",
    "Um ein Produkt nachzuschlagen, fragt unser Server öffentliche Produktdatenbanken: Open Food Facts, Open Beauty Facts und Open Pet Food Facts, openFDA der US-Arzneimittelbehörde FDA und die Datenbank für Etiketten von Nahrungsergänzungsmitteln der US-Gesundheitsbehörde NIH. Sie bekommen, was nachgeschlagen wurde, von unserem Server und nichts über dich. Die Produktfotos in den Ergebnissen der Produktprüfung lädt dein Browser direkt von den Bildservern von Open Food Facts. Diese Server sehen deshalb, wie bei jeder Website, deine IP-Adresse und deine Browserkennung.",
    `Wenn du einem Händlerlink folgst, schickt dich unsere Weiterleitung (\`/go\`) zum Händler, manchmal über ein Partnernetzwerk (${NETWORKS}). Netzwerk und Händler sehen deine IP-Adresse wie jede Website, die du öffnest, und bekommen von uns nur unsere zufällige Klicknummer.${consentStores.length > 0 ? ` Bei ${stores(consentStores)} geschieht das nur mit deiner Einwilligung, wie unter Cookies beschrieben.` : ""}`,
  ],

  bases: ({ consentStores }) => [
    "Newsletter, Preisbeobachtungen und Benachrichtigungen schicken wir nur mit deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit mit Wirkung für die Zukunft widerrufen kannst, am einfachsten über den Abmeldelink in jeder E-Mail.",
    "Listen, Kassenbons und Fotos lesen wir, weil du uns darum bittest (Art. 6 Abs. 1 lit. b DSGVO).",
    "Server-Logdateien, die Begrenzung wiederholter Anfragen, Sicherungskopien sowie das Zählen von Klicks (mit ihrer Herkunft), Suchen, Produktprüfungen und Meldungen beruhen auf unserem berechtigten Interesse (Art. 6 Abs. 1 lit. f DSGVO): eine sichere, funktionierende Website, Abrechnung mit Partnerprogrammen und zu wissen, welche Vergleiche fehlen.",
    ...(consentStores.length > 0
      ? ["Tracking durch Händler, das eine Einwilligung verlangt, läuft nur mit deiner (Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG)."]
      : []),
  ],

  rights: [
    "Du hast das Recht auf Auskunft über die Daten, die wir über dich gespeichert haben (Art. 15 DSGVO), auf Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Einer Verarbeitung, die auf unserem berechtigten Interesse beruht, kannst du widersprechen (Art. 21). Eine Einwilligung kannst du jederzeit widerrufen (Art. 7 Abs. 3).",
    "Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere in dem Land, in dem du lebst oder arbeitest (Art. 77 DSGVO).",
    "Wir treffen keine automatisierten Entscheidungen über dich und erstellen keine Profile. Du musst uns keine Daten geben: Ohne E-Mail-Adresse bekommst du nur keine E-Mails von uns.",
  ],

  choices:
    "Jede E-Mail, die wir senden, enthält Abmeldelinks, die mit einem Klick funktionieren: Einer beendet nur diesen Newsletter oder diese Preisbeobachtung, der andere beendet alles, was wir an deine Adresse schicken. Wenn du deine E-Mail-Adresse oder einen Vorschlag löschen lassen möchtest oder wissen willst, was wir über dich gespeichert haben, schreib uns an {mail}.",
  whoRuns: "Wer diese Website betreibt: siehe {impressum}.",
  impressumLink: "Impressum",
};
