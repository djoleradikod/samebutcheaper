/**
 * Reads a pasted shopping list or the text of a receipt into product lines. Pure, shared by server and tests.
 *
 * A real receipt is messy: quantities ("2 x"), prices with tax letters ("1.25 A"), store codes, weights, pack
 * counts ("16S"), shouty abbreviations ("NUROFEN 200MG TABS"), and lines that aren't products at all: totals, VAT,
 * card payments, loyalty points, dates, addresses. This keeps brand and product words, keeps a strength (it is part
 * of what the product is), notes a pack size apart (it helps tell two packs of one brand apart) and drops the rest.
 *
 * Nothing here is stored: the matcher reads the result and the request ends.
 */

/** Most characters we read from one paste, and most lines. A long receipt has about 60. */
export const MAX_TEXT = 8000;
export const MAX_LINES = 120;

export type Size = { amount: number; unit: "ml" | "g" | "oz" | "count" };

export type ParsedLine =
  | {
      kind: "item";
      /** 0-based line number in what was pasted. */
      index: number;
      /** The line as typed, trimmed, for the shopper's own screen only. */
      text: string;
      /** Brand and product words, with any strength: what we match on and, for a miss, the only thing we may count. */
      query: string;
      /** Normalised words of the query, see words(). */
      words: string[];
      /** Strengths such as "200mg" or "5%". */
      strengths: string[];
      sizes: Size[];
    }
  | { kind: "noise"; index: number; text: string };

// ---------------------------------------------------------------------------------------------------------------------
// Words

/** Abbreviations on receipts and in lists, to the word the catalogue uses. Applied to both sides. */
const ABBREVIATIONS: Record<string, string> = {
  // forms, so "TABS", "Tabletten" and "caplets" compare
  tab: "tablet",
  tabs: "tablet",
  tablets: "tablet",
  tbl: "tablet",
  tbls: "tablet",
  tabl: "tablet",
  tblt: "tablet",
  tblts: "tablet",
  tabletten: "tablet",
  filmtabletten: "tablet",
  filmtabl: "tablet",
  schmerztabletten: "tablet",
  dragees: "tablet",
  caplet: "tablet",
  caplets: "tablet",
  cplt: "tablet",
  cplts: "tablet",
  cap: "capsule",
  caps: "capsule",
  capsules: "capsule",
  kapseln: "capsule",
  hartkapseln: "capsule",
  // "Zäpfchen" on a German list, "Suppositorien" on the pack
  zapfchen: "suppository",
  zaepfchen: "suppository",
  suppositorien: "suppository",
  suppositories: "suppository",
  softgel: "capsule",
  softgels: "capsule",
  sftgl: "capsule",
  sftgls: "capsule",
  liq: "liquid",
  lqd: "liquid",
  flussig: "liquid",
  fluessig: "liquid",
  // descriptive words, shortened on till rolls
  ex: "extra",
  xtra: "extra",
  str: "strength",
  strgth: "strength",
  stren: "strength",
  orig: "original",
  origin: "original",
  org: "organic",
  choc: "chocolate",
  crm: "cream",
  crmy: "creamy",
  tom: "tomato",
  toms: "tomato",
  ketchp: "ketchup",
  pnt: "peanut",
  btr: "butter",
  ppr: "paper",
  twl: "towel",
  twls: "towel",
  lndry: "laundry",
  det: "detergent",
  pwdr: "powder",
  pdr: "powder",
  pulver: "powder",
  waschpulver: "powder",
  sft: "soft",
  wht: "white",
  dbl: "double",
  lite: "light",
  maximum: "max",
  kids: "children",
  kid: "children",
  childrens: "children",
  child: "children",
  infants: "infant",
  sensitiv: "sensitive",
  colour: "color",
  shmp: "shampoo",
  shamp: "shampoo",
  cond: "conditioner",
  tpaste: "toothpaste",
  mwash: "mouthwash",
  mthwsh: "mouthwash",
  vit: "vitamin",
  multivit: "multivitamin",
  mayonnaise: "mayo",
  mayonaise: "mayo",
  pb: "peanut butter",
};

