import "server-only";
import { cacheLife } from "next/cache";
import { z } from "zod";
import type { Active, Candidate, LabelMatch, LookupProduct } from "./types";
import { bullets, clip, first, normAmount, overlap, sentenceCase, stripHeading, tokens } from "./text";

/**
 * openFDA drug labels (the same SPL documents DailyMed shows) for US
 * over-the-counter medicines. Free; set OPENFDA_API_KEY for the higher daily
 * quota (https://open.fda.gov/apis/authentication/).
 */
const BASE = "https://api.fda.gov/drug/label.json";
const OTC = 'openfda.product_type:"HUMAN+OTC+DRUG"';

const strs = z.array(z.string()).optional().catch(undefined);
const labelSchema = z.object({
  id: z.string(),
  set_id: z.string().optional().catch(undefined),
  openfda: z
    .object({
      brand_name: strs,
      generic_name: strs,
      manufacturer_name: strs,
      route: strs,
      substance_name: strs,
      upc: strs,
    })
    .catch({})
    .default({}),
  active_ingredient: strs,
  purpose: strs,
  indications_and_usage: strs,
  warnings: strs,
  do_not_use: strs,
  stop_use: strs,
  dosage_and_administration: strs,
  inactive_ingredient: strs,
  package_label_principal_display_panel: strs,
});
export type FdaLabel = z.infer<typeof labelSchema>;

