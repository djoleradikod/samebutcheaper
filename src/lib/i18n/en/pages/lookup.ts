/** The product check's form and its "find it where you live" box (LookupForm.tsx, LocalSearch.tsx on /check). */
import { countryInSentence, pharmacyNote } from "../../../markets";

export const pageLookup = {
  lookingBarcode: "Looking for a barcode…",
  foundBarcode: (code: string) => `Found barcode ${code}. Looking it up…`,
  noBarcode: "No barcode found. Reading the label…",
  unreadable: "We couldn't read that photo. Try typing the product name instead.",
  found: (name: string) => `Found ${name}. Checking…`,
  photoWrong: "Something went wrong with that photo. Try again, or type the product name.",
  placeholder: "Product name or barcode",
  label: "Product name or barcode number",
  check: "Check",
  scan: "Scan a barcode",
  or: "or",
  snap: "snap the label",
  upload: "Upload a photo",
  /** `photo`: photos can be read (ANTHROPIC_API_KEY is set). */
  privacy: (photo: boolean): string =>
    photo ? "Barcodes are read on your device. Without a barcode, the photo goes to an outside AI service (Anthropic) to be read, and isn't stored." : "Barcodes are read on your device.",
  findIn: (country: string, flag: string) => `Find it in ${countryInSentence(country)} ${flag}`,
  findWhere: "Find it where you live",
  searchThis: "Search for this, then compare the price per unit:",
  searchStore: (store: string) => `Search ${store}`,
  ownLabel: "Your local pharmacy or supermarket will usually have the same thing under its own label.",
  chooseCountry: "Choose your country to see stores that deliver there.",
  pharmacy: (country: string) => pharmacyNote(country),
};
