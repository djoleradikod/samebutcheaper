/**
 * Validates every pair in data/pairs/*.json and writes the derived catalog to
 * src/generated/catalog.json. Run automatically before `dev` and `build`.
 *
 *   npm run catalog          # build, fail on any invalid pair
 *   npm run catalog -- --lenient   # skip invalid pairs with a warning
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pairSchema, normalizeUnit, type PairInput } from "../src/lib/schema";
import type { Catalog, Pair } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const DATA_DIR = join(ROOT, "data", "pairs");
const OUT_DIR = join(ROOT, "src", "generated");
const lenient = process.argv.includes("--lenient");

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function derive(p: PairInput): Pair {
  const brandPpu = p.brand.price_usd / p.brand.size;
  const altPpu = p.alternative.price_usd / p.alternative.size;
  const savingsPct = Math.max(0, (1 - altPpu / brandPpu) * 100);
  const savingsPerPack = Math.max(0, (brandPpu - altPpu) * p.brand.size);
  // Favour big percentage savings, with a boost for large absolute savings and
  // a small penalty for medium-confidence matches.
  const confidence = p.confidence === "high" ? 1 : 0.85;
  const score = savingsPct * (1 + Math.log10(1 + savingsPerPack)) * confidence;
  const unit = normalizeUnit(p.brand.unit);
  return {
    ...p,
    brand: { ...p.brand, unit, ppu: round(brandPpu) },
    alternative: { ...p.alternative, unit, ppu: round(altPpu) },
    savingsPct: round(savingsPct, 1),
    savingsPerPack: round(savingsPerPack, 2),
    score: round(score, 2),
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
    const parsed = pairSchema.safeParse(item);
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

if (errors.length) {
  const log = lenient ? console.warn : console.error;
  log(`\n${errors.length} pair(s) rejected:\n  - ${errors.join("\n  - ")}\n`);
  if (!lenient) process.exit(1);
}

pairs.sort((a, b) => b.score - a.score);
const catalog: Catalog = { generatedAt: new Date().toISOString(), pairs };
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "catalog.json"), JSON.stringify(catalog));
console.log(`Catalog built: ${pairs.length} pairs from ${files.length} file(s).`);
