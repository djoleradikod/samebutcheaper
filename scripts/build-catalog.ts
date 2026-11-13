/**
 * Validates every record in data/ and writes the derived catalog to
 * src/generated/catalog.json. Run automatically before `dev` and `build`.
 *
 *   npm run catalog          # build, fail on any invalid record
 *   npm run catalog -- --lenient   # skip invalid records with a warning
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  bundleSchema,
  claimSchema,
  imageRecordSchema,
  migrateLegacyPrices,
  normalizeUnit,
  nutritionFileSchema,
  pairSchema,
  presetSchema,
  ratingSchema,
  shelfLifeSchema,
  type BundleInput,
  type ImageRecord,
  type MatchType,
  type NutritionRecord,
  type NutritionSource,
  type PairInput,
  type PresetInput,
} from "../src/lib/schema";
import { APPROX_USD, MARKETS, type LookFor } from "../src/lib/markets";
import { comparison, hasProof } from "../src/lib/compare";
import { dupeSlugFor } from "../src/lib/dupes";
import { CATEGORIES } from "../src/lib/categories";
import { INGREDIENT_MATCHES, ingredientPageKey, slugify } from "../src/lib/ingredient-key";
import { sellerOf } from "../src/lib/sellers";
import { basketCheckout, checkout, tillLine, type TillLine } from "../src/lib/delivery";
import { isPerAmountRecord } from "../src/lib/unit-format";
import { RATING_FLOOR, ratingCounts, ratingLabel, ratingShare } from "../src/lib/rating";
import type { Bundle, BulkView, Catalog, Claim, Pair, Photo, Preset, PresetLine, Rating, ShelfLife } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const DATA_DIR = join(ROOT, "data", "pairs");
const BUNDLE_DIR = join(ROOT, "data", "bundles");
const PRESET_DIR = join(ROOT, "data", "presets");
const EVIDENCE_DIR = join(ROOT, "data", "evidence");
const IMAGE_DIR = join(ROOT, "public", "products");
const OUT_DIR = join(ROOT, "src", "generated");
const lenient = process.argv.includes("--lenient");

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
/** Staples and sheets cost a fraction of a cent each, so a unit price keeps six decimals. Money totals come from price and size, never from this. */
const roundPpu = (n: number) => round(n, 6);
const errors: string[] = [];
/** Worth a look, but not wrong: printed, never fatal. */
const warnings: string[] = [];

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

/* ---------------------------------------------------------------- evidence */

function readArray(dir: string, file: string): unknown[] {
  const path = join(dir, file);
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    errors.push(`${file}: expected a JSON array`);
    return [];
  }
  return raw;
}

function loadRecords<T>(dir: string, name: string, schema: { safeParse: (x: unknown) => { success: boolean; data?: T; error?: { issues: { path: PropertyKey[]; message: string }[] } } }): T[] {
  const out: T[] = [];
  readArray(dir, name).forEach((item, i) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      errors.push(`${name}[${i}]: ${parsed.error!.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`);
      return;
    }
    out.push(parsed.data as T);
  });
  return out;
}

const claims: Claim[] = loadRecords(EVIDENCE_DIR, "claims.json", claimSchema);
const shelfLives: ShelfLife[] = loadRecords(EVIDENCE_DIR, "shelf-life.json", shelfLifeSchema);
const claimById = new Map(claims.map((c) => [c.id, c]));
const shelfById = new Map(shelfLives.map((s) => [s.id, s]));
const lower = (s: string) => s.toLowerCase().trim();

/**
 * Findings for a swap: named ones first, then ones listing this subcategory, then ones for the whole
 * category. A finding that lists subcategories is about those and no others, and "general" on its own
 * doesn't put a finding on a swap page: a soup page must not show a claim about batteries. A swap that
 * should show one anyway names it in `claims`. Every finding still appears on /why.
 */
