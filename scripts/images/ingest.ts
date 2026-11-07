/**
 * Downloads openly licensed product photos, normalises them and stores them in
 * public/products with a licence record in data/images.json. Nothing is hotlinked.
 *
 *   npx tsx scripts/images/ingest.ts --from-pairs            # the `image` URLs already in data/pairs and data/bundles
 *   npx tsx scripts/images/ingest.ts --candidates file.json  # [{key, url, source, credit, license, page, matched}]
 *
 * Downloads are untrusted: each goes in its own folder under $SBC_DOWNLOADS (default
 * /mnt/fast-storage/samebutcheaper-qa/downloads) and only sharp reads them. It decodes
 * and re-encodes each picture, which drops metadata and anything hidden in the file.
 * Records start with reviewed: null. A reviewer sets the date after looking at the picture.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..", "..");
const OUT = join(ROOT, "public", "products");
const DOWNLOADS = process.env.SBC_DOWNLOADS ?? "/mnt/fast-storage/samebutcheaper-qa/downloads";
const RECORDS = join(ROOT, "data", "images.json");
const UA = "SameButCheaper/0.2 (photo ingest; +https://github.com/djoleradikod/samebutcheaper)";
const MIN_SIDE = 220;

export type Candidate = {
  key: string;
  url: string;
  source: string;
  credit: string;
  license: string;
  page: string;
  matched?: string;
};

const SOURCE_BY_HOST: Record<string, { source: string; credit: string; license: string }> = {
  "images.openfoodfacts.org": { source: "openfoodfacts", credit: "Open Food Facts contributors", license: "CC BY-SA 3.0" },
  "static.openfoodfacts.org": { source: "openfoodfacts", credit: "Open Food Facts contributors", license: "CC BY-SA 3.0" },
  "images.openbeautyfacts.org": { source: "openbeautyfacts", credit: "Open Beauty Facts contributors", license: "CC BY-SA 3.0" },
  "images.openpetfoodfacts.org": { source: "openpetfoodfacts", credit: "Open Pet Food Facts contributors", license: "CC BY-SA 3.0" },
  "images.openproductsfacts.org": { source: "openproductsfacts", credit: "Open Products Facts contributors", license: "CC BY-SA 3.0" },
  // The maker submits these label images to DailyMed. NLM doesn't guarantee their copyright status, so they
  // don't count as covered until a legal read (see docs/research/R2-reuse.md).
  "dailymed.nlm.nih.gov": { source: "dailymed", credit: "Label image via DailyMed (U.S. National Library of Medicine)", license: "Rights not confirmed" },
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

function candidatesFromPairs(): Candidate[] {
  const out: Candidate[] = [];
  const previous: Record<string, { page?: string; matched?: string }> = existsSync(RECORDS) ? JSON.parse(readFileSync(RECORDS, "utf8")) : {};
  const PAGE_HOST: Record<string, string> = {
    openfoodfacts: "https://world.openfoodfacts.org",
    openbeautyfacts: "https://world.openbeautyfacts.org",
    openpetfoodfacts: "https://world.openpetfoodfacts.org",
    openproductsfacts: "https://world.openproductsfacts.org",
  };
  const add = (side: { brand?: string; product?: string; name?: string; image?: string | null; gtin?: string | null }, brand?: string) => {
    if (!side.image) return;
    const name = side.product ?? side.name ?? "";
    const key = `${side.brand ?? brand}|${name}`;
    const host = new URL(side.image).hostname;
    const meta = SOURCE_BY_HOST[host];
    if (!meta) return;
    const prior = previous[key];
    const fromBarcode = side.gtin && PAGE_HOST[meta.source] ? `${PAGE_HOST[meta.source]}/product/${side.gtin}` : null;
    out.push({ key, url: side.image, ...meta, page: prior?.page ?? fromBarcode ?? side.image, matched: prior?.matched ?? "" });
  };
  for (const dir of ["pairs", "bundles"]) {
    for (const f of readdirSync(join(ROOT, "data", dir))) {
      if (!f.endsWith(".json")) continue;
      for (const item of JSON.parse(readFileSync(join(ROOT, "data", dir, f), "utf8"))) {
        if (item.brand) add(item.brand);
        if (item.alternative) add(item.alternative);
        if (item.bundle) add(item.bundle);
        for (const c of item.components ?? []) add(c);
      }
    }
  }
  return out;
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return Buffer.from(await r.arrayBuffer());
    } catch {
      await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
    }
  }
  return null;
}

/** Trim the background, then fit on a white square. */
async function normalise(input: Buffer, size: number) {
  const base = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate().flatten({ background: "#ffffff" });
  const trimmed = await base.trim({ threshold: 14 }).toBuffer().catch(() => null);
  return sharp(trimmed ?? input)
    .flatten({ background: "#ffffff" })
    .resize(Math.round(size * 0.92), Math.round(size * 0.92), { fit: "inside", withoutEnlargement: false })
    .extend({ top: 0, bottom: 0, left: 0, right: 0, background: "#ffffff" })
    .toBuffer()
    .then(async (fit) => {
      const m = await sharp(fit).metadata();
      const w = m.width ?? size;
      const h = m.height ?? size;
      return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } })
        .composite([{ input: fit, left: Math.floor((size - w) / 2), top: Math.floor((size - h) / 2) }])
        .webp({ quality: size > 200 ? 76 : 70, effort: 5 })
        .toBuffer();
    });
}

