/**
 * Validates every pair in data/pairs/*.json and writes the derived catalog to
 * src/generated/catalog.json. Run automatically before `dev` and `build`.
 *
 *   npm run catalog          # build, fail on any invalid pair
 *   npm run catalog -- --lenient   # skip invalid pairs with a warning
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  bundleSchema,
  migrateLegacyPrices,
  normalizeUnit,
  pairSchema,
  type BundleInput,
  type MatchType,
  type PairInput,
} from "../src/lib/schema";
import { APPROX_USD, MARKETS, type LookFor } from "../src/lib/markets";
import { dupeSlugFor } from "../src/lib/dupes";
import type { Bundle, Catalog, Pair } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const DATA_DIR = join(ROOT, "data", "pairs");
const BUNDLE_DIR = join(ROOT, "data", "bundles");
const OUT_DIR = join(ROOT, "src", "generated");
const lenient = process.argv.includes("--lenient");

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

const FORMS: Record<string, string> = {
  tablet: "tablets",
  caplet: "caplets",
  capsule: "capsules",
  softgel: "softgels",
  gelcap: "gelcaps",
  gummy: "gummies",
  gummie: "gummies",
  lozenge: "lozenges",
};

/** US store brands: nobody abroad can buy them, so their names are dropped from search phrases. */
const US_STORE_BRANDS = [
  "equate",
  "great value",
  "kirkland signature",
  "kirkland",
  "member's mark",
  "members mark",
  "parent's choice",
  "good & gather",
  "up&up",
  "up & up",
  "spring valley",
  "mainstays",
  "market pantry",
  "simply",
];