function claimsFor(p: PairInput): Claim[] {
  const picked: Claim[] = [];
  const add = (c: Claim) => {
    if (!picked.includes(c)) picked.push(c);
  };
  for (const id of p.claims) {
    const c = claimById.get(id);
    if (c) add(c);
    else errors.push(`${p.slug}: unknown claim id ${id}`);
  }
  const inMarket = (c: Claim) => !c.markets.length || c.markets.includes(p.market);
  const sub = lower(p.subcategory);
  for (const c of claims)
    if (inMarket(c) && c.categories.includes(p.category) && c.subcategories.some((s) => lower(s) === sub)) add(c);
  for (const c of claims) if (inMarket(c) && c.categories.includes(p.category) && !c.subcategories.length) add(c);
  return picked.slice(0, 4);
}

/* --------------------------------------------------------------- nutrition */

/** Aisles where a nutrition table means something. Medicine and supplements never get one. */
const NUTRITION_CATEGORIES: ReadonlySet<string> = new Set(["food-pantry"]);

const nutritionItems: Record<string, NutritionRecord> = {};
let nutritionSource: NutritionSource | null = null;
{
  const path = join(EVIDENCE_DIR, "nutrition.json");
  if (existsSync(path)) {
    const parsed = nutritionFileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
    if (parsed.success) {
      const { items, ...source } = parsed.data;
      Object.assign(nutritionItems, items);
      nutritionSource = source;
    } else {
      errors.push(`nutrition.json: ${parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`);
    }
  }
}

function nutritionFor(category: string, side: { brand: string; product: string }): NutritionRecord | null {
  if (!NUTRITION_CATEGORIES.has(category)) return null;
  return nutritionItems[`${side.brand}|${side.product}`] ?? null;
}

function shelfFor(p: PairInput): ShelfLife | null {
  if (p.shelf_life) {
    const s = shelfById.get(p.shelf_life);
    if (!s) errors.push(`${p.slug}: unknown shelf_life id ${p.shelf_life}`);
    return s ?? null;
  }
  const sub = lower(p.subcategory);
  return (
    shelfLives.find((s) => s.subcategories.some((x) => lower(x) === sub)) ??
    shelfLives.find((s) => !s.subcategories.length && s.categories.includes(p.category)) ??
    null
  );
}

/* ------------------------------------------------------------------ photos */

const imageRecords: Record<string, ImageRecord> = {};
{
  const path = join(ROOT, "data", "images.json");
  if (existsSync(path)) {
    for (const [key, value] of Object.entries(JSON.parse(readFileSync(path, "utf8")))) {
      const parsed = imageRecordSchema.safeParse(value);
      if (!parsed.success) continue; // not ingested yet: the page draws a tile
      const hasFiles =
        existsSync(join(IMAGE_DIR, `${parsed.data.file}-160.webp`)) && existsSync(join(IMAGE_DIR, `${parsed.data.file}-480.webp`));
      if (hasFiles) imageRecords[key] = parsed.data;
    }
  }
}

const credits: Catalog["credits"] = [];
const creditSeen = new Set<string>();

/** A photo shows only once someone has looked at it. DailyMed label art stays off until a legal read (R2). */
function photoFor(brand: string, productName: string): Photo | null {
  const rec = imageRecords[`${brand}|${productName}`];
  if (!rec || !rec.reviewed || rec.source === "dailymed") return null;
  const photo: Photo = {
    src: `/products/${rec.file}`,
    credit: rec.credit,
    license: rec.license,
    page: rec.page,
    source: rec.source,
    ...(rec.weak ? { weak: true } : {}),
  };
  const key = `${brand}|${productName}`;
  if (!creditSeen.has(key)) {
    creditSeen.add(key);
    credits.push({ ...photo, brand, product: productName });
  }
  return photo;
}

/* ------------------------------------------------------------------- pairs */

/** A price older than this is shown as old and stays off the home page. */
const OLD_PRICE_MONTHS = 12;

