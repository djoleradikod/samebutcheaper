import { createHash, timingSafeEqual } from "node:crypto";

/** Compares two secrets without leaking, through timing, how much of one matched. */
export function sameSecret(a: string, b: string) {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

/**
 * True when an Authorization header carries HTTP Basic credentials for user "admin" with the given password.
 * The password may contain colons: only the first one separates it from the user name.
 */
export function isAdminAuthorized(authorization: string | null | undefined, password: string | undefined): boolean {
  if (!password) return false;
  const [scheme, encoded] = (authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  const at = decoded.indexOf(":");
  if (at < 0) return false;
  // Both halves are always compared, so a wrong user name costs the same time as a wrong password.
  const user = sameSecret(decoded.slice(0, at), "admin");
  const pass = sameSecret(decoded.slice(at + 1), password);
  return user && pass;
}
