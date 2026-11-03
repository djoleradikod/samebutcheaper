/**
 * Adds openly licensed product photos (Open Food / Beauty / Pet Food / Products
 * Facts, CC BY-SA) to the catalog data. It never uses brand or retailer photos.
 *
 *   npx tsx scripts/fetch-images.ts            # products with a gtin: look the barcode up
 *   npx tsx scripts/fetch-images.ts --search   # also search by brand + name, strict matches only
 *   npx tsx scripts/fetch-images.ts --dry-run  # print what would change, write nothing
 *
 * It needs internet access to the Open Facts APIs, so run it on a machine that
 * has it (kucni), then check the report, run `npm run catalog`, and commit.
 * Open Facts limits searches to about 10 a minute, so --search is slow on purpose.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IMAGE_HOSTS } from "../src/lib/schema";

const ROOT = join(import.meta.dirname, "..");
const DIRS = [join(ROOT, "data", "pairs"), join(ROOT, "data", "bundles")];
const search = process.argv.includes("--search");
const dryRun = process.argv.includes("--dry-run");
const UA = "SameButCheaper/0.1 (catalog photo fetch; +https://github.com/djoleradikod/samebutcheaper)";

type Db = "food" | "beauty" | "petfood" | "products";
const HOST: Record<Db, string> = {
  food: "https://world.openfoodfacts.org",
  beauty: "https://world.openbeautyfacts.org",
  petfood: "https://world.openpetfoodfacts.org",
  products: "https://world.openproductsfacts.org",
};
/** Which databases are worth asking for each category, best first. */
const DBS: Record<string, Db[]> = {
  "food-pantry": ["food"],
  supplements: ["food", "products"],
  "skincare-personal-care": ["beauty", "products"],
  "beauty-hair": ["beauty", "products"],
  baby: ["food", "beauty", "products"],
  pet: ["petfood", "products"],
  household: ["products", "beauty"],
  "otc-medicine": ["products"],
};

type Side = {
  brand: string;
  product: string;
  size?: number;
  gtin?: string | null;
  image?: string | null;
};
type OffProduct = { code?: string; product_name?: string; brands?: string; quantity?: string; image_front_url?: string; image_url?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastSearch = 0;

async function getJson(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        await sleep(30000);
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

function allowedImage(p: OffProduct) {
  const u = p.image_front_url || p.image_url;
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (IMAGE_HOSTS as readonly string[]).includes(url.hostname) ? u : null;
  } catch {
    return null;
  }
}

async function byBarcode(gtin: string, dbs: Db[]) {
  for (const db of dbs) {
    const j = await getJson(`${HOST[db]}/api/v2/product/${gtin}.json?fields=code,product_name,brands,image_front_url,image_url`);
    const p = j && j.status === 1 ? (j.product as OffProduct) : null;
    const img = p && allowedImage(p);
    if (img) return { image: img, gtin, db, name: p?.product_name ?? "" };
  }
  return null;
}

const STOP = new Set(["the", "and", "for", "with", "of", "a", "an", "oz", "fl", "ml", "g", "kg", "lb", "count", "ct", "pack", "x"]);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t));
const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Strict: the brand must match one of the result's brands, and most of the
 * result's name words must appear in our product name. A wrong photo is worse
 * than no photo.
 */
function strictMatch(side: Side, p: OffProduct) {
  const brands = (p.brands ?? "").split(",").map(squash).filter(Boolean);
  const ours = squash(side.brand);
  if (!brands.some((b) => b === ours || (b.length > 4 && (b.startsWith(ours) || ours.startsWith(b))))) return 0;
  const want = new Set(tokens(`${side.brand} ${side.product}`));
  const got = tokens(p.product_name ?? "");
  if (got.length < 2) return 0;
  const hit = got.filter((t) => want.has(t)).length;
  return hit / got.length;
}

async function bySearch(side: Side, dbs: Db[]) {
  const terms = `${side.brand} ${side.product}`.replace(/\s+/g, " ").slice(0, 120);
  let best: { score: number; p: OffProduct; db: Db } | null = null;
  for (const db of dbs) {
    const wait = 6500 - (Date.now() - lastSearch);
    if (wait > 0) await sleep(wait);
    lastSearch = Date.now();
    const url = `${HOST[db]}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,quantity,image_front_url,image_url`;
    const j = await getJson(url);
    for (const p of ((j?.products as OffProduct[]) ?? [])) {
      if (!allowedImage(p)) continue;
      const score = strictMatch(side, p);
      if (score >= 0.75 && (!best || score > best.score)) best = { score, p, db };
    }
    if (best && best.score === 1) break;
  }
  if (!best) return null;
  const code = best.p.code && /^\d{8,14}$/.test(best.p.code) ? best.p.code : null;
  return { image: allowedImage(best.p)!, gtin: code, db: best.db, name: best.p.product_name ?? "", score: best.score };
}

type Report = { file: string; slug: string; side: string; how: string; name: string; image: string };
const report: Report[] = [];

async function fill(side: Side, category: string, file: string, slug: string, label: string) {
  if (side.image) return false;
  const dbs = DBS[category];
  if (!dbs) return false;
  let found: { image: string; gtin: string | null; db: Db; name: string } | null = null;
  let how = "";
  if (side.gtin) {
    found = await byBarcode(side.gtin, dbs);
    how = "barcode";
  }
  if (!found && search) {
    found = await bySearch(side, dbs);
    how = "search";
  }
  if (!found) return false;
  side.image = found.image;
  if (!side.gtin && found.gtin) side.gtin = found.gtin;
  report.push({ file, slug, side: label, how: `${how} (${found.db})`, name: found.name, image: found.image });
  console.log(`  + ${slug} [${label}] via ${how}: ${found.name}`);
  return true;
}

async function main() {
  for (const dir of DIRS) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      const path = join(dir, f);
      const raw = readFileSync(path, "utf8");
      const indent = raw.match(/^\[\n(\s+)/)?.[1] ?? "  ";
      const items = JSON.parse(raw) as Array<Record<string, unknown>>;
      let changed = false;
      console.log(f);
      for (const it of items) {
        const slug = String(it.slug);
        const category = String(it.category);
        if (it.brand && it.alternative) {
          changed = (await fill(it.brand as Side, category, f, slug, "brand")) || changed;
          changed = (await fill(it.alternative as Side, category, f, slug, "alternative")) || changed;
        }
        if (it.bundle && Array.isArray(it.components)) {
          for (const [i, c] of (it.components as Side[]).entries()) {
            changed = (await fill(c, category, f, slug, `component ${i + 1}`)) || changed;
          }
        }
      }
      if (changed && !dryRun) writeFileSync(path, JSON.stringify(items, null, indent) + "\n");
    }
  }
  const out = join(ROOT, "data", "image-report.json");
  if (!dryRun) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(`\n${report.length} photos ${dryRun ? "found (dry run)" : "added"}. Review them in data/image-report.json.`);
}

main();