function monthsSince(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const now = new Date();
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - (m || 1));
}

function bulkViewFor(p: PairInput, brandPpu: number, altPpu: number): BulkView {
  const view: BulkView = { breakEvenUnits: round(p.alternative.price / brandPpu, 1) };
  if (p.bulk) {
    const ppu = p.bulk.price / p.bulk.size;
    view.bigger = {
      product: p.bulk.product,
      size: p.bulk.size,
      price: p.bulk.price,
      ppu: roundPpu(ppu),
      retailer: p.bulk.retailer,
      url: p.bulk.url,
      extraSavingPct: round(Math.max(0, (1 - ppu / altPpu) * 100), 1),
    };
  }
  return view;
}

/** Scores the catalogue already quotes in its text, kept apart from the pair files. See scripts/qa/mine_ratings.py. */
const quotedRatings: Record<string, unknown> = existsSync(join(EVIDENCE_DIR, "ratings.json")) ? JSON.parse(readFileSync(join(EVIDENCE_DIR, "ratings.json"), "utf8")) : {};

function toRating(raw: PairInput["brand"]["rating"], fallbackDate: string): Rating | null {
  if (!raw || !ratingCounts(raw)) return null;
  const score = raw.score ?? raw.stars ?? 0;
  const base = { score, scale: raw.scale, count: raw.count, publisher: raw.publisher, wording: raw.wording };
  return { ...base, source: raw.source, date: raw.date ?? fallbackDate, share: round(ratingShare(score, raw.scale), 3), label: ratingLabel(base) };
}

/** The floor applies to the product we tell people to buy. New markets and aisles ship with a rating. */
function altRatingFor(p: PairInput): Rating | null {
  const quoted = quotedRatings[p.slug];
  const parsed = quoted ? ratingSchema.safeParse(quoted) : null;
  if (parsed && !parsed.success) errors.push(`${p.slug}: ratings.json: ${parsed.error.issues[0].message}`);
  const rating = toRating(p.alternative.rating ?? (parsed?.success ? parsed.data : null), p.price_checked);
  if (rating && rating.share < RATING_FLOOR) errors.push(`${p.slug}: the cheaper product rates ${rating.label}, under the floor of ${RATING_FLOOR}`);
  return rating;
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
  const brandNutrition = nutritionFor(p.category, p.brand);
  const altNutrition = nutritionFor(p.category, p.alternative);
  return {
    ...p,
    brand: { ...p.brand, rating: toRating(p.brand.rating, p.price_checked), unit, ppu: roundPpu(brandPpu), photo: photoFor(p.brand.brand, p.brand.product), nutrition: brandNutrition },
    alternative: {
      ...p.alternative,
      rating: altRatingFor(p),
      unit,
      ppu: roundPpu(altPpu),
      photo: photoFor(p.alternative.brand, p.alternative.product),
      nutrition: altNutrition,
    },
    nutritionSource: brandNutrition || altNutrition ? nutritionSource : null,
    savingsPct: round(savingsPct, 1),
    savingsPerPack: round(savingsPerPack, 2),
    score: round(score, 2),
    currency,
    sellers: [sellerOf(p.alternative)],
    twin: null,
    lookFor: lookFor(p.match_type, p.alternative, p.look_for),
    evidence_claims: claimsFor(p),
    shelfLife: shelfFor(p),
    bulkView: bulkViewFor(p, brandPpu, altPpu),
    priceOld: monthsSince(p.price_checked) > OLD_PRICE_MONTHS,
  };
}

