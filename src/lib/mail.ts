import { log } from "./log";

/**
 * Outgoing email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Set RESEND_API_KEY and MAIL_FROM ("SameButCheaper <hello@yourdomain>", on a domain verified in Resend).
 * Without them nothing is sent and callers are told so; sign-ups are still stored and can be confirmed later.
 */
export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Extra headers, for example List-Unsubscribe. */
  headers?: Record<string, string>;
  /** Stops the same message going out twice when a request is retried. */
  idempotencyKey?: string;
};

export type MailResult = { ok: true; id: string | null } | { ok: false; reason: "not-configured" | "failed"; detail?: string };

type Env = Record<string, string | undefined>;

export function mailConfig(env: Env = process.env) {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  return key && from ? { key, from, replyTo: env.MAIL_REPLY_TO?.trim() || null, url: env.RESEND_API_URL?.trim() || "https://api.resend.com/emails" } : null;
}

export function mailConfigured(env: Env = process.env) {
  return mailConfig(env) !== null;
}

export async function sendMail(mail: Mail, env: Env = process.env): Promise<MailResult> {
  const cfg = mailConfig(env);
  if (!cfg) return { ok: false, reason: "not-configured" };
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        ...(mail.idempotencyKey ? { "Idempotency-Key": mail.idempotencyKey.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      log.error("mail.send_failed", { status: res.status, detail });
      return { ok: false, reason: "failed", detail: `HTTP ${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id ?? null };
  } catch (err) {
    log.error("mail.send_failed", { err });
    return { ok: false, reason: "failed", detail: err instanceof Error ? err.message : "error" };
  }
}

/** Escapes text for use inside HTML email. */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
