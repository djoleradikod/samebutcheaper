/**
 * What we know about a product photo from its licence record. Safe on the server and in the browser.
 */

type PhotoRecord = { credit: string } | null | undefined;

/** A cut-out sits cleanly on white. Anything else is a raw snapshot with its own background. */
export function isCutOut(photo: PhotoRecord) {
  return photo?.credit.includes("background removed") ?? false;
}

/** 0: both photos cut out. 1: both photos. 2: one photo. 3: no photo. */
export type PhotoTier = 0 | 1 | 2 | 3;

/** These swaps show as text rows, not image cards. */
export const NO_PHOTO_TIER: PhotoTier = 3;

/** Where a swap goes in a list, from its two photos. */
export function photoTier(brand: PhotoRecord, alternative: PhotoRecord): PhotoTier {
  if (!brand && !alternative) return NO_PHOTO_TIER;
  if (!brand || !alternative) return 2;
  return isCutOut(brand) && isCutOut(alternative) ? 0 : 1;
}