function deriveBundle(b: BundleInput): Bundle {
  const components = b.components.map((c) => {
    const ppu = c.price / c.size;
    const item = b.bundle.items[c.replaces];
    return {
      ...c,
      seller: sellerOf(c),
      unit: normalizeUnit(c.unit),
      ppu: roundPpu(ppu),
      photo: photoFor(c.brand, c.product),
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
  // A kit is one checkout; the rebuild is one per store. Count the extra delivery against the saving.
  const kitSeller = sellerOf({ brand: b.bundle.brand, product: b.bundle.name, retailer: b.bundle.retailer, url: b.bundle.url });
  const rebuild = checkout(components.map((c) => ({ seller: c.seller, price: c.price })), b.market);
  const kitCheckout = checkout([{ seller: kitSeller, price: b.bundle.price }], b.market);
  const extraDelivery =
    rebuild.delivery === null
      ? null
      : round(Math.max(0, rebuild.delivery + rebuild.surcharge - (kitCheckout.delivery ?? 0) - kitCheckout.surcharge), 2);
  const netSavings = round(Math.max(0, savings - (extraDelivery ?? 0)), 2);
  // Each extra store is another basket to fill and another chance to give up, so it ranks a little lower.
  const storePenalty = 1 / (1 + 0.1 * (rebuild.stores.length - 1));
  const netPct = (netSavings / b.bundle.price) * 100;
  // A rebuild that costs more at the till than the kit (bigger packs, a delivery fee) is a harder sell, however good per use.
  const kitToday = b.bundle.price + (kitCheckout.delivery ?? 0) + kitCheckout.surcharge;
  const cashPenalty = rebuild.payToday > kitToday ? 0.75 : 1;
  return {
    ...b,
    currency,
    photo: photoFor(b.bundle.brand, b.bundle.name),
    bundle: { ...b.bundle, items: b.bundle.items.map((i) => ({ ...i, unit: normalizeUnit(i.unit) })) },
    components: [...components].sort((x, y) => x.replaces - y.replaces),
    sellers: [...new Set(components.map(sellerOf))],
    equivalentTotal: round(equivalentTotal, 2),
    upfrontTotal: round(upfrontTotal, 2),
    savings: round(savings, 2),
    savingsPct: round(savingsPct, 1),
    score: round(netPct * (1 + Math.log10(1 + netSavings * APPROX_USD[currency])) * confidence * storePenalty * cashPenalty, 2),
    kitSeller,
    checkout: rebuild,
    kitCheckout,
    extraDelivery,
    netSavings,
    netSavingsPct: round(netPct, 1),
  };
}

const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
const pairs: Pair[] = [];
const seen = new Set<string>();
const sameSwaps: [string, string][] = [];

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
    if (parsed.data.same_swap) sameSwaps.push([pair.slug, parsed.data.same_swap]);
    // A swap with nothing compared on both sides can't claim to do the same job, whatever its record says.
    if (pair.match_type === "equivalent_spec" && !hasProof(comparison(pair))) pair.match_type = "same_kind";
    if (pair.match_type === "identical_active") {
      // "Same active" says same strength too, so every row has to show it.
      const rows = comparison(pair).ingredients;
      const open = rows.filter((r) => r.verdict !== "same").map((r) => r.aspect);
      if (!rows.length) errors.push(`${label}: identical_active with no active ingredient rows`);
      if (open.length) errors.push(`${label}: identical_active needs every row "same", and these aren't: ${open.join(", ")}`);
    }
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
    if (bundle.netSavings / bundle.bundle.price < 0.05)
      warnings.push(`${label}: after delivery from ${bundle.checkout.stores.length} stores the rebuild saves only ${bundle.netSavings} ${bundle.currency}`);
    seen.add(bundle.slug);
    bundles.push(bundle);
  });
}

/* ----------------------------------------------------------------- presets */

const pairBySlug = new Map(pairs.map((p) => [p.slug, p]));

/** A basket line's store and real pack, so its checkout counts whole packs at the till. A price per 100 ml has no pack to count. */
function presetTill(p: Pair, qty: number, altCost: number): Pick<PresetLine, "seller" | "pack" | "packs" | "tillCost"> {
  const perAmount = isPerAmountRecord(p.alternative.size, p.alternative.unit);
  const line: TillLine = { seller: p.sellers[0], altCost, qty, pack: perAmount ? null : { price: p.alternative.price, per: p.brand.size / p.alternative.size } };
  const till = tillLine(line, qty);
  return { seller: line.seller, pack: line.pack, packs: till.packs, tillCost: till.cost };
}

