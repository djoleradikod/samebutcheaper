/**
 * Ranking for the site search (/search, src/components/SearchClient.tsx). Pure and small, so it runs in the browser
 * over the swap index and in tests over the real catalogue (scripts/tests/search-relevance.test.ts).
 *
 * Honest by design: something is a hit only when every word of the search is found in it. Hits come in tiers,
 *   0. the brand-name product's brand ("nurofen" finds Nurofen swaps),
 *   1. a product name: the brand-name product, the cheaper brand or its product ("ibu ratiopharm", "nasenspray"),
 *   2. an active ingredient or generic name, English or German ("ibuprofen", "cetirizin"),
 *   3. the aisle or shelf ("schmerzmittel", "dishwasher tablets"),
 * and a result's tier is its weakest word's: "nurofen saft" is a product-name hit. Spelling slips are only forgiven
 * when nothing matches as typed, and then as a "did you mean" (see `search`), never mixed in with the hits.
 *
 * Words are compared folded: lower case, accents off, and "ae", "oe", "ue" read as "a", "o", "u" on both sides, so
 * "Zäpfchen", "Zaepfchen" and "zapfchen" are one word. German compounds: a search word matches the start of a word
 * ("schmerz" finds "Schmerzmittel"), the end of one when it is a compound's head noun ("spray" finds "Nasenspray"), and
 * a compound search word is split in two when both halves match ("ibuprofensaft").
 */

export type Tier = 0 | 1 | 2 | 3;

/** One searchable text of an item and how much a match in it counts. */
export type Field = readonly [tier: Tier, text: string];

export type Hit<T> = { item: T; tier: Tier; quality: number };

export type SearchResult<T> = {
  hits: Hit<T>[];
  /** Set when nothing matched as typed and a corrected spelling did: the hits are for this query. */
  didYouMean: string | null;
};

/** Words that never narrow a search on their own. */
const STOP = new Set(["the", "and", "for", "of", "vs", "or", "und", "fur", "mit", "von", "der", "die", "das", "oder"]);

/**
 * Head nouns of German compounds (folded), and their English counterparts that run together in product names: a search
 * for one of these also matches it at the end of a longer word. Kept to words that name a kind of product, so a search
 * for an ingredient never matches inside another ingredient ("cetirizin" must not find "Levocetirizin").
 */
const HEADS = new Set(
  [
    "spray", "saft", "sirup", "tabletten", "tablette", "tabs", "tropfen", "salbe", "creme", "gel", "kapseln", "kapsel",
    "pulver", "pflaster", "mittel", "reiniger", "futter", "papier", "beutel", "tucher", "shampoo", "seife", "milch",
    "pasta", "paste", "zapfchen", "losung", "streu", "tabs", "kabel", "batterien", "akkus", "folie", "spuler", "wasser",
    "butter", "kase", "brot", "soße", "sosse", "gewurze", "kleber", "band", "rolle", "wash", "paper", "cleaner",
  ].map(fold),
);

/** Words that only look like a compound with a head noun above ("Geflügel" is poultry, not a gel). */
const NOT_COMPOUNDS = new Set(["geflugel"]);

/** The same thing under another name. Applied to search words, for ingredient, aisle and shelf matches only. */
const SYNONYMS: Record<string, string[]> = {
  paracetamol: ["acetaminophen"],
  acetaminophen: ["paracetamol"],
  ass: ["acetylsalicylsaure", "acetylsalicylic"],
  painkiller: ["pain"],
  painkillers: ["pain"],
  schmerztabletten: ["schmerzmittel"],
  nappies: ["diapers", "nappy"],
  diapers: ["nappies"],
};

/** Lower case, accents and umlauts off, "ae"/"oe"/"ue" as "a"/"o"/"u", "ß" as "ss". */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u");
}

