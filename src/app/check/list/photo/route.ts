import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { MAX_BYTES, readReceiptPhoto, TYPES } from "@/lib/receipt/photo";
import { visitorFrom } from "@/lib/visitor";

/**
 * POST /check/list/photo (multipart form with an "image" field)
 *
 * Reads the product lines off a receipt photo and returns them for the shopper to check in the box before matching.
 * The same guards as the label reader (src/app/api/identify/route.ts): off without ANTHROPIC_API_KEY, the same
 * per-visitor photo limit (each read costs money), 5 MB at most, and the photo is never stored or logged.
 */
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Photo reading isn't switched on yet.");

  const visitor = visitorFrom(request.headers);
  if (visitor.isBot || !rateLimit("photos", visitor.key, LIMITS.photos).ok) {
    return fail(429, "That's a lot of photos. Try again in a few minutes.");
  }
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 64 * 1024) {
    return fail(413, "That photo is too large. Try one under 5 MB.");
  }

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
  const outcome = await readReceiptPhoto(data, mediaType);
  if (!outcome.ok) return fail(outcome.status, outcome.error);
  log.info("receipt.photo_read", { lines: outcome.lines.length });
  return Response.json({ ok: true, lines: outcome.lines }, { headers: NO_STORE });
}
