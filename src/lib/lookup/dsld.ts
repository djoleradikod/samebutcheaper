import "server-only";
import { cacheLife } from "next/cache";
import { z } from "zod";
import type { Active, Candidate, LookupProduct } from "./types";
import { clip, overlap } from "./text";

/**
 * NIH Office of Dietary Supplements, Dietary Supplement Label Database.
 * Free and keyless: https://dsld.od.nih.gov/api-guide
 */
const BASE = "https://api.ods.od.nih.gov/dsld/v9";

const described = z
  .object({ langualCodeDescription: z.string().optional().catch(undefined) })
  .partial()
  .optional()
  .catch(undefined);

const hitSchema = z.object({
  _id: z.union([z.string(), z.number()]).transform(String),
  _source: z
    .object({
      fullName: z.string().optional().catch(undefined),
      brandName: z.string().optional().catch(undefined),
      upcSku: z.string().optional().catch(undefined),
      offMarket: z.union([z.number(), z.boolean()]).optional().catch(undefined),
      physicalState: described,
      productType: described,
    })
    .catch({}),
});

const quantity = z.object({
  quantity: z.union([z.number(), z.string()]).optional().catch(undefined),
  unit: z.string().optional().catch(undefined),
  servingSizeOrder: z.number().optional().catch(undefined),
});

const labelSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  fullName: z.string().optional().catch(undefined),
  brandName: z.string().optional().catch(undefined),
  upcSku: z.string().optional().catch(undefined),
  physicalState: described,
  productType: described,
  netContents: z.array(z.object({ display: z.string().optional().catch(undefined) })).optional().catch(undefined),
  servingSizes: z
    .array(
      z.object({
        minQuantity: z.number().optional().catch(undefined),
        unit: z.string().optional().catch(undefined),
      }),
    )
    .optional()
    .catch(undefined),
  ingredientRows: z
    .array(
      z.object({
        name: z.string().optional().catch(undefined),
        quantity: z.array(quantity).optional().catch(undefined),
      }),
    )
    .optional()
    .catch(undefined),
  otheringredients: z
    .object({
      text: z.string().optional().catch(undefined),
      ingredients: z.array(z.object({ name: z.string().optional().catch(undefined) })).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  statements: z
    .array(z.object({ type: z.string().optional().catch(undefined), notes: z.string().optional().catch(undefined) }))
    .optional()
    .catch(undefined),
  contacts: z
    .array(
      z.object({
        contactDetails: z.object({ name: z.string().optional().catch(undefined) }).optional().catch(undefined),
      }),
    )
    .optional()
    .catch(undefined),
});

async function dsldGet(path: string): Promise<unknown> {
  "use cache";
  cacheLife("days");
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(7000),
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`DSLD ${res.status}`);
  return res.json();
}

export async function searchDsld(q: string): Promise<Candidate[]> {
  const clean = q.trim().slice(0, 80);
  if (clean.length < 3) return [];
  const json = (await dsldGet(`/search-filter?q=${encodeURIComponent(clean)}&size=20`)) as { hits?: unknown[] } | null;
  const hits = (json?.hits ?? []).flatMap((h) => {
    const p = hitSchema.safeParse(h);
    return p.success ? [p.data] : [];
  });
  return hits
    .filter((h) => !h._source.offMarket)
    .map((h) => ({
      h,
      score: overlap(q, `${h._source.brandName ?? ""} ${h._source.fullName ?? ""}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ h }) => ({
      source: "dsld" as const,
      id: h._id,
      brand: h._source.brandName ?? "",
      name: h._source.fullName ?? "",
      detail: [h._source.productType?.langualCodeDescription, h._source.physicalState?.langualCodeDescription]
        .filter(Boolean)
        .join(" · "),
      kind: "supplement" as const,
      image: null,
    }));
}

export async function dsldLabel(id: string): Promise<LookupProduct | null> {
  if (!/^\d{1,9}$/.test(id)) return null;
  const parsed = labelSchema.safeParse(await dsldGet(`/label/${id}`));
  if (!parsed.success) return null;
  const l = parsed.data;
  const actives: Active[] = (l.ingredientRows ?? [])
    .filter((r) => r.name)
    .map((r) => {
      const q = r.quantity?.find((x) => (x.servingSizeOrder ?? 1) === 1) ?? r.quantity?.[0];
      const amount = q?.quantity !== undefined && q.quantity !== 0 && q.unit ? `${q.quantity} ${q.unit}` : "";
      return { name: r.name!, amount };
    });
  const serving = l.servingSizes?.[0];
  const statements = l.statements ?? [];
  const pick = (re: RegExp) => statements.filter((s) => s.type && re.test(s.type) && s.notes).map((s) => s.notes!);
  const other = l.otheringredients?.ingredients?.map((i) => i.name).filter((n): n is string => !!n);
  return {
    source: "dsld",
    id: l.id,
    url: `https://dsld.od.nih.gov/label/${l.id}`,
    brand: l.brandName ?? "",
    name: l.fullName ?? "",
    kind: "supplement",
    category: "supplements",
    size: l.netContents?.map((n) => n.display).filter(Boolean).join(", ") ?? "",
    form: (l.physicalState?.langualCodeDescription ?? "").toLowerCase(),
    upc: l.upcSku?.replace(/\D/g, "") || null,
    actives,
    ingredients: other?.length ? other : l.otheringredients?.text ? [l.otheringredients.text] : [],
    uses: [
      l.productType?.langualCodeDescription ? `${l.productType.langualCodeDescription} supplement` : "",
      ...pick(/claim|structure|function/i).map((s) => clip(s, 300)),
    ].filter(Boolean),
    directions: [
      serving?.minQuantity ? `Serving size: ${serving.minQuantity} ${serving.unit ?? ""}`.trim() : "",
      ...pick(/suggested|recommended|directions|usage/i),
    ]
      .filter(Boolean)
      .map((s) => clip(s, 300))
      .join(". ") || null,
    warnings: pick(/warning|precaution|caution/i).map((s) => clip(s, 220)).slice(0, 4),
    countries: ["US"],
    manufacturer: l.contacts?.[0]?.contactDetails?.name ?? null,
    image: null,
  };
}