async function main() {
  const idx = process.argv.indexOf("--candidates");
  const rejectedPath = join(ROOT, "data", "images-rejected.json");
  const rejected: Record<string, string[]> = existsSync(rejectedPath) ? JSON.parse(readFileSync(rejectedPath, "utf8")) : {};
  const fileName = (c: Candidate) => `${slug(c.key.replace("|", " "))}-${createHash("sha1").update(c.url).digest("hex").slice(0, 10)}`;
  const candidates: Candidate[] = (idx > 0 ? (JSON.parse(readFileSync(process.argv[idx + 1], "utf8")) as Candidate[]) : candidatesFromPairs()).filter(
    (c) => !rejected[c.key]?.includes(fileName(c)),
  );
  mkdirSync(OUT, { recursive: true });
  const records: Record<string, unknown> = existsSync(RECORDS) ? JSON.parse(readFileSync(RECORDS, "utf8")) : {};
  let ok = 0;
  const failed: string[] = [];
  for (const c of candidates) {
    const hash = createHash("sha1").update(c.url).digest("hex").slice(0, 10);
    const name = `${slug(c.key.replace("|", " "))}-${hash}`;
    const done = existsSync(join(OUT, `${name}-160.webp`)) && existsSync(join(OUT, `${name}-480.webp`));
    if (!done) {
      const dir = join(DOWNLOADS, hash);
      mkdirSync(dir, { recursive: true });
      const orig = join(dir, "orig");
      // Open Facts serves the original at .full.jpg; the dump lists the 400 px copy.
      const fullUrl = c.url.replace(/\.(\d+)\.400\.jpg$/, ".$1.full.jpg");
      let bytes: Buffer | null = existsSync(orig)
        ? readFileSync(orig)
        : ((fullUrl !== c.url ? await fetchBytes(fullUrl) : null) ?? (await fetchBytes(c.url)));
      if (!bytes) {
        failed.push(`${c.key}: download failed ${c.url}`);
        continue;
      }
      // Open Facts asks for images to be fetched one at a time.
      await new Promise((res) => setTimeout(res, 250));
      writeFileSync(orig, bytes);
      try {
        const meta = await sharp(bytes).metadata();
        if (Math.min(meta.width ?? 0, meta.height ?? 0) < MIN_SIDE) {
          failed.push(`${c.key}: too small (${meta.width}x${meta.height})`);
          continue;
        }
        writeFileSync(join(OUT, `${name}-480.webp`), await normalise(bytes, 480));
        writeFileSync(join(OUT, `${name}-160.webp`), await normalise(bytes, 160));
      } catch (e) {
        failed.push(`${c.key}: not a usable picture (${String(e).slice(0, 80)})`);
        continue;
      } finally {
        bytes = null;
      }
    }
    const prior = records[c.key] as { file?: string; credit?: string; reviewed?: string | null } | undefined;
    const samePicture = prior?.file === name;
    records[c.key] = {
      file: name,
      source: c.source,
      // A cutout notes the change in its credit, as CC BY-SA asks, so ingesting the same picture again keeps that credit.
      credit: samePicture && prior?.credit ? prior.credit : c.credit,
      license: c.license,
      page: c.page,
      matched: c.matched ?? "",
      reviewed: samePicture ? (prior?.reviewed ?? null) : null,
    };
    ok++;
  }
  writeFileSync(RECORDS, JSON.stringify(records, null, 1) + "\n");
  console.log(`ingested ${ok} of ${candidates.length}; failed ${failed.length}`);
  for (const f of failed) console.log(`  ${f}`);
}

main();
