import type { Shape } from "../../t";
import type { pageLookup as en } from "../../en/pages/lookup";
import { countryAt } from "../client";

export const pageLookup: Shape<typeof en> = {
  lookingBarcode: "Wir suchen einen Barcode…",
  foundBarcode: (code) => `Barcode ${code} gefunden. Wir schlagen ihn nach…`,
  noBarcode: "Kein Barcode gefunden. Wir lesen das Etikett…",
  unreadable: "Wir konnten das Foto nicht lesen. Tipp stattdessen den Produktnamen ein.",
  found: (name) => `${name} gefunden. Wir prüfen…`,
  photoWrong: "Mit dem Foto ist etwas schiefgelaufen. Versuch es noch einmal oder tipp den Produktnamen ein.",
  placeholder: "Produktname oder Barcode",
  label: "Produktname oder Barcode-Nummer",
  check: "Prüfen",
  scan: "Barcode scannen",
  or: "oder",
  snap: "Etikett fotografieren",
  upload: "Foto hochladen",
  privacy: "Barcodes werden auf deinem Gerät gelesen. Ohne Barcode geht das Foto an unsere Etikettenerkennung und wird nicht gespeichert.",
  findIn: (country, flag) => `So findest du es ${countryAt(country)} ${flag}`,
  findWhere: "So findest du es bei dir",
  searchThis: "Such danach und vergleich dann den Preis pro Einheit:",
  searchStore: (store) => `Bei ${store} suchen`,
  ownLabel: "Deine Apotheke oder dein Supermarkt hat meist dasselbe unter eigenem Namen.",
  chooseCountry: "Wähl dein Land, um Händler zu sehen, die dorthin liefern.",
  pharmacy: (country) =>
    country === "DE" || country === "AT" || country === "CH"
      ? "Die meisten Arzneimittel gibt es dort nur in Apotheken, auch in Online-Apotheken."
      : null,
};
