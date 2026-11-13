/**
 * The price observation log: data/prices/observations/*.jsonl, one JSON object per line, append-only.
 * Every price the site shows should be backed by at least one line here. See "Price observations" in
 * data/README.md and docs/prices.md.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export const ROOT = join(import.meta.dirname, "..", "..");
export const PRICES_DIR = join(ROOT, "data", "prices");
export const OBSERVATIONS_DIR = join(PRICES_DIR, "observations");
export const REVIEW_FILE = join(PRICES_DIR, "review.json");

export const METHODS = ["hand", "open-prices", "feed", "shopper-report"] as const;
export type Method = (typeof METHODS)[number];

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO day, YYYY-MM-DD");

/** "brand" and "alternative" on a swap; "kit" and "item-<n>" (the bundle item it replaces) on a kit. */
export const sideSchema = z.string().regex(/^(brand|alternative|kit|item-\d+)$/, "side must be brand, alternative, kit or item-<n>");

export const observationSchema = z
  .object({
    /** Slug of the swap or kit. */
    record: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    side: sideSchema,
    price: z.number().positive(),
    currency: z.enum(["USD", "GBP", "CAD", "EUR"]),
    /** The day the price was seen at the store (or published by the source). */
    seen: isoDay,
    /** "month" when only the month is known: `seen` is then the 1st of that month. */
    precision: z.enum(["day", "month"]).default("day"),
    /** Who reported it: a retailer id for hand checks, "open-prices", "awin:<merchant id>", "manual". */
    source: z.string().min(2),
    /** Where to see it: the store page for a hand check, the Open Prices price page, the merchant's product link. */
    url: z.string().url(),
    method: z.enum(METHODS),
    /** The day this line was written, so an audit can tell a backfill from a fresh read. */
    logged: isoDay,
    /** Credit the source asks for (Open Prices is ODbL). */
    attribution: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

export type Observation = z.infer<typeof observationSchema>;
export type ObservationInput = z.input<typeof observationSchema>;

/** Two lines with the same key say the same thing, so the second is not written. */
export function observationKey(o: Pick<Observation, "record" | "side" | "price" | "seen" | "method" | "url">) {
  return [o.record, o.side, o.price.toFixed(2), o.seen, o.method, o.url].join("|");
}

export type LoadResult = { observations: Observation[]; errors: string[] };

/** Reads and validates every line. Bad lines are reported, never dropped silently. */
export function loadObservations(dir = OBSERVATIONS_DIR): LoadResult {
  const observations: Observation[] = [];
  const errors: string[] = [];
  if (!existsSync(dir)) return { observations, errors };
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort()) {
    readFileSync(join(dir, file), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (!line.trim()) return;
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          errors.push(`prices/observations/${file}:${i + 1}: not valid JSON`);
          return;
        }
        const parsed = observationSchema.safeParse(raw);
        if (!parsed.success) {
          errors.push(`prices/observations/${file}:${i + 1}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
          return;
        }
        observations.push(parsed.data);
      });
  }
  return { observations, errors };
}

/**
 * Appends lines to the month's file (by the day they're logged), skipping any already in the log.
 * Returns what was actually written.
 */
export function appendObservations(news: Observation[], existing: Observation[], dir = OBSERVATIONS_DIR, fileName?: string): Observation[] {
  const seen = new Set(existing.map(observationKey));
  const fresh: Observation[] = [];
  for (const o of news) {
    const parsed = observationSchema.parse(o);
    const key = observationKey(parsed);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(parsed);
  }
  if (!fresh.length) return fresh;
  mkdirSync(dir, { recursive: true });
  const byFile = new Map<string, Observation[]>();
  for (const o of fresh) {
    const file = fileName ?? `${o.logged.slice(0, 7)}.jsonl`;
    byFile.set(file, [...(byFile.get(file) ?? []), o]);
  }
  for (const [file, lines] of byFile) {
    const path = join(dir, file);
    // Keep the file ending in a newline so every append starts a fresh line.
    const lead = existsSync(path) && !readFileSync(path, "utf8").endsWith("\n") && readFileSync(path, "utf8").length ? "\n" : "";
    appendFileSync(path, lead + lines.map((o) => JSON.stringify(o)).join("\n") + "\n");
  }
  return fresh;
}

/** Same price to the cent. */
export function samePrice(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100);
}

/** Observations grouped by "record|side", oldest first. */
export function bySide(observations: Observation[]) {
  const map = new Map<string, Observation[]>();
  for (const o of observations) {
    const key = `${o.record}|${o.side}`;
    map.set(key, [...(map.get(key) ?? []), o]);
  }
  for (const list of map.values()) list.sort((a, b) => (a.seen < b.seen ? -1 : a.seen > b.seen ? 1 : a.logged < b.logged ? -1 : a.logged > b.logged ? 1 : 0));
  return map;
}

/** True when this module was run as the script (`npx tsx scripts/prices/x.ts`), not imported by a test. */
export function isMain(metaUrl: string) {
  return Boolean(process.argv[1]) && fileURLToPath(metaUrl) === resolve(process.argv[1]);
}
