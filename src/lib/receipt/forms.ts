/**
 * What form a product comes in, read from words on a receipt line or in a product name, in German and English:
 * "SAFT", "Sirup", "syrup" and "Suspension" are all a liquid to swallow, "Tabletten" and "TABS" a tablet. The list
 * matcher (./match.ts) uses it to narrow a brand's products: "NUROFEN SAFT 100ML" is the Junior syrup, never the
 * tablets. Words come in as ./parse.ts `words()` gives them: lower case, umlauts folded, a plural "s" off and
 * abbreviations expanded ("TABS" and "Tabletten" are already "tablet").
 */

export type Form =
  | "tablet"
  | "capsule"
  | "liquid"
  | "drop"
  | "spray"
  | "gel"
  | "cream"
  | "ointment"
  | "suppository"
  | "powder"
  | "sachet"
  | "lozenge"
  | "chewable"
  | "effervescent"
  | "patch";

/** Whole words, after parse.ts `words()`. */
const WORDS: Record<string, Form> = {
  tablet: "tablet",
  dragee: "tablet",
  capsule: "capsule",
  kapsel: "capsule",
  weichkapsel: "capsule",
  weichkapseln: "capsule",
  liquid: "liquid",
  syrup: "liquid",
  sirup: "liquid",
  saft: "liquid",
  suspension: "liquid",
  losung: "liquid",
  loesung: "liquid",
  elixir: "liquid",
  drop: "drop",
  tropfen: "drop",
  spray: "spray",
  gel: "gel",
  duschgel: "gel",
  schmerzgel: "gel",
  kuhlgel: "gel",
  kuehlgel: "gel",
  wundgel: "gel",
  waschgel: "gel",
  cream: "cream",
  creme: "cream",
  ointment: "ointment",
  salbe: "ointment",
  suppository: "suppository",
  powder: "powder",
  granulat: "powder",
  granule: "powder",
  sachet: "sachet",
  lozenge: "lozenge",
  pastille: "lozenge",
  pastillen: "lozenge",
  lutschtablette: "lozenge",
  lutschtabletten: "lozenge",
  chewable: "chewable",
  kautablette: "chewable",
  kautabletten: "chewable",
  effervescent: "effervescent",
  brausetablette: "effervescent",
  brausetabletten: "effervescent",
  patch: "patch",
  patche: "patch",
  pflaster: "patch",
};

/**
 * German compound endings that carry the form: "Hustensaft", "Nasenspray", "Augentropfen", "Wundsalbe". Checked
 * longest first, so "Lutschtabletten" is a lozenge before it is a tablet. Endings short enough to hide inside other
 * words ("gel" in "Geflügel") are only matched whole, above.
 */
const ENDINGS: [string, Form][] = (
  [
    ["lutschtabletten", "lozenge"],
    ["brausetabletten", "effervescent"],
    ["kautabletten", "chewable"],
    ["tabletten", "tablet"],
    ["kapseln", "capsule"],
    ["tropfen", "drop"],
    ["zapfchen", "suppository"],
    ["zaepfchen", "suppository"],
    ["sirup", "liquid"],
    ["saft", "liquid"],
    ["losung", "liquid"],
    ["loesung", "liquid"],
    ["spray", "spray"],
    ["salbe", "ointment"],
    ["creme", "cream"],
    ["pulver", "powder"],
    ["pflaster", "patch"],
  ] as [string, Form][]
).sort((a, b) => b[0].length - a[0].length);

/** The form one word names, or null. */
export function formOf(word: string): Form | null {
  const whole = WORDS[word];
  if (whole) return whole;
  for (const [ending, form] of ENDINGS) if (word.length > ending.length + 2 && word.endsWith(ending)) return form;
  return null;
}

/**
 * The forms a list of words names. "Liquid" and "gel" next to "capsules" describe the capsule ("liquid capsules",
 * "gel caps"), so they don't count as forms of their own there.
 */
export function formsIn(list: readonly string[]): Set<Form> {
  const forms = new Set<Form>();
  for (const w of list) {
    const f = formOf(w);
    if (f) forms.add(f);
  }
  if (forms.has("capsule")) {
    forms.delete("liquid");
    forms.delete("gel");
  }
  return forms;
}