/** A quoted openFDA term: spaces become "+" as the API expects. */
function term(v: string) {
  const clean = v.replace(/["\\()[\]{}:^~*?!]/g, " ").trim();
  return `"${encodeURIComponent(clean).replace(/%20/g, "+")}"`;
}

/**
 * One openFDA query. Throws on network errors and rate limits so a failure is
 * never cached; "no matches" (404) is a normal, cacheable empty result.
 */
async function fdaQuery(search: string, limit: number): Promise<FdaLabel[]> {
  "use cache";
  cacheLife("days");
  const key = process.env.OPENFDA_API_KEY;
  const url = `${BASE}?search=${search}&limit=${limit}${key ? `&api_key=${encodeURIComponent(key)}` : ""}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { accept: "application/json" } });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`openFDA ${res.status}`);
  const json = (await res.json()) as { results?: unknown[] };
  return (json.results ?? []).flatMap((r) => {
    const parsed = labelSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

/* ------------------------------------------------------------- normalising */

const FORMS = [
  "chewable tablet",
  "orally disintegrating tablet",
  "tablet",
  "caplet",
  "capsule",
  "softgel",
  "liquid gel",
  "gelcap",
  "lozenge",
  "gummy",
  "suppository",
  "patch",
  "spray",
  "cream",
  "ointment",
  "gel",
  "powder",
  "packet",
];

function formOf(l: FdaLabel) {
  const text = `${(l.active_ingredient ?? []).join(" ")} ${(l.package_label_principal_display_panel ?? []).join(" ")}`.toLowerCase();
  const each = /in each ([a-z -]+?)\)/.exec(text)?.[1];
  const pool = each ? `${each} ${text}` : text;
  if (/\b\d+(\.\d+)?\s*ml\b/.test(each ?? "")) return "liquid";
  return FORMS.find((f) => pool.includes(f)) ?? "";
}

/** Strength of one substance from the "Active ingredient" text, e.g. "Loratadine 10 mg". */
function strengthOf(substance: string, activeText: string) {
  const words = substance.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  for (const w of words.slice(0, 2)) {
    const re = new RegExp(
      `${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^0-9%]{0,45}?(\\d+(?:\\.\\d+)?)\\s*(mg|mcg|µg|g|%|iu|units?)\\b`,
      "i",
    );
    const m = re.exec(activeText);
    if (m) return `${m[1]} ${m[2].toLowerCase() === "units" ? "units" : m[2].toLowerCase()}`.replace(" %", "%");
  }
  return "";
}

function activesOf(l: FdaLabel): Active[] {
  const text = (l.active_ingredient ?? []).join(" ");
  return (l.openfda.substance_name ?? []).map((s) => ({ name: sentenceCase(s), amount: strengthOf(s, text) }));
}

/** Known US store brands, matched against the brand name and the labeller. */
const STORE_BRANDS: [RegExp, string][] = [
  [/wal-?mart|\bequate\b/i, "Walmart (Equate)"],
  [/target corp|up ?& ?up/i, "Target (up&up)"],
  [/costco|kirkland/i, "Costco (Kirkland Signature)"],
  [/sam'?s west|sam'?s club|member'?s mark/i, "Sam's Club (Member's Mark)"],
  [/\bcvs\b/i, "CVS Health"],
  [/walgreen/i, "Walgreens"],
  [/rite ?aid/i, "Rite Aid"],
  [/amazon/i, "Amazon (Basic Care)"],
  [/kroger/i, "Kroger"],
  [/dolgencorp|dollar general/i, "Dollar General"],
  [/family dollar/i, "Family Dollar"],
  [/meijer/i, "Meijer"],
  [/\bh-?e-?b\b|h e b/i, "H-E-B"],
  [/publix/i, "Publix"],
  [/safeway|signature care/i, "Safeway"],
  [/hy-?vee/i, "Hy-Vee"],
  [/topco|topcare/i, "TopCare (grocery chains)"],
  [/good neighbor|amerisource/i, "Good Neighbor Pharmacy"],
  [/cardinal health|\bleader\b/i, "Leader (Cardinal Health)"],
  [/sunmark|health ?mart|mckesson/i, "Health Mart (Sunmark)"],
  [/chain drug|quality choice/i, "Quality Choice"],
];

export function storeBrandOf(brand: string, manufacturer: string) {
  const hay = `${brand} ${manufacturer}`;
  return STORE_BRANDS.find(([re]) => re.test(hay))?.[1] ?? null;
}

function dailyMedUrl(l: FdaLabel) {
  return l.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${l.set_id}` : null;
}

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Bulleted label section items, each starting with the section's own words. */
function prefixed(texts: string[] | undefined, heading: string) {
  return (texts ?? []).flatMap((t) => bullets(stripHeading(t, heading)).map((b) => `${heading} ${b}`));
}

export function fdaToProduct(l: FdaLabel): LookupProduct {
  const o = l.openfda;
  const brand = sentenceCase(first(o.brand_name) ?? first(o.generic_name) ?? "Unknown");
  const uses = [
    ...(l.purpose ?? []).map((p) => stripHeading(p, "Purposes?")),
    ...(l.indications_and_usage ?? []).map((u) => stripHeading(u, "Uses?", "Indications (?:and|&) usage")),
  ]
    .filter(Boolean)
    .map((u) => clip(capFirst(u), 420));
  // "Do not use" and "Stop use" are part of the meaning, so they stay on each item.
  const warnings = [
    ...prefixed(l.do_not_use, "Do not use"),
    ...prefixed(l.stop_use, "Stop use and ask a doctor if"),
    ...(l.warnings ?? []).flatMap((w) => bullets(stripHeading(w, "Warnings?"))).map(capFirst),
  ]
    .filter((w, i, all) => all.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i)
    .slice(0, 6)
    .map((w) => clip(w, 220));
  const inactive = (l.inactive_ingredient ?? [])
    .map((t) => stripHeading(t, "Inactive ingredients?"))
    .join(", ")
    .split(/,\s*/)
    .map((s) => s.trim().replace(/\.$/, ""))
    .filter(Boolean);
  return {
    source: "fda",
    id: l.set_id ?? l.id,
    url: dailyMedUrl(l),
    brand,
    name: sentenceCase(first(o.generic_name) ?? brand),
    kind: "medicine",
    category: "otc-medicine",
    size: "",
    form: formOf(l),
    upc: first(o.upc) ?? null,
    actives: activesOf(l),
    ingredients: inactive,
    uses,
    directions: l.dosage_and_administration?.length
      ? clip(capFirst(stripHeading(l.dosage_and_administration.join(" "), "Directions?", "Dosage and administration")), 600)
      : null,
    warnings,
    countries: ["US"],
    manufacturer: first(o.manufacturer_name) ?? null,
    image: null,
  };
}

function candidateOf(l: FdaLabel): Candidate {
  const p = fdaToProduct(l);
  const strength = p.actives.map((a) => `${a.name}${a.amount ? ` ${a.amount}` : ""}`).join(" + ");
  return {
    source: "fda",
    id: p.id,
    brand: p.brand,
    name: p.manufacturer ?? "",
    detail: [strength, p.form].filter(Boolean).join(" · "),
    kind: "medicine",
    image: null,
  };
}

/* ----------------------------------------------------------------- queries */

/** OTC medicines by brand or generic name, best matches first, one per label. */
export async function searchFda(q: string): Promise<Candidate[]> {
  const t = tokens(q).slice(0, 5);
  if (!t.length) return [];
  const phrase = term(t.join(" "));
  const queries = [`(openfda.brand_name:${phrase}+openfda.generic_name:${phrase})+AND+${OTC}`];
  if (t.length > 1 && t[0].length >= 4) queries.push(`openfda.brand_name:${term(t[0])}+AND+${OTC}`);
  const results = (await Promise.all(queries.map((s) => fdaQuery(s, 30)))).flat();

  const seen = new Set<string>();
  const out: { c: Candidate; score: number }[] = [];
  for (const l of results) {
    const c = candidateOf(l);
    const key = `${c.brand}|${c.detail}`.toLowerCase();
    if (seen.has(key) || seen.has(c.id)) continue;
    seen.add(key);
    seen.add(c.id);
    const brandScore = overlap(q, `${c.brand} ${(l.openfda.generic_name ?? []).join(" ")}`);
    out.push({ c, score: brandScore + (storeBrandOf(c.brand, c.name) ? 0 : 0.05) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 10).map((x) => x.c);
}

export async function fdaBySetId(setId: string): Promise<LookupProduct | null> {
  if (!/^[a-f0-9-]{20,64}$/i.test(setId)) return null;
  const [l] = await fdaQuery(`set_id:${term(setId)}`, 1);
  return l ? fdaToProduct(l) : null;
}

export async function fdaByUpc(variants: string[]): Promise<LookupProduct | null> {
  if (!variants.length) return null;
  const search = `(${variants.map((v) => `openfda.upc:${term(v)}`).join("+")})`;
  const [l] = await fdaQuery(search, 1);
  return l ? fdaToProduct(l) : null;
}

/**
 * Other OTC labels with exactly the same active ingredients at the same
 * strength and in the same form, store brands first.
 */
export async function fdaSameActives(product: LookupProduct): Promise<LabelMatch[]> {
  const names = product.actives.map((a) => a.name.toUpperCase());
  if (!names.length || names.length > 4) return [];
  const search = [...names.map((n) => `openfda.substance_name:${term(n)}`), OTC].join("+AND+");
  const labels = await fdaQuery(search, 100);

  const want = new Map(product.actives.map((a) => [a.name.toUpperCase(), normAmount(a.amount)]));
  const seen = new Set<string>();
  const out: LabelMatch[] = [];
  for (const l of labels) {
    const p = fdaToProduct(l);
    if (p.id === product.id) continue;
    if (p.actives.length !== want.size) continue;
    const sameStrength = p.actives.every((a) => {
      const w = want.get(a.name.toUpperCase());
      return w !== undefined && (!w || !a.amount || w === normAmount(a.amount));
    });
    if (!sameStrength) continue;
    if (product.form && p.form && product.form !== p.form) continue;
    const manufacturer = p.manufacturer ?? "";
    const key = `${p.brand}|${manufacturer}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: p.id, brand: p.brand, manufacturer, storeBrand: storeBrandOf(p.brand, manufacturer), url: p.url });
  }
  return out.sort((a, b) => Number(!!b.storeBrand) - Number(!!a.storeBrand)).slice(0, 16);
}
