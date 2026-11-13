/**
 * A product's name as a German page shows it. The records name products as the shop lists them, then add the pack in
 * English after a comma ("Aspirin 500 mg überzogene Tabletten, 80 tablets"). This puts that last part in German
 * ("…, 80 Tabletten") and leaves the shop's own name alone: a product's name is what it is called on the shelf.
 * The records stay English; this is only the words on the page. A pack it doesn't know stays as written.
 */
import type { Lang } from "./lang";

/** Count words, longest first so "film-coated tablets" wins over "tablets". */
const COUNTED: [RegExp, string][] = [
  [/film-coated tablets?/i, "Filmtabletten"],
  [/coated tablets?/i, "überzogene Tabletten"],
  [/effervescent tablets?/i, "Brausetabletten"],
  [/chewable tablets?/i, "Kautabletten"],
  [/tablets?/i, "Tabletten"],
  [/soft capsules?|softgels?/i, "Weichkapseln"],
  [/capsules?/i, "Kapseln"],
  [/suppositories|suppository/i, "Zäpfchen"],
  [/sachets?/i, "Beutel"],
  [/cells?/i, "Batterien"],
  [/washes|wash loads?/i, "Waschladungen"],
  [/nappies|nappy|diapers?/i, "Windeln"],
  [/pants/i, "Pants"],
  [/wipes?/i, "Tücher"],
  [/sheets?/i, "Blatt"],
  [/filters?/i, "Filter"],
  [/pads?/i, "Pads"],
  [/buds?/i, "Stäbchen"],
  [/pieces?/i, "Stück"],
  [/bags?/i, "Beutel"],
  [/rolls?/i, "Rollen"],
];

const NUMBER = /\d+(?:\.\d+)?/g;
const germanNumber = (s: string) => s.replace(NUMBER, (n) => n.replace(".", ","));

/** One comma part in German, or null when it isn't a pack we know. */
function packDe(part: string): string | null {
  const p = part.trim();
  let m: RegExpMatchArray | null;
  // "4 rolls of 220 sheets"
  if ((m = p.match(/^(\d+) rolls? of (\d+) sheets$/i))) return `${m[1]} Rollen à ${m[2]} Blatt`;
  // "box of 20"
  if ((m = p.match(/^box of (\d+)$/i))) return `${m[1]}er-Packung`;
  // "price per 100 ml", "price per wash", "price per cell"
  if ((m = p.match(/^price per (.+)$/i))) {
    const what = m[1].trim();
    if (/^[\d.]+\s*[a-z]{1,2}$/i.test(what)) return `Preis pro ${germanNumber(what)}`;
    const word = { wash: "Waschladung", cell: "Batterie", tablet: "Tablette", capsule: "Kapsel" }[what.toLowerCase()];
    return word ? `Preis pro ${word}` : null;
  }
  // "cost per day for a 4 kg cat", "cost per day (mid-range)"
  if ((m = p.match(/^cost per day for an? ([\d.]+) kg (cat|dog)$/i))) return `Kosten pro Tag für ${m[2].toLowerCase() === "cat" ? "eine" : "einen"} ${germanNumber(m[1])}-kg-${m[2].toLowerCase() === "cat" ? "Katze" : "Hund"}`;
  if (/^cost per day \(mid-range\)$/i.test(p)) return "Kosten pro Tag (mittlere Menge)";
  if (/^with clips$/i.test(p)) return "mit Clips";
  if (/^preservative-free$/i.test(p)) return "konservierungsmittelfrei";
  // "500 ml spray", "500 ml aerosol", "500 ml aerosol foam"
  if ((m = p.match(/^([\d.]+ ?(?:ml|l)) (spray|aerosol|aerosol foam)$/i))) {
    return `${germanNumber(m[1])} ${{ spray: "Spray", aerosol: "Spraydose", "aerosol foam": "Schaumspray" }[m[2].toLowerCase() as "spray" | "aerosol" | "aerosol foam"]}`;
  }
  // "2 x 80 wipes", "24 tablets", "50 film-coated tablets"
  if ((m = p.match(/^(\d+(?: x \d+)?) ([a-z -]+)$/i))) {
    const found = COUNTED.find(([re]) => new RegExp(`^(?:${re.source})$`, "i").test(m![2].trim()));
    return found ? `${m[1]} ${found[1]}` : null;
  }
  // "1.2 kg", "0.75 l": the decimal comma; whole numbers are the same in both.
  if (/^\d+\.\d+ ?(?:g|kg|ml|l|m|cm|mm)$/i.test(p)) return germanNumber(p);
  return null;
}

/** The name for the page's language: English as written, German with the pack parts after the first comma in German. */
export function productName(name: string, lang: Lang): string {
  if (lang === "en") return name;
  const parts = name.split(", ");
  if (parts.length < 2) return name;
  return [parts[0], ...parts.slice(1).map((part) => packDe(part) ?? part)].join(", ");
}