/** The folded words of a text, with numbers and units apart ("400mg" is "400" and "mg"). */
export function tokens(text: string): string[] {
  return fold(text)
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** The words of a text as written, one for each of `tokens(text)`, for showing a corrected spelling. */
function rawTokens(text: string): string[] {
  return text
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .replace(/(\p{L})(\d)/gu, "$1 $2")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The words a search is made of: stop words dropped unless that leaves nothing. */
export function queryWords(query: string): string[] {
  const all = tokens(query);
  const kept = all.filter((w) => !STOP.has(w));
  return kept.length ? kept : all;
}

type Prepared = readonly (readonly [Tier, readonly string[]])[];

/**
 * How well one search word matches a word of the item: 0 the same word, 1 its start, 2 the head of a compound,
 * or null. Words under three letters and numbers must match a whole word ("aa" is not "AAA", "400" is not "4000").
 */
function wordMatch(q: string, w: string, tier: Tier): number | null {
  if (w === q) return 0;
  if (q.length >= 3 && w.startsWith(q) && !/\d/.test(q)) return 1;
  if (tier !== 2 && q.length >= 3 && HEADS.has(q) && w.length >= q.length + 3 && w.endsWith(q) && !NOT_COMPOUNDS.has(w)) return 2;
  return null;
}

/** The best (tier, quality) for one search word in an item, or null when it isn't there. */
function bestFor(q: string, fields: Prepared): [Tier, number] | null {
  let best: [Tier, number] | null = null;
  const alt = SYNONYMS[q];
  for (const [tier, words] of fields) {
    if (best && best[0] < tier) break; // fields are sorted by tier, and a better tier always wins
    for (const w of words) {
      let m = wordMatch(q, w, tier);
      if (m === null && alt && tier >= 2) for (const a of alt) m ??= wordMatch(a, w, tier);
      if (m !== null && (!best || tier < best[0] || (tier === best[0] && m < best[1]))) best = [tier, m];
    }
  }
  return best;
}

/** A compound search word split where both halves are in the item, optionally across a linking "s", "n", "en" or "e". */
function splitMatch(q: string, fields: Prepared): [Tier, number] | null {
  for (let i = 3; i <= q.length - 3; i++) {
    const head = q.slice(i);
    for (const link of ["", "s", "n", "en", "e"]) {
      if (!q.slice(0, i).endsWith(link) || i - link.length < 3) continue;
      const a = bestFor(q.slice(0, i - link.length), fields);
      const b = a && bestFor(head, fields);
      if (a && b) return [Math.max(a[0], b[0]) as Tier, 2];
    }
  }
  return null;
}

/** Where every word of the search is in the item: its tier (the weakest word's) and how loosely it matched. */
function matchItem(words: string[], fields: Prepared): [Tier, number] | null {
  let tier: Tier = 0;
  let quality = 0;
  for (const q of words) {
    const m = bestFor(q, fields) ?? (q.length >= 7 ? splitMatch(q, fields) : null);
    if (!m) return null;
    if (m[0] > tier) tier = m[0];
    quality += m[1];
  }
  return [tier, quality];
}

/** Edit distance with swapped neighbours counting once, giving up past `max`. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0].push(j);
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i].push(d);
      if (d < low) low = d;
    }
    if (i > 0 && low > max) return max + 1;
  }
  return rows[a.length][b.length];
}

/** How many slips a word of this length may have and still be corrected: none under 4 letters. */
const slips = (n: number) => (n < 4 ? 0 : n < 7 ? 1 : 2);

/**
 * A search over a list, built once. `fieldsOf` gives each item's texts with their tiers; items keep their list order
 * within a tier and quality, so the catalogue's own ranking breaks ties.
 */
export function makeSearch<T>(items: readonly T[], fieldsOf: (item: T) => readonly Field[]) {
  // How a folded word was first written, so a "did you mean" reads "Zäpfchen", not "zapfchen".
  const written = new Map<string, string>();
  const prepared = items.map((item) => {
    const byTier = new Map<Tier, Set<string>>();
    for (const [tier, text] of fieldsOf(item)) {
      const set = byTier.get(tier) ?? new Set<string>();
      const folded = tokens(text);
      for (const w of folded) set.add(w);
      byTier.set(tier, set);
      if (tier < 3) {
        const raw = rawTokens(text);
        if (raw.length === folded.length) folded.forEach((w, i) => written.has(w) || written.set(w, raw[i]));
      }
    }
    const fields: Prepared = [...byTier.entries()].sort((a, b) => a[0] - b[0]).map(([t, s]) => [t, [...s]] as const);
    return { item, fields };
  });

  // Words worth correcting to: names and ingredients, with how often each is used, the first spelling seen for display.
  let vocabulary: Map<string, number> | null = null;
  const vocab = () => {
    if (!vocabulary) {
      vocabulary = new Map();
      for (const { fields } of prepared)
        for (const [tier, words] of fields) if (tier < 3) for (const w of words) if (w.length >= 4 && !/\d/.test(w)) vocabulary.set(w, (vocabulary.get(w) ?? 0) + 1);
    }
    return vocabulary;
  };

  function exact(words: string[]): Hit<T>[] {
    if (!words.length) return [];
    const hits: Hit<T>[] = [];
    for (const { item, fields } of prepared) {
      const m = matchItem(words, fields);
      if (m) hits.push({ item, tier: m[0], quality: m[1] });
    }
    // Stable: the list's own order within a tier and quality.
    return hits.sort((a, b) => a.tier - b.tier || a.quality - b.quality);
  }

  /** The closest known word for each search word that isn't a word or the start of one as typed, or null when none is near. */
  function correct(words: string[]): string[] | null {
    const known = vocab();
    let changed = false;
    const out: string[] = [];
    for (const q of words) {
      if (known.has(q) || [...known.keys()].some((w) => w.startsWith(q))) {
        out.push(q);
        continue;
      }
      const max = slips(q.length);
      let best: string | null = null;
      let bestD = max + 1;
      for (const [w, n] of known) {
        const d = distance(q, w, max);
        if (d < bestD || (d === bestD && best !== null && n > (known.get(best) ?? 0))) {
          best = w;
          bestD = d;
        }
      }
      if (!best) return null;
      out.push(best);
      changed = true;
    }
    return changed ? out : null;
  }

  return {
    /** Every hit for the query, best first; with none, the hits for the nearest spelling, as a "did you mean". */
    search(query: string): SearchResult<T> {
      const words = queryWords(query);
      const hits = exact(words);
      if (hits.length) return { hits, didYouMean: null };
      const fixed = correct(words);
      if (!fixed) return { hits: [], didYouMean: null };
      const fixedHits = exact(fixed);
      if (!fixedHits.length) return { hits: [], didYouMean: null };
      return { hits: fixedHits, didYouMean: fixed.map((w) => (words.includes(w) ? w : (written.get(w) ?? w))).join(" ") };
    },
  };
}
