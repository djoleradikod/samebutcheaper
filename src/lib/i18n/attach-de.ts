/**
 * For scripts/build-catalog.ts: reads data/i18n/de/ and puts each German text on its record as `de`, or says why not.
 *
 *   data/i18n/de/<pair file>.json   German swap text, keyed by slug (one file per file in data/pairs/)
 *   data/i18n/de/claims.json        German findings, keyed by claim id
 *   data/i18n/de/shelf-life.json    German shelf-life records, keyed by id
 *   data/i18n/de/glossary.json      subcategory names
 *   data/i18n/de/bundles/<file>.json German kit text, keyed by slug (one file per file in data/bundles/)
 *   data/i18n/de/presets/<file>.json German basket text, keyed by slug (one file per file in data/presets/)
 *
 * Every problem is an error, so a German text that doesn't line up with its English, or carries other numbers, fails the
 * build instead of reaching a page.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bundleDeSchema, claimDeSchema, glossaryDeSchema, pairDeFileSchema, presetDeSchema, shelfLifeDeSchema } from "../schema";
import type { Bundle, Claim, Pair, Preset, ShelfLife } from "../types";
import { bundleDeProblems, claimDeProblems, pairDeProblems, presetDeProblems, shelfLifeDeProblems } from "./record-check";
import { z } from "zod";

const OWN_FILES = new Set(["claims.json", "shelf-life.json", "glossary.json"]);

const issues = (e: z.ZodError) => e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");

function read(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function attachGerman(dir: string, pairs: Pair[], claims: Claim[], shelfLives: ShelfLife[], bundles: Bundle[] = [], presets: Preset[] = []): string[] {
  const errors: string[] = [];
  if (!existsSync(dir)) return errors;
  const at = (file: string) => `i18n/de/${file}`;

  let subcategories: Record<string, string> = {};
  if (existsSync(join(dir, "glossary.json"))) {
    const parsed = glossaryDeSchema.safeParse(read(join(dir, "glossary.json")));
    if (parsed.success) subcategories = parsed.data.subcategories;
    else errors.push(`${at("glossary.json")}: ${issues(parsed.error)}`);
  }

  const bySlug = new Map(pairs.map((p) => [p.slug, p]));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && !OWN_FILES.has(f)).sort()) {
    if (!existsSync(join(dir, "..", "..", "pairs", file))) errors.push(`${at(file)}: no data/pairs/${file} to translate`);
    const parsed = pairDeFileSchema.safeParse(read(join(dir, file)));
    if (!parsed.success) {
      errors.push(`${at(file)}: ${issues(parsed.error)}`);
      continue;
    }
    for (const [slug, de] of Object.entries(parsed.data)) {
      const pair = bySlug.get(slug);
      if (!pair) {
        errors.push(`${at(file)} ${slug}: no swap with this slug`);
        continue;
      }
      const problems = pairDeProblems(pair, de);
      if (!subcategories[pair.subcategory]) problems.push(`subcategory "${pair.subcategory}" has no German name in glossary.json`);
      if (problems.length) errors.push(...problems.map((p) => `${at(file)} ${slug}: ${p}`));
      else pair.de = de;
    }
  }

  const keyed = <T,>(file: string, schema: z.ZodType<T>, records: { id: string }[], check: (en: never, de: T) => string[], set: (r: never, de: T) => void) => {
    if (!existsSync(join(dir, file))) return;
    const raw = read(join(dir, file));
    const parsed = z.record(z.string(), schema).safeParse(raw);
    if (!parsed.success) {
      errors.push(`${at(file)}: ${issues(parsed.error)}`);
      return;
    }
    const byId = new Map(records.map((r) => [r.id, r]));
    for (const [id, de] of Object.entries(parsed.data)) {
      const record = byId.get(id);
      if (!record) {
        errors.push(`${at(file)} ${id}: no record with this id`);
        continue;
      }
      const problems = check(record as never, de);
      if (problems.length) errors.push(...problems.map((p) => `${at(file)} ${id}: ${p}`));
      else set(record as never, de);
    }
  };
  keyed("claims.json", claimDeSchema, claims, claimDeProblems, (c: Claim, de) => (c.de = de));
  keyed("shelf-life.json", shelfLifeDeSchema, shelfLives, shelfLifeDeProblems, (s: ShelfLife, de) => (s.de = de));

  // Kits and baskets: one file per English file, keyed by slug, like the swaps.
  const bySlugIn = <R extends { slug: string }>(sub: string, records: R[], schema: z.ZodType, check: (r: R, de: never) => string[], set: (r: R, de: never) => void) => {
    const folder = join(dir, sub);
    if (!existsSync(folder)) return;
    const slugs = new Map(records.map((r) => [r.slug, r]));
    for (const file of readdirSync(folder).filter((f) => f.endsWith(".json")).sort()) {
      if (!existsSync(join(dir, "..", "..", sub, file))) errors.push(`${at(`${sub}/${file}`)}: no data/${sub}/${file} to translate`);
      const parsed = z.record(z.string(), schema).safeParse(read(join(folder, file)));
      if (!parsed.success) {
        errors.push(`${at(`${sub}/${file}`)}: ${issues(parsed.error)}`);
        continue;
      }
      for (const [slug, de] of Object.entries(parsed.data)) {
        const record = slugs.get(slug);
        if (!record) {
          errors.push(`${at(`${sub}/${file}`)} ${slug}: no record with this slug`);
          continue;
        }
        const problems = check(record, de as never);
        if (problems.length) errors.push(...problems.map((p) => `${at(`${sub}/${file}`)} ${slug}: ${p}`));
        else set(record, de as never);
      }
    }
  };
  bySlugIn("bundles", bundles, bundleDeSchema, (b, de) => bundleDeProblems(b, de), (b, de) => (b.de = de));
  bySlugIn("presets", presets, presetDeSchema, (p, de) => presetDeProblems({ ...p, items: p.lines }, de), (p, de) => (p.de = de));
  return errors;
}

/** How much of a market is in German, for the build's summary line. */
export function germanCoverage(pairs: { market: string; de?: unknown }[], market = "DE") {
  const inMarket = pairs.filter((p) => p.market === market);
  return { translated: inMarket.filter((p) => p.de).length, of: inMarket.length, all: pairs.filter((p) => p.de).length };
}
