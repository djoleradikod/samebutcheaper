/**
 * The catalogue's units in German: "70 Tabletten", "pro 100 g", "pro Waschgang". The catalogue stores units as English
 * words, singular, with a trailing "s" stripped ("stylu", "batterie"). Measures (g, ml, kg) read the same in both.
 * Every unit in the catalogue has an entry here; scripts/tests/i18n.test.ts fails on one that doesn't, so a German page
 * never shows an English unit word.
 */
import { formatNumber } from "./format";
import type { Lang } from "./lang";

/** Singular and plural. */
type Forms = [one: string, many: string];

const MEASURES = /^(fl ?oz|oz|ml|cl|l|g|mg|kg|lb|mah|gb|tb)$/i;

export const UNIT_DE: Record<string, Forms> = {
  tablet: ["Tablette", "Tabletten"],
  caplet: ["Tablette", "Tabletten"],
  capsule: ["Kapsel", "Kapseln"],
  softgel: ["Weichkapsel", "Weichkapseln"],
  pot: ["Topf", "Töpfe"],
  set: ["Set", "Sets"],
  kit: ["Set", "Sets"],
  "7-day kit": ["7-Tage-Set", "7-Tage-Sets"],
  ratchet: ["Ratsche", "Ratschen"],
  litre: ["Liter", "Liter"],
  liter: ["Liter", "Liter"],
  cable: ["Kabel", "Kabel"],
  charger: ["Ladegerät", "Ladegeräte"],
  adapter: ["Adapter", "Adapter"],
  tool: ["Werkzeug", "Werkzeuge"],
  keyboard: ["Tastatur", "Tastaturen"],
  mouse: ["Maus", "Mäuse"],
  tracker: ["Tracker", "Tracker"],
  label: ["Etikett", "Etiketten"],
  pac: ["Tab", "Tabs"],
  serving: ["Portion", "Portionen"],
  "serving (5 g)": ["Portion (5 g)", "Portionen (5 g)"],
  "serving (1 rounded tsp, 5.8 g)": ["Portion (1 gehäufter Teelöffel, 5,8 g)", "Portionen (1 gehäufter Teelöffel, 5,8 g)"],
  sheet: ["Blatt", "Blatt"],
  pair: ["Paar", "Paar"],
  dose: ["Dosis", "Dosen"],
  wash: ["Waschgang", "Waschgänge"],
  washe: ["Waschgang", "Waschgänge"],
  load: ["Waschgang", "Waschgänge"],
  "oz powder": ["oz Pulver", "oz Pulver"],
  packet: ["Päckchen", "Päckchen"],
  patch: ["Pflaster", "Pflaster"],
  nappy: ["Windel", "Windeln"],
  nappie: ["Windel", "Windeln"],
  bag: ["Beutel", "Beutel"],
  roll: ["Rolle", "Rollen"],
  cell: ["Batterie", "Batterien"],
  battery: ["Batterie", "Batterien"],
  batterie: ["Batterie", "Batterien"],
  filter: ["Filter", "Filter"],
  glove: ["Handschuh", "Handschuhe"],
  pad: ["Pad", "Pads"],
  wipe: ["Tuch", "Tücher"],
  metre: ["Meter", "Meter"],
  meter: ["Meter", "Meter"],
  "square metre": ["Quadratmeter", "Quadratmeter"],
  brush: ["Bürste", "Bürsten"],
  pudding: ["Pudding", "Puddings"],
  yard: ["Yard", "Yards"],
  spray: ["Sprühstoß", "Sprühstöße"],
  pen: ["Stift", "Stifte"],
  bud: ["Wattestäbchen", "Wattestäbchen"],
  staple: ["Heftklammer", "Heftklammern"],
  inflator: ["Kompressor", "Kompressoren"],
  count: ["Stück", "Stück"],
  piece: ["Stück", "Stück"],
  each: ["Stück", "Stück"],
  item: ["Stück", "Stück"],
  unit: ["Stück", "Stück"],
  bit: ["Bohrer", "Bohrer"],
  tape: ["Maßband", "Maßbänder"],
  kettle: ["Wasserkocher", "Wasserkocher"],
  egg: ["Ei", "Eier"],
  stylu: ["Eingabestift", "Eingabestifte"],
  stylus: ["Eingabestift", "Eingabestifte"],
  day: ["Tag", "Tage"],
  pan: ["Pfanne", "Pfannen"],
  hub: ["Hub", "Hubs"],
  gummy: ["Fruchtgummi", "Fruchtgummis"],
  gummie: ["Fruchtgummi", "Fruchtgummis"],
  lozenge: ["Lutschtablette", "Lutschtabletten"],
  sachet: ["Beutel", "Beutel"],
  scoop: ["Messlöffel", "Messlöffel"],
  box: ["Schachtel", "Schachteln"],
  boxe: ["Schachtel", "Schachteln"],
  pouch: ["Beutel", "Beutel"],
  pouche: ["Beutel", "Beutel"],
  can: ["Dose", "Dosen"],
  bottle: ["Flasche", "Flaschen"],
  jar: ["Glas", "Gläser"],
  glas: ["Glas", "Gläser"],
  glass: ["Glas", "Gläser"],
  tube: ["Tube", "Tuben"],
  use: ["Anwendung", "Anwendungen"],
};

/** German forms of a unit, or null when there are none (a measure, or a unit nobody has translated yet). */
export function germanUnit(unit: string): Forms | null {
  const raw = unit.trim().toLowerCase();
  if (MEASURES.test(raw)) return null;
  return UNIT_DE[raw] ?? null;
}

/** Whether a unit reads the same in German or has German forms. */
export function hasGermanUnit(unit: string) {
  return MEASURES.test(unit.trim()) || germanUnit(unit) !== null;
}

/** The unit as it follows a number: "Tablette" for 1, "Tabletten" for more. A measure keeps its sign ("ml", "GB" in capitals). */
export function unitWordsFor(unit: string, lang: Lang, size: number) {
  const clean = unit.trim();
  if (lang !== "de") return clean;
  if (MEASURES.test(clean)) return /^(gb|tb)$/i.test(clean) ? clean.toUpperCase() : clean;
  const forms = germanUnit(clean);
  if (!forms) return clean;
  return size === 1 ? forms[0] : forms[1];
}

/** "70 Tabletten", "1,5 kg", "4 Batterien". */
export function packDe(size: number, unit: string) {
  const n = formatNumber(Number(size.toFixed(2)), "de");
  return `${n} ${unitWordsFor(unit, "de", size)}`;
}

/** The shelf label's "per" in German, from the English one unitDisplay gives: "per 100 g" to "pro 100 g", "each" to "pro Stück". */
export function unitLabelDe(englishLabel: string, unit: string) {
  if (englishLabel === "each") return "pro Stück";
  if (englishLabel === "per wash") return "pro Waschgang";
  if (englishLabel === "per cell") return "pro Batterie";
  if (englishLabel === "per litre") return "pro Liter";
  if (englishLabel === "per serving") return "pro Portion";
  const m = englishLabel.match(/^per (.+)$/);
  if (!m) return englishLabel;
  const what = m[1];
  if (/^(100 g|100 ml|100 mg|kg|lb|fl oz|oz)$/.test(what)) return `pro ${what}`;
  if (/^(gb|tb)$/i.test(what)) return `pro ${what.toUpperCase()}`;
  const forms = germanUnit(what) ?? germanUnit(unit);
  return forms ? `pro ${forms[0]}` : `pro ${what}`;
}
