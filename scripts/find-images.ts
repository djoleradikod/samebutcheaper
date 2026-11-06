/**
 * Adds label images from DailyMed (U.S. National Library of Medicine) to US OTC
 * medicines in data/pairs and data/bundles, as the `image` URL on each product.
 * The site doesn't show these: rights in a maker's label art aren't confirmed, so
 * data/images.json records them as "Rights not confirmed". Open Facts photos come
 * from scripts/fetch-images.ts.
 *
 *   npx tsx scripts/find-images.ts          # only products without an image
 *   npx tsx scripts/find-images.ts --redo   # look every OTC product up again
 *
 * A match needs the same active ingredients (and salt), the same dosage form
 * and no variant word (children's, PM, migraine...) that our product lacks.
 * The carton or principal display panel is preferred over the Drug Facts panel.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const redo = process.argv.includes("--redo");
const UA = "SameButCheaper image finder (+https://samebutcheaper.com/how-we-verify)";

export type ImageEntry = {
  file: string | null;
  source: "dailymed";
  credit: string;
  license: string;
  page: string | null;
  matched: string | null;
};

type Side = { brand: string; product: string; unit: string; key_ingredients?: { name: string }[] };
type Item = { category: string; market?: string; side: Side };

const key = (s: Side) => `${s.brand}|${s.product}`;
const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
const STOP = new Set(["the", "and", "for", "with", "count", "pack", "tablets", "tablet", "oz", "fl", "ct", "mg", "size"]);
const overlap = (a: string, b: string) => {
  const A = new Set(words(a));
  const B = words(b);
  if (!A.size || !B.length) return 0;
  return B.filter((w) => A.has(w)).length / Math.min(A.size, B.length);
};

async function getJson(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
      if (r.status === 429 || r.status >= 500) {
        await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
        continue;
      }
      if (!r.ok) return null;
      return await r.json();
    } catch {
      await new Promise((res) => setTimeout(res, 1000));
    }
  }
  return null;
}

/* ------------------------------------------------------------- DailyMed */

// US store brands and the labeler name DailyMed files them under.
const LABELERS: Record<string, string> = {
  equate: "walmart",
  "member's mark": "sam's west",
  "kirkland signature": "costco",
  kirkland: "costco",
  "up&up": "target",
  "up & up": "target",
  "amazon basic care": "amazon",
  "basic care": "amazon",
  cvs: "cvs",
  "cvs health": "cvs",
  walgreens: "walgreen",
  "good neighbor pharmacy": "amerisource",
  "health mart": "mckesson",
};
const VARIANTS = [/jock/, /vapor/, /severe/, /\bdm\b/, /multi-symptom/, /child|junior|infant|kids/, /orally disintegrating|\bodt\b|dissolv/, /menstrual/, /sensimist/, /liquid filled|capsule/, /chewable|chew/, /migraine/, /extra strength/, /pm\b|night/, /sinus|congestion|\bd\b/, /cool mint|icy/];
const FORM_WORDS: Record<string, string[]> = {
  tablet: ["tablet"],
  caplet: ["tablet"],
  softgel: ["capsule", "softgel", "liquid filled"],
  capsule: ["capsule"],
  gelcap: ["capsule", "gel"],
  "fl oz": ["liquid", "solution", "suspension", "syrup"],
  ml: ["liquid", "solution", "suspension", "spray", "syrup"],
  oz: ["cream", "gel", "ointment", "powder", "liquid"],
  g: ["cream", "gel", "ointment", "powder"],
  lozenge: ["lozenge"],
  gum: ["gum"],
  patch: ["patch"],
  spray: ["spray"],
};

