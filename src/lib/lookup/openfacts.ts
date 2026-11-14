import "server-only";
import { cacheLife } from "next/cache";
import { z } from "zod";
import { COUNTRIES } from "@/lib/markets";
import { SITE } from "@/lib/site";
import type { Candidate, LookupProduct, LookupSource } from "./types";
import { sentenceCase } from "./text";
import { proxiedImage } from "@/lib/product-image";

/**
 * Open Beauty Facts, Open Food Facts and Open Pet Food Facts: open,
 * crowd-sourced product databases keyed by barcode (ODbL licence).
 * They ask for a descriptive User-Agent and modest request rates.
 */
type Db = "obf" | "off" | "opff";
const HOST: Record<Db, string> = {
  obf: "https://world.openbeautyfacts.org",
  off: "https://world.openfoodfacts.org",
  opff: "https://world.openpetfoodfacts.org",
};
const FIELDS =
  "code,product_name,product_name_en,generic_name,generic_name_en,brands,quantity,ingredients_text,ingredients_text_en,categories_tags,countries_tags,image_front_small_url";

const s = z.string().optional().catch(undefined);
const productSchema = z.object({
  code: z.union([z.string(), z.number()]).transform(String),
  product_name: s,
  product_name_en: s,
  generic_name: s,
  generic_name_en: s,
  brands: s,
  quantity: s,
  ingredients_text: s,
  ingredients_text_en: s,
  categories_tags: z.array(z.string()).optional().catch(undefined),
  countries_tags: z.array(z.string()).optional().catch(undefined),
  image_front_small_url: s,
});
type OffProduct = z.infer<typeof productSchema>;

const UA = `SameButCheaper/0.2 (${SITE.contactEmail})`;

async function offGet(url: string): Promise<unknown> {
  "use cache";
  cacheLife("days");
  const res = await fetch(url, { signal: AbortSignal.timeout(7000), headers: { "user-agent": UA, accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Facts ${res.status}`);
  return res.json();
}

const COUNTRY_BY_TAG: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRIES).map(([code, c]) => [c.name.toLowerCase().replace(/[^a-z]+/g, "-"), code]),
);
COUNTRY_BY_TAG["united-states-of-america"] = "US";
COUNTRY_BY_TAG["czech-republic"] = "CZ";
COUNTRY_BY_TAG["turkey"] = "TR";

/** "en:face-creams" -> "Face creams" */
function tagLabel(tag: string) {
  const t = tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Splits an ingredient list on top-level commas (keeps "(…)" groups together). */
function splitIngredients(text: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";") && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim().replace(/\.$/, ""));
  return out.map((x) => x.replace(/_/g, "")).filter((x) => x.length > 1).slice(0, 80);
}

const KIND: Record<Db, LookupProduct["kind"]> = { obf: "cosmetic", off: "food", opff: "pet" };
const CATEGORY: Record<Db, LookupProduct["category"]> = { obf: "skincare-personal-care", off: "food-pantry", opff: "pet" };

function toProduct(db: Db, p: OffProduct): LookupProduct {
  const name = p.product_name_en || p.product_name || "";
  const brand = (p.brands ?? "").split(",")[0]?.trim() ?? "";
  const cats = (p.categories_tags ?? []).filter((t) => t.startsWith("en:"));
  const ingredients = p.ingredients_text_en || p.ingredients_text || "";
  const generic = p.generic_name_en || p.generic_name;
  return {
    source: db,
    id: p.code,
    url: `${HOST[db]}/product/${p.code}`,
    brand: sentenceCase(brand),
    name: sentenceCase(name) || "Unnamed product",
    kind: KIND[db],
    category: CATEGORY[db],
    size: p.quantity ?? "",
    form: "",
    upc: p.code,
    actives: [],
    ingredients: ingredients ? splitIngredients(ingredients) : [],
    uses: [generic, ...cats.slice(-2).reverse().map(tagLabel)].filter((x): x is string => !!x),
    directions: null,
    warnings: [],
    countries: (p.countries_tags ?? [])
      .map((t) => COUNTRY_BY_TAG[t.replace(/^en:/, "")])
      .filter((c): c is string => !!c),
    manufacturer: null,
    // Through our own server, so the visitor's browser never contacts the image host (src/lib/product-image.ts).
    image: proxiedImage(p.image_front_small_url),
  };
}

export async function openFactsByBarcode(variants: string[]): Promise<LookupProduct | null> {
  for (const db of ["obf", "off", "opff"] as const) {
    for (const code of variants) {
      const json = (await offGet(`${HOST[db]}/api/v2/product/${code}.json?fields=${FIELDS}`)) as {
        status?: number;
        product?: unknown;
      } | null;
      if (json?.status === 1 && json.product) {
        const parsed = productSchema.safeParse({ code, ...(json.product as object) });
        if (parsed.success && (parsed.data.product_name || parsed.data.product_name_en)) return toProduct(db, parsed.data);
      }
    }
  }
  return null;
}

export async function openFactsProduct(db: LookupSource, code: string): Promise<LookupProduct | null> {
  if (db !== "obf" && db !== "off" && db !== "opff") return null;
  if (!/^\d{6,14}$/.test(code)) return null;
  const json = (await offGet(`${HOST[db]}/api/v2/product/${code}.json?fields=${FIELDS}`)) as {
    status?: number;
    product?: unknown;
  } | null;
  if (json?.status !== 1 || !json.product) return null;
  const parsed = productSchema.safeParse({ code, ...(json.product as object) });
  return parsed.success ? toProduct(db, parsed.data) : null;
}

export async function searchOpenFacts(db: Db, q: string): Promise<Candidate[]> {
  const clean = q.trim().slice(0, 80);
  if (clean.length < 3) return [];
  const url = `${HOST[db]}/cgi/search.pl?search_terms=${encodeURIComponent(clean)}&search_simple=1&action=process&json=1&page_size=10&fields=${FIELDS}`;
  const json = (await offGet(url)) as { products?: unknown[] } | null;
  return (json?.products ?? [])
    .flatMap((raw) => {
      const p = productSchema.safeParse(raw);
      return p.success && (p.data.product_name || p.data.product_name_en) ? [toProduct(db, p.data)] : [];
    })
    .slice(0, 6)
    .map((p) => ({
      source: db,
      id: p.id,
      brand: p.brand,
      name: p.name,
      detail: [p.size, p.uses[0]].filter(Boolean).join(" · "),
      kind: p.kind,
      image: p.image,
    }));
}