function derivePreset(input: PresetInput): Preset | null {
  const lines: PresetLine[] = [];
  const sellers = new Set<string>();
  for (const item of input.items) {
    const p = pairBySlug.get(item.pair);
    if (!p) {
      errors.push(`preset ${input.slug}: unknown swap ${item.pair}`);
      return null;
    }
    if (p.market !== input.market) {
      errors.push(`preset ${input.slug}: ${item.pair} is priced in ${p.market}, not ${input.market}`);
      return null;
    }
    p.sellers.forEach((s) => sellers.add(s));
    // From price and size, so a line adds up to the figures on its swap page.
    const brandCost = p.brand.price * item.qty;
    const altCost = (p.alternative.price / p.alternative.size) * p.brand.size * item.qty;
    lines.push({
      pair: p.slug,
      qty: item.qty,
      note: item.note,
      title: p.title,
      subcategory: p.subcategory,
      brandName: p.brand.brand,
      altName: p.alternative.brand,
      brandPhoto: p.brand.photo?.src ?? null,
      altPhoto: p.alternative.photo?.src ?? null,
      brandCost: round(brandCost, 2),
      altCost: round(altCost, 2),
      saved: round(brandCost - altCost, 2),
      savingsPct: p.savingsPct,
      unit: p.brand.unit,
      brandPpu: p.brand.ppu,
      altPpu: p.alternative.ppu,
      ...presetTill(p, item.qty, altCost),
    });
  }
  const brandTotal = lines.reduce((s, l) => s + l.brandCost, 0);
  const altTotal = lines.reduce((s, l) => s + l.altCost, 0);
  const savings = brandTotal - altTotal;
  const photos = lines.map((l) => l.altPhoto).filter((x): x is string => !!x);
  const currency = MARKETS[input.market].currency;
  const { items: _items, ...rest } = input;
  void _items;
  return {
    ...rest,
    lines,
    sellers: [...sellers],
    brandTotal: round(brandTotal, 2),
    altTotal: round(altTotal, 2),
    savings: round(savings, 2),
    savingsPct: round((savings / brandTotal) * 100, 1),
    currency,
    photos: photos.slice(0, 4),
    photoShare: round(lines.filter((l) => l.altPhoto || l.brandPhoto).length / lines.length, 2),
    score: round(savings * APPROX_USD[currency], 2),
    checkout: basketCheckout(lines, lines.map((l) => l.qty), input.market),
  };
}

