import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { after } from "next/server";
import { z } from "zod";
import { logLookup } from "@/lib/lookup/log";
import { visitorFrom } from "@/lib/visitor";

/**
 * POST /api/identify (multipart form with an "image" field)
 *
 * Reads a product photo with Claude and returns what's printed on it: brand,
 * name, barcode digits, actives with strengths and the ingredient list. The
 * client then runs the normal lookup with those details. Photos are not stored.
 *
 * Needs ANTHROPIC_API_KEY. PHOTO_MODEL overrides the model.
 */

const MODEL = process.env.PHOTO_MODEL || "claude-opus-5-5";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const PhotoSchema = z.object({
  is_product: z.boolean().describe("True if the photo shows a retail product, its packaging or its label."),
  brand: z.string().describe("Brand exactly as printed, or an empty string."),
  product_name: z.string().describe("Product name as printed, without the brand, or an empty string."),
  barcode: z
    .string()
    .describe("Digits printed under a UPC or EAN barcode, only if every digit is clearly readable, else an empty string."),
  kind: z.enum(["medicine", "supplement", "cosmetic", "food", "pet", "household", "tech", "other"]),
  size: z.string().describe("Net quantity as printed, for example '100 tablets' or '200 ml', or an empty string."),
  form: z.string().describe("Dosage form for medicines and supplements, for example 'tablet' or 'softgel', or empty."),
  active_ingredients: z
    .array(z.object({ name: z.string(), amount: z.string() }))
    .describe("Active ingredients with strength exactly as printed in Drug Facts or Supplement Facts. Empty if not visible."),
  other_ingredients: z
    .array(z.string())
    .describe("The full ingredient list (INCI or inactive ingredients) in printed order, if visible. Otherwise empty."),
  purpose: z.string().describe("What the product is for, in one short sentence, based on the packaging."),
  search_query: z.string().describe("A short search phrase for this exact product: brand, product and strength."),
});
export type PhotoResult = z.infer<typeof PhotoSchema>;

const SYSTEM = `You read photos of retail products for a price-comparison site that finds cheaper products with the same ingredients.
Report only what is printed and legible in the photo. Never guess an ingredient, a strength or a barcode digit that you cannot read; leave the field empty instead.
Names and strengths must be copied as printed (for example "Loratadine 10 mg"). If the photo is not a product, set is_product to false and leave the other fields empty.`;

/* Small in-memory rate limit. The site runs as one process on one server. */
const hits = new Map<string, number[]>();
function allowed(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 24 * 3600_000);
  const lastTenMinutes = recent.filter((t) => now - t < 600_000).length;
  if (lastTenMinutes >= 8 || recent.length >= 40) return false;
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Photo recognition isn't switched on yet.");

  const visitor = visitorFrom(request.headers);
  if (!allowed(visitor.ip || visitor.hash)) return fail(429, "That's a lot of photos. Try again in a few minutes.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "Send the photo as a form upload.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return fail(400, "No photo received.");
  if (file.size > MAX_BYTES) return fail(413, "That photo is too large. Try one under 5 MB.");
  const mediaType = TYPES.find((t) => t === file.type);
  if (!mediaType) return fail(415, "Use a JPEG, PNG or WebP photo.");

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic();
  let result: PhotoResult | null = null;
  try {
    const message = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(PhotoSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: "Identify this product and copy its label details." },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") return fail(422, "We couldn't read that photo. Try typing the product name.");
    result = message.parsed_output;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return fail(503, "Photo recognition is busy. Try again in a minute.");
    if (err instanceof Anthropic.BadRequestError) {
      console.error("identify: bad request", err.message);
      return fail(422, "We couldn't read that photo. Try a sharper one, or type the product name.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`identify: API error ${err.status}`, err.message);
      return fail(502, "Photo recognition failed. Try again, or type the product name.");
    }
    console.error("identify: unexpected error", err);
    return fail(502, "Photo recognition failed. Try again, or type the product name.");
  }

  if (!result || !result.is_product) {
    return fail(422, "We couldn't find a product in that photo. Try the front of the pack or the label.");
  }

  const parsed = result;
  after(() =>
    logLookup(
      {
        kind: "photo",
        query: parsed.search_query,
        productName: [parsed.brand, parsed.product_name].filter(Boolean).join(" "),
      },
      request.headers,
      request.headers.get("cookie")?.match(/sbc_country=([A-Z]{2})/)?.[1] ?? null,
    ),
  );
  return Response.json({ ok: true, product: parsed }, { headers: { "Cache-Control": "no-store" } });
}
