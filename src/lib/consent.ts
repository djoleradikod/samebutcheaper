/**
 * Consent for what is not strictly necessary (§ 25 TDDDG, Art. 5(3) ePrivacy Directive, PECR reg. 6).
 *
 * Today nothing on the site needs it: the country cookies serve a choice the visitor makes or a page they asked for,
 * and the first-touch source no longer lives in a cookie (src/lib/traffic-source.ts). What can need it is a store's
 * affiliate tracking, when a programme's own terms say its tracking may only run after the visitor agreed. Such a
 * programme carries `terms.consentBeforeTracking: true` in data/sellers/programmes.json, with the clause quoted. Then:
 *  - /go and /out tag a link to that programme only for a visitor who said yes, or who is outside the region where
 *    consent applies (see consentApplies); anyone else gets the store's plain link, so nothing of theirs is tracked;
 *  - the site shows a small choice (ConsentChoice.tsx) to visitors in that region, with "Allow" and "Don't allow"
 *    side by side and the same weight, and a footer button to change it. Nothing is set before the choice; the choice
 *    itself is remembered in `sbc_consent`.
 * With no programme flagged, the choice never shows and every link is tagged as before.
 *
 * Pure. Reads the registry, so client code imports ./consent-core instead.
 */
import { PROGRAMME_REGISTRY, type ProgrammeEntry } from "./programmes";

export { CONSENT_COOKIE, CONSENT_DAYS, CONSENT_REGION, consentApplies, consentCookie, readConsent, type ConsentChoice } from "./consent-core";
import type { ConsentChoice } from "./consent-core";
import { consentApplies } from "./consent-core";

/** Affiliate programme ids (src/lib/affiliate-programs.ts) whose terms ask for consent before their tracking runs. */
export function gatedProgrammes(registry: Record<string, ProgrammeEntry> = PROGRAMME_REGISTRY): Set<string> {
  const out = new Set<string>();
  for (const e of Object.values(registry)) if (e.programme && e.terms?.consentBeforeTracking) out.add(e.programme);
  return out;
}

/** The stores (registry keys) behind those programmes, for the wording of the choice and the privacy pages. */
export function gatedStores(registry: Record<string, ProgrammeEntry> = PROGRAMME_REGISTRY): string[] {
  return Object.entries(registry)
    .filter(([, e]) => e.programme && e.terms?.consentBeforeTracking)
    .map(([store]) => store)
    .sort();
}

/** Whether the site needs to ask anyone anything. */
export function consentActive(registry: Record<string, ProgrammeEntry> = PROGRAMME_REGISTRY): boolean {
  return gatedProgrammes(registry).size > 0;
}

/**
 * Whether a link may carry a programme's tag for this visitor: always for a programme that doesn't ask; for one that
 * does, only with a yes, or outside the region where consent applies.
 */
export function mayTag(
  program: string | null,
  visitor: { consent: ConsentChoice | null; country: string | null },
  gated: ReadonlySet<string> = gatedProgrammes(),
): boolean {
  if (!program || !gated.has(program)) return true;
  return visitor.consent === "yes" || !consentApplies(visitor.country);
}

/** A tagged link, or the store's own link when this visitor hasn't agreed to that programme's tracking. */
export function gateLink<L extends { url: string; program: string | null; network: unknown }>(
  link: L,
  storeUrl: string,
  visitor: { consent: ConsentChoice | null; country: string | null },
  gated: ReadonlySet<string> = gatedProgrammes(),
): L | { url: string; program: null; network: null } {
  return mayTag(link.program, visitor, gated) ? link : { url: storeUrl, program: null, network: null };
}