/** Words that say nothing about which product it is. */
const FILLER = new Set([
  "the", "and", "with", "of", "for", "in", "a", "an", "und", "mit", "fur", "fuer", "der", "die", "das",
  "pack", "pk", "new", "promo", "offer", "multibuy", "each", "ea", "x", "uk", "us", "de",
  // German list words: "Packung", "Stück", "neu", "Aktion"
  "packung", "packungen", "pckg", "stuck", "stueck", "stk", "stck", "flasche", "beutel", "neu", "aktion", "angebot",
]);

/**
 * Lower case words with accents folded, apostrophes dropped ("Hellmann's" is "hellmanns"), a size of nappy or a
 * stage as one word ("size 4", "Gr. 4" are "size4"), "washing up" as one word, abbreviations expanded and a plural
 * "s" taken off. The same function reads the catalogue, so both sides compare.
 */
export function words(text: string): string[] {
  const t = text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/\b(?:size|sz|gr|grosse|groesse|stage|step)\.?\s?(\d{1,2})\b/g, " size$1 ")
    .replace(/\b(?:n|no|nr)\.?\s?(\d{1,3})\b/g, " no$1 ")
    .replace(/\bw\s?\/\s?up\b|\bwash(?:ing)?[\s-]?up\b|\bwshng\s?up\b/g, " washingup ")
    .replace(/\bnon[\s-]?bio\b/g, " nonbio ")
    .replace(/&/g, " and ");
  return t
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(" "))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .flatMap((w) => (ABBREVIATIONS[w] ?? w).split(" "));
}

/** German receipts often write an umlaut out: "LOEWENSENF", "KLARSPUELER". The catalogue is read both ways. */
export function umlautsWrittenOut(text: string) {
  return text.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue");
}

