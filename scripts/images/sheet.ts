/**
 * Contact sheets for reviewing product photos by eye.
 *
 *   npx tsx scripts/images/sheet.ts <out-dir> [--unreviewed] [--per 24]
 *
 * Writes sheet-00.jpg, sheet-00.json ... Each tile has a number; the JSON maps number to
 * {key, file, matched}. A reviewer reads the sheet next to the JSON and rejects any tile
 * that isn't a clear photo of the named product.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..", "..");
const out = process.argv[2];
const unreviewedOnly = process.argv.includes("--unreviewed");
const perIdx = process.argv.indexOf("--per");
const PER = perIdx > 0 ? Number(process.argv[perIdx + 1]) : 24;
const COLS = 6;
const TILE = 230;
const LABEL = 54;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function label(n: number, key: string) {
  const [brand, product] = key.split("|");
  const line1 = `${n}. ${brand}`.slice(0, 34);
  const line2 = (product ?? "").slice(0, 38);
  const line3 = (product ?? "").slice(38, 76);
  return Buffer.from(
    `<svg width="${TILE}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/>` +
      `<text x="4" y="15" font-family="DejaVu Sans" font-size="12" font-weight="bold" fill="#fff">${esc(line1)}</text>` +
      `<text x="4" y="31" font-family="DejaVu Sans" font-size="10" fill="#ddd">${esc(line2)}</text>` +
      `<text x="4" y="45" font-family="DejaVu Sans" font-size="10" fill="#ddd">${esc(line3)}</text></svg>`,
  );
}

async function main() {
  mkdirSync(out, { recursive: true });
  const records: Record<string, { file: string; matched?: string; reviewed?: string | null }> = JSON.parse(
    readFileSync(join(ROOT, "data", "images.json"), "utf8"),
  );
  const entries = Object.entries(records).filter(
    ([, r]) => (!unreviewedOnly || !r.reviewed) && r.file && existsSync(join(ROOT, "public", "products", `${r.file}-480.webp`)),
  );
  let sheetNo = 0;
  for (let i = 0; i < entries.length; i += PER) {
    const page = entries.slice(i, i + PER);
    const rows = Math.ceil(page.length / COLS);
    const width = COLS * TILE;
    const height = rows * (TILE + LABEL);
    const composites = [];
    const map: Record<string, { key: string; file: string; matched?: string }> = {};
    for (let j = 0; j < page.length; j++) {
      const [key, rec] = page[j];
      const n = i + j + 1;
      map[String(n)] = { key, file: rec.file, matched: rec.matched };
      const x = (j % COLS) * TILE;
      const y = Math.floor(j / COLS) * (TILE + LABEL);
      const img = await sharp(join(ROOT, "public", "products", `${rec.file}-480.webp`)).resize(TILE, TILE).toBuffer();
      composites.push({ input: img, left: x, top: y });
      composites.push({ input: label(n, key), left: x, top: y + TILE });
    }
    const name = `sheet-${String(sheetNo).padStart(2, "0")}`;
    await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .composite(composites)
      .jpeg({ quality: 78 })
      .toFile(join(out, `${name}.jpg`));
    writeFileSync(join(out, `${name}.json`), JSON.stringify(map, null, 0));
    sheetNo++;
  }
  console.log(`${entries.length} photos on ${sheetNo} sheets in ${out}`);
}

main();