const presets: Preset[] = [];
let presetFiles: string[] = [];
try {
  presetFiles = readdirSync(PRESET_DIR).filter((f) => f.endsWith(".json")).sort();
} catch {
  /* no presets yet */
}
for (const file of presetFiles) {
  const raw = JSON.parse(readFileSync(join(PRESET_DIR, file), "utf8"));
  if (!Array.isArray(raw)) {
    errors.push(`presets/${file}: expected a JSON array`);
    continue;
  }
  raw.forEach((item, i) => {
    const label = `presets/${file}[${i}] ${item?.slug ?? "(no slug)"}`;
    const parsed = presetSchema.safeParse(item);
    if (!parsed.success) {
      errors.push(`${label}: ${parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`).join("; ")}`);
      return;
    }
    if (seen.has(parsed.data.slug)) {
      errors.push(`${label}: duplicate slug`);
      return;
    }
    const preset = derivePreset(parsed.data);
    if (preset) {
      seen.add(preset.slug);
      presets.push(preset);
    }
  });
}

// One swap priced in two markets. The seller has to match too, or a shopper could lose the record they can buy to one they can't.
for (const [slug, other] of sameSwaps) {
  const a = pairs.find((p) => p.slug === slug)!;
  const b = pairs.find((p) => p.slug === other);
  if (!b) errors.push(`${slug}: same_swap ${other} doesn't exist`);
  else if (a.market === b.market) errors.push(`${slug}: same_swap ${other} is in the same market`);
  else if (a.sellers.join() !== b.sellers.join()) errors.push(`${slug}: same_swap ${other} has another seller, ${a.sellers} against ${b.sellers}`);
  else if (a.twin || b.twin) errors.push(`${slug}: a swap can have one twin, and ${a.twin ? slug : other} already does`);
  else {
    a.twin = { slug: b.slug, market: b.market };
    b.twin = { slug: a.slug, market: a.market };
  }
}

if (warnings.length) console.warn(`\n${warnings.length} warning(s):\n  - ${warnings.join("\n  - ")}\n`);
if (errors.length) {
  const log = lenient ? console.warn : console.error;
  log(`\n${errors.length} item(s) rejected:\n  - ${errors.join("\n  - ")}\n`);
  if (!lenient) process.exit(1);
}

pairs.sort((a, b) => b.score - a.score);
bundles.sort((a, b) => b.score - a.score);
presets.sort((a, b) => b.score - a.score);

const anySideReal = pairs.filter((p) => p.brand.photo || p.alternative.photo).length;
const dailymedKey = (s: { brand: string; product: string }) => imageRecords[`${s.brand}|${s.product}`]?.source === "dailymed";
const withDailymed = pairs.filter((p) => p.brand.photo || p.alternative.photo || dailymedKey(p.brand) || dailymedKey(p.alternative)).length;
const bothSidesReal = pairs.filter((p) => p.brand.photo && p.alternative.photo).length;
const medicine = pairs.filter((p) => p.category === "otc-medicine").length;
const markets: Record<string, number> = {};
for (const p of pairs) markets[p.market] = (markets[p.market] ?? 0) + 1;

const catalog: Catalog = {
  generatedAt: new Date().toISOString(),
  pairs,
  bundles,
  presets,
  claims,
  shelfLife: shelfLives,
  credits,
  coverage: {
    pairs: pairs.length,
    bothSidesReal,
    anySideReal,
    medicine,
    categories: new Set(pairs.map((p) => p.category)).size,
    markets,
  },
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "catalog.json"), JSON.stringify(catalog));
// Small list for the proxy, so a page that doesn't exist answers with a real 404.
writeFileSync(
  join(OUT_DIR, "known-slugs.json"),
  JSON.stringify({
    compare: catalog.pairs.map((p) => p.slug),
    bundle: catalog.bundles.map((b) => b.slug),
    basket: catalog.presets.map((p) => p.slug),
    dupe: [...new Set(catalog.pairs.map(dupeSlugFor))],
    brand: [...new Set([...catalog.pairs.map((p) => slugify(p.brand.brand)), ...catalog.bundles.map((b) => slugify(b.bundle.brand))])],
    ingredient: [
      ...new Set(
        catalog.pairs
          .filter((p) => INGREDIENT_MATCHES.has(p.match_type))
          .flatMap((p) => p.alternative.key_ingredients.map((i) => ingredientPageKey(i.name)))
          .filter((slug) => slug !== null),
      ),
    ],
    category: CATEGORIES.map((c) => c.slug),
  }),
);
const pct = (n: number) => (pairs.length ? Math.round((n / pairs.length) * 100) : 0);
console.log(
  `Catalog built: ${pairs.length} pairs from ${files.length} file(s), ${bundles.length} bundles, ${presets.length} presets, ` +
    `${claims.length} claims, ${shelfLives.length} shelf-life records. Real image: any ${anySideReal} (${pct(anySideReal)}%), both ${bothSidesReal} (${pct(bothSidesReal)}%), any counting DailyMed ${withDailymed} (${pct(withDailymed)}%). ` +
    `Medicine ${medicine} (${pct(medicine)}%).`,
);