/** Words that can tell one product from another: not filler, not a number, a strength or a size ("200mg", "4lag"). */
export function describing(list: string[]): string[] {
  return list.filter((w) => !FILLER.has(w) && !/^\d/.test(w) && w.length > 1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Strengths and sizes

const STRENGTH = /(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|μg|iu|%)(?![a-z])/gi;

/** "200 MG" and "200mg" are "200mg", "0,1 %" is "0.1%". */
function strengthKey(amount: string, unit: string) {
  const u = unit.toLowerCase().replace(/µg|μg/, "mcg");
  const n = Number(amount.replace(",", "."));
  return `${Number.isFinite(n) ? n : amount}${u}`;
}

export function strengthsIn(text: string): string[] {
  return [...new Set([...text.matchAll(STRENGTH)].map((m) => strengthKey(m[1], m[2])))];
}

const MEASURE_UNITS: Record<string, { unit: Size["unit"]; times: number }> = {
  ml: { unit: "ml", times: 1 },
  cl: { unit: "ml", times: 10 },
  l: { unit: "ml", times: 1000 },
  lt: { unit: "ml", times: 1000 },
  ltr: { unit: "ml", times: 1000 },
  litre: { unit: "ml", times: 1000 },
  litres: { unit: "ml", times: 1000 },
  liter: { unit: "ml", times: 1000 },
  liters: { unit: "ml", times: 1000 },
  g: { unit: "g", times: 1 },
  gr: { unit: "g", times: 1 },
  gram: { unit: "g", times: 1 },
  grams: { unit: "g", times: 1 },
  kg: { unit: "g", times: 1000 },
  oz: { unit: "oz", times: 1 },
  floz: { unit: "oz", times: 1 },
  lb: { unit: "oz", times: 16 },
  lbs: { unit: "oz", times: 16 },
};

/**
 * A measured amount or a count, with what follows the number. Forms (tabs, caps) are counted but their word stays.
 * The German words come first, so "24 Stück" isn't read as "24 St" with "ück" left over.
 */
const SIZE =
  /(\d+(?:[.,]\d+)?)\s?(stc?k\.|btl\.|pckg?\.|st(?:ü|ue|u)ck|stck|packungen?|pckg?|pkg|flaschen?|beutel|btl|rollen?|t(?:ü|ue|u)cher|blatt|waschg(?:ä|ae|a)nge|waschladungen?|wg|fl\.?\s?oz|ml|cl|ltr|litres?|liters?|lt|l|kg|grams?|gr|g|oz|lbs?|ct|count|pk|packs?|s|st|stk|stuck|stueck|wl|washes|wash|loads?|rolls?|rol|sheets?|bags?|nappies|pants|wipes?|pads?|cells?|filters?|tea\s?bags)(?![a-z])/gi;
const COUNTED_FORM = /(\d+)\s?(?:tabs?|tablets?|(?:film|brause|kau|lutsch|schmelz)?tabletten|dragees|caps|capsules?|caplets?|cplts?|softgels?|(?:weich|hart)?kapseln)\b/gi;
const MULTIPACK = /(\d+)\s?[x×]\s?(\d+(?:[.,]\d+)?)\s?(ml|cl|l|g|kg|oz)\b/gi;

function sizeFrom(amount: string, unit: string): Size | null {
  const n = Number(amount.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit.toLowerCase().replace(/[.\s]/g, "");
  const measure = MEASURE_UNITS[u];
  if (measure) return { amount: n * measure.times, unit: measure.unit };
  return { amount: n, unit: "count" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Lines that aren't products

/** A line that starts with one of these is a total, a payment, a loyalty line or the shop's own details. */
const NOISE_START = new RegExp(
  String.raw`^(?:\*+\s*)?(?:sub[\s-]?total|total|totale|summe|zwischensumme|gesamt\w*|zu zahlen|balance|amount due|amount|betrag|` +
    String.raw`tax|taxes|vat|mwst|ust|netto|brutto|change|cash|gegeben|ruckgeld|rueckgeld|card|visa|mastercard|maestro|amex|debit|credit|` +
    String.raw`contactless|kartenzahlung|kreditkarte|ec[\s-]?karte|girocard|payment|paid|tender|auth\w*|approv\w*|ref|terminal|` +
    String.raw`receipt|beleg|bon|kassenbon|rechnung|invoice|thank|thanks|danke|vielen dank|welcome|cashier|kassierer\w*|till|kasse|` +
    String.raw`store|filiale|markt|tel|phone|telefon|www|http|date|datum|time|uhrzeit|steuer\w*|st[\s.-]?nr|tse|serien\w*|transaktion\w*|` +
    String.raw`signatur|items?|artikel|anzahl|savings?|you saved|ihr vorteil|ersparnis|rabatt|discount|coupon|voucher|gutschein|` +
    String.raw`points?|punkte|clubcard|nectar|payback|deutschlandcard|lidl plus|bonus|member|rewards?|loyalty|pfand|leergut|deposit|` +
    String.raw`bag charge|carrier bag|tute|tuete|price|preis|qty|quantity|menge|reg|lane|op|operator|trans|tran|vat no|you were served|served by)\b`,
  "i",
);

/** A section heading in a list or on a receipt, alone on its line. */
const HEADING =
  /^(?:grocery|groceries|produce|fresh|dairy|bakery|frozen|household|health(?: and| &)? beauty|beauty|pharmacy|deli|meat|drinks|beverages|snacks|baby|pet|pets|home|cleaning|toiletries|other|misc|lebensmittel|drogerie|getranke|getraenke|obst(?: und| &)? gemuse|haushalt|shopping list|einkaufsliste|list)\s*:?$/i;

function isNoise(text: string) {
  const t = text.replace(/ß/g, "ss").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
  if (NOISE_START.test(t) || HEADING.test(t)) return true;
  if (/^bar\b[\s:]*[\d€$£-]/i.test(t)) return true; // "BAR 20,00": paid in cash
  if (/^\W*\d+\s+(?:items?|artikel|positionen|posten)\b/i.test(t)) return true; // "*** 12 ITEMS ***"
  if (/\b(?:ltd|limited|plc|gmbh|inc|llc|kg|ohg|e\.?\s?k)\.?$/i.test(t) && !/\d/.test(t)) return true; // the shop's company name
  if (/\*{3,}\s?\d{3,4}|x{4,}\d{3,4}/i.test(t)) return true; // a card number
  if (/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}:\d{2}\b/.test(t)) return true; // a date or a time
  if (/@\s?[£$€]?\s?\d|[£$€]\s?\d+(?:[.,]\d+)?\s?\/\s?(?:kg|lb|100\s?g)|\/\s?kg\b|per kg\b|eur\s?\/\s?kg/i.test(t)) return true; // a weighed-item line
  if (/^-\s?[£$€]?\d|^[£$€]?\s?\d+[.,]\d{2}\s*-$/.test(t)) return true; // a discount on its own line
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// One line

/** What's left of a product line after prices, quantities, sizes and codes are gone: the words a shopper would search. */
function cleanLine(text: string): { query: string; strengths: string[]; sizes: Size[] } {
  let t = ` ${text} `;
  const sizes: Size[] = [];
  const strengths = strengthsIn(t);

  // "2 x", "2x", "QTY 2", "x2" at either end: how many, not what.
  t = t.replace(/^\s*(?:qty\s*)?\d{1,3}\s?[x×*@]\s+/i, " ").replace(/\s[x×*]\s?\d{1,3}\s*$/i, " ");
  // Prices with a currency sign, and the tax band some tills print after them: "£1.25 A", "$3.99", "1,25 €".
  t = t.replace(/-?\s?[£$€]\s?\d+(?:[.,]\d{1,2})?(?:\s+[A-Z*]{1,2}(?=\s*$))?/g, " ").replace(/-?\b\d+[.,]\d{2}\s?(?:€|eur|gbp|usd)\b/gi, " ");
  // Multipacks ("12 x 330ml"), then sizes and counts, each noted and removed.
  t = t.replace(MULTIPACK, (_, n: string, amount: string, unit: string) => {
    const one = sizeFrom(amount, unit);
    if (one) sizes.push({ amount: one.amount * Number(n), unit: one.unit });
    return " ";
  });
  for (const m of t.matchAll(COUNTED_FORM)) sizes.push({ amount: Number(m[1]), unit: "count" });
  t = t.replace(COUNTED_FORM, (whole: string, n: string) => whole.slice(whole.indexOf(n) + n.length));
  t = t.replace(SIZE, (_, amount: string, unit: string) => {
    const s = sizeFrom(amount, unit);
    if (s) sizes.push(s);
    return " ";
  });
  // A bare price at the end, with the tax letter some tills print after it: "3.99 A", "1,49 B", "-0.50".
  t = t.replace(/-?\b\d+[.,]\d{2}(?:\s+[A-Za-z*]{1,2})?\s*$/, " ");
  // Strengths stay in the query, in one written form.
  t = t.replace(STRENGTH, (_, amount: string, unit: string) => ` ${strengthKey(amount, unit)} `);
  // Codes: long digit runs (barcodes, SKUs), "#123", "PLU 4011".
  t = t
    .replace(/#\s?\d+/g, " ")
    .replace(/\b(?:plu|sku|art(?:\.|ikel)?(?:-?nr)?|item)\s?:?\s?\d+\b/gi, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/[|*_=~<>{}[\]]+/g, " ");
  const query = t.replace(/\s+/g, " ").trim();
  return { query, strengths, sizes };
}

/** Every line of a paste: product lines with their query, and the rest marked as noise. Empty lines are skipped. */
export function parseReceipt(text: string): ParsedLine[] {
  const lines = text.slice(0, MAX_TEXT).split(/\r?\n/).slice(0, MAX_LINES);
  const out: ParsedLine[] = [];
  lines.forEach((raw, index) => {
    const text = raw.replace(/\s+/g, " ").trim().replace(/^[-•*·]\s*/, "");
    if (!text) return;
    if (isNoise(text)) {
      out.push({ kind: "noise", index, text });
      return;
    }
    const { query, strengths, sizes } = cleanLine(text);
    const list = words(query);
    const letters = (query.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || describing(list).length === 0) {
      out.push({ kind: "noise", index, text });
      return;
    }
    out.push({ kind: "item", index, text: text.slice(0, 120), query: query.slice(0, 120), words: list, strengths, sizes });
  });
  return out;
}
