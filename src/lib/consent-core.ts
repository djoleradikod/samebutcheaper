/**
 * The consent cookie and the region where consent applies, without the programme registry, so the choice in the
 * browser (src/components/ConsentChoice.tsx) stays small. The rules are explained in ./consent.ts. Pure.
 */
export const CONSENT_COOKIE = "sbc_consent";
/** How long a choice is remembered, then asked again: about six months. */
export const CONSENT_DAYS = 182;
export type ConsentChoice = "yes" | "no";

/** EU member states, the rest of the EEA, the UK and Switzerland. */
export const CONSENT_REGION: ReadonlySet<string> = new Set([
  ...["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
  ...["IS", "LI", "NO"],
  "GB",
  "CH",
]);

/** Whether a visitor in this country is asked. A country we don't know counts as one that asks. */
export function consentApplies(country: string | null | undefined): boolean {
  if (!country || !/^[A-Z]{2}$/.test(country)) return true;
  return CONSENT_REGION.has(country);
}

/** The visitor's choice from a Cookie header or document.cookie, or null when they haven't made one. */
export function readConsent(cookie: string | null | undefined): ConsentChoice | null {
  const v = new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=(yes|no)(?:;|$)`).exec(cookie ?? "")?.[1];
  return v === "yes" || v === "no" ? v : null;
}

/** The Set-Cookie value (or document.cookie assignment) that remembers a choice. `secure` on a page served over https. */
export function consentCookie(choice: ConsentChoice, secure = false): string {
  return `${CONSENT_COOKIE}=${choice}; Path=/; Max-Age=${CONSENT_DAYS * 86400}; SameSite=Lax${secure ? "; Secure" : ""}`;
}
