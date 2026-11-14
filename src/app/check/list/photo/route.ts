import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { MAX_BYTES, readReceiptPhoto, TYPES } from "@/lib/receipt/photo";
import { visitorFrom } from "@/lib/visitor";
import { getT, isLang } from "@/lib/i18n";

/**
 * POST /check/list/photo (multipart form with an "image" field)
 *
 * Reads the product lines off a receipt photo and returns them for the shopper to check in the box before matching.
 * The same guards as the label reader (src/app/api/identify/route.ts): off without ANTHROPIC_API_KEY, the same
 * per-visitor photo limit (each read costs money), 5 MB at most, and the photo is never stored or logged.
 * ?lang=de answers in German, for /de/check/list.
 */
const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const asked = new URL(request.url).searchParams.get("lang");
  const lang = isLang(asked) ? asked : "en";
  const t = getT(lang);
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, t("listErrors.photoOff"));

  const visitor = visitorFrom(request.headers);
  if (visitor.isBot || !rateLimit("photos", visitor.key, LIMITS.photos).ok) {
    return fail(429, t("listErrors.tooManyPhotos"));
  }
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 64 * 1024) {
    return fail(413, t("listErrors.tooLarge"));
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, t("listErrors.sendForm"));
  }
  const file = form.get("image");
  if (!(file instanceof File)) return fail(400, t("listErrors.noPhoto"));
  if (file.size > MAX_BYTES) return fail(413, t("listErrors.tooLarge"));
  const mediaType = TYPES.find((type) => type === file.type);
  if (!mediaType) return fail(415, t("listErrors.photoType"));

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const outcome = await readReceiptPhoto(data, mediaType);
  // The reader's own messages are English, so a German page gets the general one.
  if (!outcome.ok) return fail(outcome.status, lang === "en" ? outcome.error : t("listErrors.unreadable"));
  log.info("receipt.photo_read", { lines: outcome.lines.length });
  return Response.json({ ok: true, lines: outcome.lines }, { headers: NO_STORE });
}
