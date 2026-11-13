type Env = Record<string, string | undefined>;

/**
 * The legal notice (Impressum) German law requires of a site that addresses German readers (§5 DDG, and §18 MStV
 * for the person responsible for content). Every detail comes from the environment; nothing is filled in for the
 * owner. Name, postal address and email are required; phone, VAT number and the person responsible are shown only
 * when set. Without the required three the notice counts as not published: /impressum says so and is noindex,
 * readiness flags it before any email goes out, and the weekly letter is held back for readers in DE and AT.
 */
export type LegalNotice = {
  name: string;
  /** Postal address, lines split on new lines or " | ". */
  address: string[];
  email: string;
  phone: string | null;
  vatId: string | null;
  responsible: string | null;
};

export const LEGAL_REQUIRED = ["LEGAL_NAME", "LEGAL_ADDRESS", "LEGAL_EMAIL"] as const;

const clean = (v: string | undefined) => v?.trim() || null;

/** The notice, or null while any required part is missing. */
export function legalNotice(env: Env = process.env): LegalNotice | null {
  const name = clean(env.LEGAL_NAME);
  const address = clean(env.LEGAL_ADDRESS);
  const email = clean(env.LEGAL_EMAIL);
  if (!name || !address || !email) return null;
  return {
    name,
    address: address
      .split(/\\n|\n|\s+\|\s+/)
      .map((l) => l.trim())
      .filter(Boolean),
    email,
    phone: clean(env.LEGAL_PHONE),
    vatId: clean(env.LEGAL_VAT_ID),
    responsible: clean(env.LEGAL_RESPONSIBLE),
  };
}

/** Which of the required settings are missing. */
export function legalMissing(env: Env = process.env) {
  return LEGAL_REQUIRED.filter((k) => !clean(env[k]));
}

/** Countries whose readers are owed the notice before we send them marketing email. */
export const NEEDS_LEGAL_NOTICE = ["DE", "AT"] as const;

export const impressumUrl = (siteUrl: string) => `${siteUrl}/impressum`;