/** "Equate Allergy Relief Loratadine Tablets, 100 Count" -> "Allergy Relief Loratadine Tablets" */
function cleanName(name: string) {
  let n = name;
  for (const b of US_STORE_BRANDS) {
    if (n.toLowerCase().startsWith(b + " ")) n = n.slice(b.length + 1);
  }
  return n
    .replace(/,.*$/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\(.*$/, "")
    .replace(/\b\d+(\.\d+)?\s*(count|ct|pack|pk|tablets?|capsules?|softgels?|caplets?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** What to search for where this listing doesn't deliver. */
function lookFor(
  matchType: MatchType,
  product: { product: string; unit: string; key_ingredients: { name: string; amount: string }[] },
  override?: string,
): LookFor {
  if (override) return { text: override };
  const text = cleanName(product.product);
  const actives = product.key_ingredients.filter((k) => k.name.length <= 60);
  if (matchType === "identical_active" && actives.length >= 1 && actives.length <= 4) {
    return {
      text,
      actives: actives.map((a) => ({ name: a.name, amount: a.amount })),
      form: FORMS[normalizeUnit(product.unit)],
    };
  }
  return { text };
}

function derive(p: PairInput): Pair {
  const brandPpu = p.brand.price / p.brand.size;
  const altPpu = p.alternative.price / p.alternative.size;
  const savingsPct = Math.max(0, (1 - altPpu / brandPpu) * 100);
  const savingsPerPack = Math.max(0, (brandPpu - altPpu) * p.brand.size);
  // Favour big percentage savings, with a boost for large absolute savings and
  // a small penalty for medium-confidence matches.
  const confidence = p.confidence === "high" ? 1 : 0.85;
  const currency = MARKETS[p.market].currency;
  // Rank in rough US dollars so savings in different currencies compare fairly.
  const score = savingsPct * (1 + Math.log10(1 + savingsPerPack * APPROX_USD[currency])) * confidence;
  const unit = normalizeUnit(p.brand.unit);
  return {
    ...p,
    brand: { ...p.brand, unit, ppu: round(brandPpu) },
    alternative: { ...p.alternative, unit, ppu: round(altPpu) },
    savingsPct: round(savingsPct, 1),
    savingsPerPack: round(savingsPerPack, 2),
    score: round(score, 2),
    currency,
    lookFor: lookFor(p.match_type, p.alternative, p.look_for),
  };
}

function deriveBundle(b: BundleInput): Bundle {
  const components = b.components.map((c) => {
    const ppu = c.price / c.size;
    const item = b.bundle.items[c.replaces];
    return {
      ...c,
      unit: normalizeUnit(c.unit),
      ppu: round(ppu),
      equivalentCost: round(ppu * item.size, 2),
      lookFor: lookFor(c.match_type, c, c.look_for),
    };
  });
  const equivalentTotal = components.reduce((s, c) => s + c.equivalentCost, 0);
  const upfrontTotal = components.reduce((s, c) => s + c.price, 0);
  const savings = Math.max(0, b.bundle.price - equivalentTotal);
  const savingsPct = Math.max(0, (savings / b.bundle.price) * 100);
  const confidence = b.confidence === "high" ? 1 : 0.85;
  const currency = MARKETS[b.market].currency;
  return {
    ...b,
    currency,
    bundle: { ...b.bundle, items: b.bundle.items.map((i) => ({ ...i, unit: normalizeUnit(i.unit) })) },
    components: [...components].sort((x, y) => x.replaces - y.replaces),
    equivalentTotal: round(equivalentTotal, 2),
    upfrontTotal: round(upfrontTotal, 2),
    savings: round(savings, 2),
    savingsPct: round(savingsPct, 1),
    score: round(savingsPct * (1 + Math.log10(1 + savings * APPROX_USD[currency])) * confidence, 2),
  };
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
const pairs: Pair[] = [];
const seen = new Set<string>();
const errors: string[] = [];

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(DATA_DIR, file), "utf8"));
  if (!Array.isArray(raw)) {
    errors.push(`${file}: expected a JSON array`);
    continue;
  }
  raw.forEach((item, i) => {
    const parsed = pairSchema.safeParse(migrateLegacyPrices(item));
    const label = `${file}[${i}] ${item?.slug ?? "(no slug)"}`;
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
        .join("; ");
      errors.push(`${label}: ${msg}`);
      return;
    }
    if (seen.has(parsed.data.slug)) {
      errors.push(`${label}: duplicate slug`);
      return;
    }
    const pair = derive(parsed.data);
    if (pair.savingsPct < 5) {
      errors.push(`${label}: alternative is not meaningfully cheaper (${pair.savingsPct}%)`);
      return;
    }
    seen.add(pair.slug);
    pairs.push(pair);
  });
}

const bundles: Bundle[] = [];
let bundleFiles: string[] = [];
try {
  bundleFiles = readdirSync(BUNDLE_DIR).filter((f) => f.endsWith(".json")).sort();
} catch {
  /* no bundles yet */
}
for (const file of bundleFiles) {
  const raw = JSON.parse(readFileSync(join(BUNDLE_DIR, file), "utf8"));
  if (!Array.isArray(raw)) {
    errors.push(`bundles/${file}: expected a JSON array`);
    continue;
  }
  raw.forEach((item, i) => {
    const label = `bundles/${file}[${i}] ${item?.slug ?? "(no slug)"}`;
    const parsed = bundleSchema.safeParse(migrateLegacyPrices(item));
    if (!parsed.success) {
      errors.push(
        `${label}: ${parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`,
      );
      return;
    }
    if (seen.has(parsed.data.slug)) {
      errors.push(`${label}: duplicate slug (slugs are shared with pairs)`);
      return;
    }
    const bundle = deriveBundle(parsed.data);
    if (bundle.savingsPct < 5) {
      errors.push(`${label}: building it yourself is not meaningfully cheaper (${bundle.savingsPct}%)`);
      return;
    }
    seen.add(bundle.slug);
    bundles.push(bundle);
  });
}

if (errors.length) {
  const log = lenient ? console.warn : console.error;
  log(`\n${errors.length} item(s) rejected:\n  - ${errors.join("\n  - ")}\n`);
  if (!lenient) process.exit(1);
}

pairs.sort((a, b) => b.score - a.score);
bundles.sort((a, b) => b.score - a.score);
const catalog: Catalog = { generatedAt: new Date().toISOString(), pairs, bundles };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "catalog.json"), JSON.stringify(catalog));
// Small list for the proxy, so a page that doesn't exist answers with a real 404.
writeFileSync(
  join(OUT_DIR, "known-slugs.json"),
  JSON.stringify({
    compare: catalog.pairs.map((p) => p.slug),
    bundle: catalog.bundles.map((b) => b.slug),
    dupe: [...new Set(catalog.pairs.map(dupeSlugFor))],
  }),
);
console.log(`Catalog built: ${pairs.length} pairs from ${files.length} file(s), ${bundles.length} bundles from ${bundleFiles.length} file(s).`);
