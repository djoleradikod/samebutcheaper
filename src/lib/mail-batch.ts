import { log } from "./log";
import { mailConfig, type Mail } from "./mail";

type Env = Record<string, string | undefined>;

/** Resend takes at most this many emails in one batch request. */
export const BATCH_MAX = 100;

export type BatchResult =
  | { ok: true; ids: (string | null)[] }
  /**
   * "invalid": Resend refused the request as a whole (a 4xx such as a malformed address). Nothing in it was sent, so
   * each email can safely be tried on its own. "failed": a server error, a timeout or no answer, where we can't be
   * sure what happened; the caller releases its claims and the next run tries again under the same batch key.
   */
  | { ok: false; reason: "not-configured" | "invalid" | "failed"; detail?: string };

/**
 * Sends up to BATCH_MAX emails in one request to Resend's batch endpoint (POST /emails/batch). The batch is all or
 * nothing: Resend validates every email before sending any. `idempotencyKey` covers the whole request, so a retry
 * of the same batch within Resend's 24 hours is not sent twice.
 */
export async function sendBatch(mails: Omit<Mail, "idempotencyKey">[], idempotencyKey: string, env: Env = process.env): Promise<BatchResult> {
  const cfg = mailConfig(env);
  if (!cfg) return { ok: false, reason: "not-configured" };
  if (!mails.length) return { ok: true, ids: [] };
  if (mails.length > BATCH_MAX) throw new Error(`sendBatch takes at most ${BATCH_MAX} emails`);
  try {
    const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/batch`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
      body: JSON.stringify(
        mails.map((m) => ({
          from: cfg.from,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          html: m.html,
          ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
          ...(m.headers ? { headers: m.headers } : {}),
        })),
      ),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      log.error("mail.batch_failed", { status: res.status, detail, size: mails.length });
      // 409 is Resend saying this key was used with a different body: treat as unsure, never as "not sent".
      const invalid = res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429;
      return { ok: false, reason: invalid ? "invalid" : "failed", detail: `HTTP ${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] };
    return { ok: true, ids: mails.map((_, i) => json.data?.[i]?.id ?? null) };
  } catch (err) {
    log.error("mail.batch_failed", { err, size: mails.length });
    return { ok: false, reason: "failed", detail: err instanceof Error ? err.message : "error" };
  }
}
