/**
 * Review and apply background-removed photos made by scripts/images/cutout.py.
 *
 *   npx tsx scripts/images/apply-cutouts.ts sheet <cutouts-dir> <sheets-dir>
 *   npx tsx scripts/images/apply-cutouts.ts apply <cutouts-dir> <sheets-dir> "<rejected tile numbers>"
 *
 * `sheet` pairs each cutout with the photo on the site, so a reviewer can see what the cut lost. A cut that kept almost nothing
 * or almost everything is left out, and the photo stays as it is. `apply` writes the accepted cutouts over the site's photos
 * and notes the change in the credit, as CC BY-SA asks. Tiles not on a sheet, and rejected ones, are left alone.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..", "..");
const RECORDS = join(ROOT, "data", "images.json");
const PRODUCTS = join(ROOT, "public", "products");
const NOTE = "background removed";
const PER = 30;
const COLS = 6;
const TILE = 230;
const LABEL = 24;

type ImageRecord = { file: string; credit: string; reviewed?: string | null; source?: string };

/** A pack stood on a shared baseline with a soft pool of shadow, so a pair of snapshots reads as two products on one shelf. */
async function onWhite(png: string, size: number) {
  const trimmed = await sharp(png).trim({ threshold: 10 }).png().toBuffer();
  const margin = Math.round(size * 0.07);
  const inner = size - margin * 2;
  const resized = await sharp(trimmed).resize(inner, inner, { fit: "inside" }).png().toBuffer();
  const m = await sharp(resized).metadata();
  const w = m.width ?? inner;
  const h = m.height ?? inner;
  // Feather the edge a touch, so a cut reads as a photo and not as scissors.
  const alpha = await sharp(resized).ensureAlpha().extractChannel(3).blur(size > 200 ? 0.9 : 0.5).toBuffer();
  // Snapshots run dim and soft: stretch the levels a little and sharpen after the resize, so packs read at card size.
  const rgb = await sharp(resized)
    .removeAlpha()
    .normalise({ lower: 1, upper: 99 })
    .modulate({ saturation: 1.06 })
    .sharpen({ sigma: size > 200 ? 0.8 : 0.5 })
    .toBuffer();
  const body = await sharp(rgb).joinChannel(alpha).png().toBuffer();
  const pool = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${size / 2}" cy="${size - margin}" rx="${(w * 0.92) / 2}" ry="${Math.max(4, Math.round(size * 0.035))}" fill="#000" fill-opacity="0.28"/></svg>`,
  );
  const shadow = await sharp(pool).blur(Math.max(1, size * 0.018)).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } }).composite([
    { input: shadow, left: 0, top: 0 },
    { input: body, left: Math.floor((size - w) / 2), top: size - margin - h },
  ]);
}

/** The share of the picture the cut kept. */
async function keptShare(png: string) {
  const { data, info } = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let kept = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > 128) kept++;
  return kept / (info.width * info.height);
}

async function makeSheets(cutouts: string, sheets: string) {
  mkdirSync(sheets, { recursive: true });
  const records: Record<string, ImageRecord> = JSON.parse(readFileSync(RECORDS, "utf8"));
  const tiles: { key: string; file: string }[] = [];
  let skipped = 0;
  for (const [key, rec] of Object.entries(records)) {
    if (!rec.reviewed || rec.credit.includes(NOTE)) continue;
    const png = join(cutouts, `${rec.file}.png`);
    if (!existsSync(png)) continue;
    const share = await keptShare(png);
    if (share < 0.06 || share > 0.96) {
      skipped++;
      continue;
    }
    tiles.push({ key, file: rec.file });
  }
  const map: Record<string, { key: string; file: string }> = {};
  let sheetNo = 0;
  for (let i = 0; i < tiles.length; i += PER) {
    const page = tiles.slice(i, i + PER);
    const rows = Math.ceil(page.length / COLS);
    const composites = [];
    for (let j = 0; j < page.length; j++) {
      const n = i + j + 1;
      map[String(n)] = page[j];
      const x = (j % COLS) * TILE;
      const y = Math.floor(j / COLS) * (TILE + LABEL);
      const img = await (await onWhite(join(cutouts, `${page[j].file}.png`), TILE - 4)).png().toBuffer();
      const before = await sharp(join(PRODUCTS, `${page[j].file}-160.webp`)).resize(64, 64).png().toBuffer();
      const label = Buffer.from(
        `<svg width="${TILE}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>` +
          `<text x="5" y="17" font-family="DejaVu Sans" font-size="14" font-weight="bold" fill="#fff">${n}</text></svg>`,
      );
      composites.push({ input: img, left: x + 2, top: y + 2 }, { input: before, left: x + TILE - 66, top: y + 2 }, { input: label, left: x, top: y + TILE });
    }
    await sharp({ create: { width: COLS * TILE, height: rows * (TILE + LABEL), channels: 3, background: "#ffffff" } })
      .composite(composites)
      .jpeg({ quality: 80 })
      .toFile(join(sheets, `cut-${String(sheetNo).padStart(2, "0")}.jpg`));
    sheetNo++;
  }
  writeFileSync(join(sheets, "cut-map.json"), JSON.stringify(map, null, 0));
  console.log(`${tiles.length} cutouts on ${sheetNo} sheets; ${skipped} left out for keeping too little or too much`);
}

async function apply(cutouts: string, sheets: string, rejectedList: string) {
  const rejected = new Set(rejectedList.split(/[\s,]+/).filter(Boolean));
  const map: Record<string, { key: string; file: string }> = JSON.parse(readFileSync(join(sheets, "cut-map.json"), "utf8"));
  const records: Record<string, ImageRecord> = JSON.parse(readFileSync(RECORDS, "utf8"));
  let applied = 0;
  for (const [n, tile] of Object.entries(map)) {
    if (rejected.has(n)) continue;
    const png = join(cutouts, `${tile.file}.png`);
    for (const size of [480, 160]) {
      const out = await (await onWhite(png, size)).webp({ quality: size > 200 ? 78 : 72, effort: 5 }).toBuffer();
      writeFileSync(join(PRODUCTS, `${tile.file}-${size}.webp`), out);
    }
    const rec = records[tile.key];
    if (!rec.credit.includes(NOTE)) rec.credit = `${rec.credit}, ${NOTE}`;
    applied++;
  }
  writeFileSync(RECORDS, JSON.stringify(records, null, 1) + "\n");
  console.log(`applied ${applied}, kept ${rejected.size} as they were`);
}

const [cmd, cutouts, sheets, rejected] = process.argv.slice(2);
void (cmd === "sheet" ? makeSheets(cutouts, sheets) : apply(cutouts, sheets, rejected ?? ""));
