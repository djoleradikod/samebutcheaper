/**
 * Set up a blind pair for a gauntlet critic.
 *
 *   npx tsx scripts/qa/blind.ts make <round-dir> <key-file> <pair-id> <ours-prefix> <bar-prefix>
 *   npx tsx scripts/qa/blind.ts reveal <key-file> <pair-id> <A|B>
 *
 * Prefixes are capture.py names without extension, e.g. .../ours-home-desktop and .../bar/geizhals-home-desktop.
 * The pair folder gets A.jpg, A-1.jpg, A-2.jpg ... and the same for B: the first screen, then the page cut into viewport-sized
 * parts so a critic reads it at full size. The side is random. The key lives outside the round folder, and critics are only
 * ever told the pair folder. Nothing in the folder says which side is which.
 */
import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MAX_PARTS = 4;

async function cut(prefix: string, out: string, letter: string) {
  const width = prefix.endsWith("phone") ? 780 : 1440;
  const first = await sharp(`${prefix}.jpg`).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  fs.writeFileSync(path.join(out, `${letter}.jpg`), first);
  const step = (await sharp(first).metadata()).height ?? 900;
  const fullPath = `${prefix}-full.jpg`;
  if (!fs.existsSync(fullPath)) return;
  const full = await sharp(fullPath).resize({ width, withoutEnlargement: true }).toBuffer();
  const meta = await sharp(full).metadata();
  const fullHeight = meta.height ?? 0;
  const fullWidth = meta.width ?? width;
  for (let i = 0; i < MAX_PARTS; i++) {
    const top = i * step;
    if (top >= fullHeight) break;
    const height = Math.min(step, fullHeight - top);
    await sharp(full)
      .extract({ left: 0, top, width: fullWidth, height })
      .jpeg({ quality: 78 })
      .toFile(path.join(out, `${letter}-${i + 1}.jpg`));
  }
}

async function make(roundDir: string, keyFile: string, pairId: string, ours: string, bar: string) {
  const out = path.join(roundDir, pairId);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const oursIs = randomInt(2) === 0 ? "A" : "B";
  await cut(ours, out, oursIs);
  await cut(bar, out, oursIs === "A" ? "B" : "A");
  const key = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, "utf8")) : {};
  key[pairId] = { ours: oursIs, bar: path.basename(bar) };
  fs.mkdirSync(path.dirname(keyFile), { recursive: true });
  fs.writeFileSync(keyFile, JSON.stringify(key, null, 1));
  console.log(pairId, "ready");
}

function reveal(keyFile: string, pairId: string, pick: string) {
  const entry = JSON.parse(fs.readFileSync(keyFile, "utf8"))[pairId];
  console.log(pairId, "picked", pick, "ours is", entry.ours, "=>", pick === entry.ours ? "OURS WINS" : "BAR WINS", "against", entry.bar);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "make") void make(args[0], args[1], args[2], args[3], args[4]);
else reveal(args[0], args[1], args[2]);
