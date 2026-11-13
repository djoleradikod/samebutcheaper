import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { log } from "@/lib/log";

/**
 * Reads the product lines off a photo of a receipt, with the same client, model setting and request shape as the
 * label reader (src/app/api/identify/route.ts): ANTHROPIC_API_KEY, PHOTO_MODEL overriding the model, low effort,
 * structured output. Only the product lines come back, as printed: the shopper sees them in the box and can edit
 * them before anything is matched. The photo is not stored.
 */

export const MODEL = process.env.PHOTO_MODEL || "claude-opus-5-5";
export const MAX_BYTES = 5 * 1024 * 1024;
export const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type PhotoType = (typeof TYPES)[number];

/** Most lines we take from one photo. */
export const MAX_PHOTO_LINES = 80;

const ReceiptSchema = z.object({
  is_receipt: z.boolean().describe("True if the photo shows a shop receipt or a written or printed shopping list."),
  lines: z
    .array(z.string())
    .describe(
      "Each product line exactly as printed, one per entry, in order, with its pack size if printed. Leave out prices, totals, tax, payment, loyalty, store and date lines.",
    ),
});

const SYSTEM = `You read photos of shop receipts and shopping lists for a price-comparison site that finds cheaper products with the same ingredients.
Copy only the product lines, as printed and legible, one per entry. Keep brand, product name, strength and pack size as printed, abbreviations included.
Leave out prices, quantities, totals, tax, payment, card, loyalty, store, address, date and time lines. Never guess a word you cannot read; leave that line out instead.
If the photo is not a receipt or a shopping list, set is_receipt to false and return no lines.`;

/** The part of the client this uses, so tests can pass a recorded answer instead of calling the API. */
export type ReceiptClient = {
  beta: {
    messages: {
      parse: (params: never) => Promise<{ stop_reason: string | null; parsed_output: unknown }>;
    };
  };
};

export type PhotoOutcome =
  | { ok: true; lines: string[] }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): PhotoOutcome => ({ ok: false, status, error });

/** The request the label reader sends, with this schema and prompt. Exported for the test that checks they agree. */
export function receiptRequest(data: string, mediaType: PhotoType) {
  return {
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: "Copy the product lines from this receipt or shopping list." },
        ],
      },
    ],
  } as const;
}

export async function readReceiptPhoto(
  data: string,
  mediaType: PhotoType,
  client: ReceiptClient = new Anthropic() as unknown as ReceiptClient,
): Promise<PhotoOutcome> {
  let parsed: z.infer<typeof ReceiptSchema> | null = null;
  try {
    const message = await client.beta.messages.parse(receiptRequest(data, mediaType) as never);
    if (message.stop_reason === "refusal") return fail(422, "We couldn't read that photo. Try typing the list instead.");
    const checked = ReceiptSchema.safeParse(message.parsed_output);
    parsed = checked.success ? checked.data : null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return fail(503, "Photo reading is busy. Try again in a minute.");
    if (err instanceof Anthropic.BadRequestError) {
      log.warn("receipt.photo_bad_request", { err });
      return fail(422, "We couldn't read that photo. Try a sharper one, or type the list.");
    }
    if (err instanceof Anthropic.APIError) {
      log.error("receipt.photo_api_error", { err, status: err.status });
      return fail(502, "Photo reading failed. Try again, or type the list.");
    }
    log.error("receipt.photo_failed", { err });
    return fail(502, "Photo reading failed. Try again, or type the list.");
  }
  if (!parsed || !parsed.is_receipt) return fail(422, "We couldn't find a receipt or a list in that photo. Try a flat, well-lit shot.");
  const lines = parsed.lines
    .map((l) => l.replace(/\s+/g, " ").trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_PHOTO_LINES);
  if (!lines.length) return fail(422, "We couldn't read any products in that photo. Try a sharper one, or type the list.");
  return { ok: true, lines };
}
