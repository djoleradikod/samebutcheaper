/**
 * The build's affiliate settings, as next.config.ts reads them: the environment, plus a dotenv-style file when one is
 * mounted (the Docker build gets the AFFILIATE_ENV secret as /run/secrets/affiliate, and never as environment
 * variables). The environment wins.
 *
 * The catalogue build needs the same view: a programme's terms switch on when the build is a member of it
 * (src/lib/programme-terms.ts `joined`), and in the Docker image the AFF_* settings that say so exist only in this
 * file. Build scripts only: it reads the disk.
 */
import { existsSync, readFileSync } from "node:fs";

type Env = Record<string, string | undefined>;

/** The KEY=value lines of a dotenv-style file; quotes around a value are dropped. */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

/** The environment with the mounted affiliate file's settings under it. */
export function buildEnv(env: Env = process.env): Env {
  const file = env.AFFILIATE_ENV_FILE ?? "/run/secrets/affiliate";
  const fromFile = existsSync(file) ? parseEnvFile(readFileSync(file, "utf8")) : {};
  return { ...fromFile, ...env };
}
