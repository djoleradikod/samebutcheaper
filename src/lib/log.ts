/**
 * One JSON object per line on stdout/stderr, so `docker compose logs web` can be filtered with jq or shipped as is:
 *   {"t":"2026-11-10T12:00:00.000Z","level":"error","event":"click.log_failed","error":"..."}
 * Never pass secrets, email addresses or IP addresses as fields.
 */
type Fields = Record<string, unknown>;

function errorFields(err: unknown): Fields {
  if (err instanceof Error) {
    const digest = "digest" in err && typeof err.digest === "string" ? { digest: err.digest } : {};
    return { error: err.message, errorName: err.name, ...digest, stack: err.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return { error: String(err) };
}

function write(level: "info" | "warn" | "error", event: string, fields: Fields = {}) {
  const { err, ...rest } = fields;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...rest, ...(err === undefined ? {} : errorFields(err)) });
  if (level === "info") console.log(line);
  else if (level === "warn") console.warn(line);
  else console.error(line);
}

export const log = {
  info: (event: string, fields?: Fields) => write("info", event, fields),
  warn: (event: string, fields?: Fields) => write("warn", event, fields),
  /** Pass the caught value as `err`; its message, name and the top of its stack are logged. */
  error: (event: string, fields?: Fields) => write("error", event, fields),
};
