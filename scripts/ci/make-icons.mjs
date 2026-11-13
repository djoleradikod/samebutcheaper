/**
 * Makes the web app icons in public/icons from the site's own logo (src/app/icon.svg): no new artwork.
 *   node scripts/ci/make-icons.mjs
 * - icon-192.png, icon-512.png: the favicon as it is (rounded yellow tile, ticket mark), purpose "any";
 * - maskable-192.png, maskable-512.png: the same mark on a full-bleed yellow square, scaled so the mark fits the
 *   centre circle (80% of the width) that every launcher mask keeps, purpose "maskable".
 * The output is committed; run this again only when the logo changes. Uses sharp, which comes with Next.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = join(import.meta.dirname, "..", "..");
const svg = readFileSync(join(root, "src", "app", "icon.svg"), "utf8");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });

const fill = /<rect[^>]*fill="(#[0-9a-f]{6})"/i.exec(svg)?.[1];
const mark = /<path[^>]*\bd="([^"]+)"[^>]*\/>/.exec(svg);
const markFill = /<path[^>]*fill="(#[0-9a-f]{6})"/i.exec(svg)?.[1];
if (!fill || !mark || !markFill) throw new Error("src/app/icon.svg no longer has the expected tile and mark");

// The mark's own box is 32 x 24 (see its path). At scale 0.6 its corners sit 12 units from the centre, inside the
// 12.8-unit safe circle of a 32-unit icon.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${fill}"/><path transform="translate(16 16) scale(0.6) translate(-16 -12)" fill="${markFill}" fill-rule="evenodd" d="${mark[1]}"/></svg>`;

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg), { density: (72 * size) / 32 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, `icon-${size}.png`));
  await sharp(Buffer.from(maskable), { density: (72 * size) / 32 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(out, `maskable-${size}.png`));
}
console.log("Wrote public/icons/icon-{192,512}.png and maskable-{192,512}.png");