async function fromDailyMed(item: Item): Promise<ImageEntry | null> {
  const s = item.side;
  const active = (s.key_ingredients?.[0]?.name ?? "").split(/[ (]/)[0];
  const labeler = LABELERS[s.brand.toLowerCase()];
  const queries = labeler
    ? [`drug_name=${encodeURIComponent(active)}&labeler=${encodeURIComponent(labeler)}`]
    : [`drug_name=${encodeURIComponent(s.brand)}`, `drug_name=${encodeURIComponent(words(s.product).slice(0, 2).join(" "))}`];
  const forms = FORM_WORDS[s.unit] ?? [];
  type Spl = { title: string; setid: string };
  let best: { spl: Spl; score: number } | null = null;
  for (const q of queries) {
    const res = await getJson(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?${q}&pagesize=40`);
    for (const spl of (res?.data ?? []) as Spl[]) {
      const t = spl.title.toLowerCase();
      if (active && !t.includes(active.toLowerCase())) continue;
      // The label's active ingredients (in brackets in the title) must be exactly ours.
      const labelActives = [...t.matchAll(/\(([^()]+)\)/g)].flatMap((m) => m[1].split(/,| and /)).map((a) => a.trim()).filter(Boolean);
      const ours = (s.key_ingredients ?? []).map((i) => i.name.toLowerCase().split(/[ (]/)[0]);
      if (labelActives.length && ours.length && new Set(labelActives.map((a) => a.split(" ")[0])).size !== new Set(ours).size) continue;
      if (ours.some((o) => !labelActives.some((a) => a.startsWith(o)))) continue;
      if (forms.length && !forms.some((f) => t.includes(f))) continue;
      // Words that mark a different product variant; skip unless our product says them too.
      const prod = s.product.toLowerCase();
      const variant = VARIANTS.find((v) => v.test(t) && !v.test(prod));
      if (variant) continue;
      // Same salt: "ibuprofen sodium" is not "ibuprofen", "fluticasone furoate" is not "propionate".
      const ourFull = (s.key_ingredients ?? []).map((i) => i.name.toLowerCase().replace(/\(.*?\)/g, "").trim());
      const salts = ["sodium", "furoate", "propionate", "potassium", "magnesium", "hydrobromide", "hcl", "hydrochloride"];
      if (ourFull.some((o) => { const base = o.split(" ")[0]; const la = labelActives.find((a) => a.startsWith(base)); if (!la) return false; return salts.some((x) => la.includes(x) !== (o.includes(x) || (x === "hydrochloride" && o.includes("hcl")) || (x === "hcl" && o.includes("hydrochloride")))); })) continue;
      if (!labeler && !t.includes(s.brand.toLowerCase().split(" ")[0])) continue;
      let score = overlap(`${s.brand} ${s.product}`, spl.title);
      if (forms.some((f) => t.includes(f))) score += 0.5;
      if (/kit|combo/.test(t) && !/kit|combo/i.test(s.product)) score -= 0.5;
      if (!best || score > best.score) best = { spl, score };
    }
    if (best && best.score >= 0.8) break;
  }
  if (!best || best.score < 0.7) return null;
  const media = await getJson(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/${best.spl.setid}/media.json`);
  const imgs = ((media?.data?.media ?? []) as { name: string; url: string; mime_type: string }[]).filter((m) =>
    m.mime_type.startsWith("image/"),
  );
  const rank = (n: string) =>
    (/carton|pdp|principal|display/i.test(n) ? 3 : /package|front|box|bottle/i.test(n) ? 2 : /label/i.test(n) ? 1 : 0) -
    (/dfl|drug.?facts|back|side|insert|structure|chem|formula|blister/i.test(n) ? 3 : 0);
  const pick = imgs.sort((a, b) => rank(b.name) - rank(a.name))[0];
  if (!pick || rank(pick.name) < 0) return null;
  return {
    file: pick.url,
    source: "dailymed",
    credit: "DailyMed, U.S. National Library of Medicine",
    license: "Rights not confirmed",
    page: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${best.spl.setid}`,
    matched: best.spl.title,
  };
}

/* ----------------------------------------------------------------- main */

async function main() {
  let found = 0;
  let missed = 0;
  for (const dir of ["pairs", "bundles"]) {
    const d = join(ROOT, "data", dir);
    for (const f of readdirSync(d).filter((n) => n.endsWith(".json"))) {
      const path = join(d, f);
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw);
      let changed = false;
      for (const p of data) {
        if (p.category !== "otc-medicine" || (p.market ?? "US") !== "US") continue;
        const sides: Side[] = dir === "pairs" ? [p.brand, p.alternative] : (p.components ?? []);
        for (const side of sides as (Side & { image?: string | null })[]) {
          if (side.image && !redo) continue;
          const hit = await fromDailyMed({ category: p.category, market: p.market, side });
          if (!hit?.file) {
            missed++;
            continue;
          }
          side.image = hit.file;
          changed = true;
          found++;
          console.log(`+ ${key(side)}  <- ${hit.matched}`);
        }
      }
      if (changed) {
        const indent = /^\[\n( +)/.exec(raw)?.[1].length ?? 2;
        writeFileSync(path, JSON.stringify(data, null, indent) + "\n");
      }
    }
  }
  console.log(`\nDailyMed images found: ${found}, not found: ${missed}`);
}

main();
